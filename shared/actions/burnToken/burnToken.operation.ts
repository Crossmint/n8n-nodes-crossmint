import { IExecuteFunctions, NodeOperationError, NodeApiError, IDataObject } from 'n8n-workflow';
import { CrossmintApi } from '../../transport/CrossmintApi';
import { API_VERSIONS, PAGINATION } from '../../utils/constants';
import { validateRequiredField, validateEVMPrivateKey } from '../../utils/validation';
import { ApiResponse } from '../../transport/types';
import { signEVMMessage } from '../../utils/blockchain';
import { TransactionCreateRequest, ApprovalRequest } from '../../transport/types';

async function getTransactionStatus(
	api: CrossmintApi,
	walletAddress: string,
	transactionId: string,
): Promise<unknown> {
	const endpoint = `wallets/${encodeURIComponent(walletAddress)}/transactions/${encodeURIComponent(transactionId)}`;
	return await api.get(endpoint, API_VERSIONS.WALLETS);
}

async function handleWaitForCompletion(
	api: CrossmintApi,
	walletAddress: string,
	transactionId: string,
	initialResponse: unknown,
	simplifiedOutput: Record<string, unknown>,
	context: IExecuteFunctions,
	itemIndex: number,
): Promise<IDataObject> {
	let currentStatus = (initialResponse as Record<string, unknown>).status;
	let attempts = 0;
	let finalResponse: IDataObject = {
		'simplified-output': simplifiedOutput,
		raw: initialResponse
	} as IDataObject;

	while (currentStatus === 'pending' && attempts < PAGINATION.MAX_ATTEMPTS) {
		attempts++;

		try {
			const statusResponse = await getTransactionStatus(api, walletAddress, transactionId) as IDataObject;
			console.log(`*********[BurnToken] Polling status - Attempt ${attempts}:`, JSON.stringify(statusResponse, null, 2));
			currentStatus = (statusResponse as Record<string, unknown>).status;

			const updatedSimplifiedOutput = {
				...simplifiedOutput,
				status: currentStatus,
			};

			if (statusResponse.completedAt) {
				(updatedSimplifiedOutput as Record<string, unknown>).completedAt = statusResponse.completedAt;
			}
			if (statusResponse.error) {
				(updatedSimplifiedOutput as Record<string, unknown>).error = statusResponse.error;
			}
			if (statusResponse.onChain) {
				const onChain = statusResponse.onChain as IDataObject;
				if (onChain.txId) {
					(updatedSimplifiedOutput as Record<string, unknown>).txId = onChain.txId;
				}
			}

			finalResponse = {
				'simplified-output': updatedSimplifiedOutput,
				raw: statusResponse
			} as IDataObject;

		} catch (error) {
			// Log the error using n8n's proper error handling
			throw new NodeOperationError(context.getNode(), `Failed to get transaction status during polling: ${error}`, {
				itemIndex,
				description: 'Transaction status polling failed. This may be due to temporary API issues.',
			});
		}

		if (currentStatus === 'success' || currentStatus === 'failed') {
			break;
		}
	}

	return finalResponse;
}

export async function burnToken(
	context: IExecuteFunctions,
	api: CrossmintApi,
	itemIndex: number,
): Promise<IDataObject> {
	console.log('*********[BurnToken] Starting burn token operation');
	
	// Get all parameters
	const walletAddress = context.getNodeParameter('walletAddress', itemIndex) as string;
	const tokenLocator = context.getNodeParameter('tokenLocator', itemIndex) as string;
	const amount = context.getNodeParameter('amount', itemIndex) as string;
	const privateKey = context.getNodeParameter('privateKey', itemIndex) as string;
	const waitForCompletion = context.getNodeParameter('waitForCompletion', itemIndex, true) as boolean;
	
	console.log('********[BurnToken] Parameters:', { walletAddress, tokenLocator, amount, waitForCompletion });

	// Validate inputs
	validateRequiredField(walletAddress, 'Wallet address', context, itemIndex);
	validateRequiredField(tokenLocator, 'Token locator', context, itemIndex);
	validateRequiredField(amount, 'Amount', context, itemIndex);
	validateEVMPrivateKey(privateKey, context, itemIndex);

	// Parse token locator to get chain and contract address
	const [chain, ...rest] = tokenLocator.split(':');
	const contractAddress = rest.join(':');
	
	if (!chain || !contractAddress) {
		throw new NodeOperationError(context.getNode(), 'Invalid token locator format. Expected format: chain:contractAddress or chain:contractAddress:tokenId', {
			itemIndex,
		});
	}

	// Create burn transaction by calling the burn function on the token contract
	// For EVM chains (like Base), we use the contract call format with functionName, abi, and args
	// Standard ERC20 burn function: burn(uint256 amount)
	const burnFunctionABI = [
		{
			inputs: [
				{
					internalType: 'uint256',
					name: 'amount',
					type: 'uint256'
				}
			],
			name: 'burn',
			outputs: [],
			stateMutability: 'nonpayable',
			type: 'function'
		}
	];

	// Convert normal amount to wei (smallest unit)
	// Assume 18 decimals (standard for most ERC20 tokens like Tibbir)
	// User enters "1" meaning 1 token, we convert to "1000000000000000000" wei
	// IMPORTANT: Work with string directly to preserve precision (avoid parseFloat)
	const DECIMALS = 18;
	let amountInWei: string;
	
	try {
		// Trim and validate the amount string
		const amountStr = amount.trim();
		if (!amountStr || amountStr === '') {
			throw new NodeOperationError(context.getNode(), 'Invalid amount. Amount cannot be empty.', {
				itemIndex,
				description: `Amount provided: ${amount}`,
			});
		}
		
		// Validate it's a valid number format (basic check)
		if (!/^-?\d*\.?\d+$/.test(amountStr)) {
			throw new NodeOperationError(context.getNode(), 'Invalid amount format. Amount must be a valid number.', {
				itemIndex,
				description: `Amount provided: ${amount}`,
			});
		}
		
		// Check if negative
		if (amountStr.startsWith('-')) {
			throw new NodeOperationError(context.getNode(), 'Invalid amount. Amount must be a positive number.', {
				itemIndex,
				description: `Amount provided: ${amount}`,
			});
		}
		
		// Convert to wei: multiply by 10^18
		// Work with string directly to preserve precision
		const decimalsMultiplier = BigInt(10 ** DECIMALS);
		
		if (amountStr.includes('.')) {
			const [integerPart = '0', decimalPart = ''] = amountStr.split('.');
			const decimalDigits = decimalPart.length;
			
			if (decimalDigits > DECIMALS) {
				throw new NodeOperationError(context.getNode(), `Amount has too many decimal places. Maximum ${DECIMALS} decimals allowed.`, {
					itemIndex,
					description: `Amount provided: ${amount} has ${decimalDigits} decimal places, but maximum is ${DECIMALS}`,
				});
			}
			
			// Pad decimal part to DECIMALS digits (right-pad with zeros)
			const paddedDecimal = decimalPart.padEnd(DECIMALS, '0');
			
			// Combine: integerPart * 10^18 + decimalPart (padded)
			const integerWei = BigInt(integerPart || '0') * decimalsMultiplier;
			const decimalWei = BigInt(paddedDecimal);
			amountInWei = (integerWei + decimalWei).toString();
		} else {
			// Integer amount - just multiply by 10^18
			amountInWei = (BigInt(amountStr) * decimalsMultiplier).toString();
		}
	} catch (error) {
		if (error instanceof NodeOperationError) {
			throw error;
		}
		throw new NodeOperationError(context.getNode(), `Invalid amount format: ${(error as Error).message}`, {
			itemIndex,
			description: `Amount provided: ${amount}. Please provide a valid number.`,
		});
	}

	// Create transaction that calls the burn function
	const requestBody: TransactionCreateRequest = {
		params: {
			chain: chain,
			calls: [{
				address: contractAddress,
				functionName: 'burn',
				abi: burnFunctionABI,
				args: [amountInWei],
				value: '0x0' // No ETH value needed for burn, formatted as hex BigInt string
			}]
		}
	};

	const endpoint = `wallets/${encodeURIComponent(walletAddress)}/transactions`;

	console.log("heyyyyyyyyyyyyyyyyy");
	console.log('*******[BurnToken] Creating transaction - Request:', JSON.stringify(requestBody, null, 2));
	
	let transactionResponse: ApiResponse;
	try {
		transactionResponse = await api.post(endpoint, requestBody as unknown as IDataObject, API_VERSIONS.WALLETS);
		console.log('[BurnToken] Create transaction - Response:', JSON.stringify(transactionResponse, null, 2));
	} catch (error: unknown) {
		console.error('[BurnToken] Create transaction - Error:', error);
		// Pass through the original Crossmint API error exactly as received
		throw new NodeApiError(context.getNode(), error as object & { message?: string });
	}

	// Get approvals from the transaction response
	const response = transactionResponse as IDataObject;
	const transactionId = response.id as string;
	const transactionStatus = response.status as string;
	const approvals = response.approvals as { pending?: Array<{ message: string; signer: { address?: string; locator?: string } }>; submitted?: Array<unknown> } | undefined;
	
	console.log('[BurnToken] Transaction response:', {
		transactionId,
		status: transactionStatus,
		hasApprovals: !!approvals,
		pendingCount: approvals?.pending?.length || 0,
		submittedCount: approvals?.submitted?.length || 0,
	});
	
	let approvalResponse: ApiResponse = transactionResponse;
	let txId: string | undefined;
	let signature: string | undefined;
	let messageToSign: string | undefined;
	let signerAddress: string | undefined;
	
	// Check if there are pending approvals that need to be signed
	if (approvals && approvals.pending && approvals.pending.length > 0) {
		// There are pending approvals - sign and submit them
		messageToSign = approvals.pending[0].message;
		signerAddress = approvals.pending[0].signer.address || (approvals.pending[0].signer.locator as string).split(':')[1];
		
		console.log('[BurnToken] Signing message:', { signerAddress, messageLength: messageToSign.length });
		
		// Sign message using EVM signing (hex private key)
		signature = await signEVMMessage(messageToSign, privateKey, context, itemIndex);
		
		console.log('[BurnToken] Message signed, signature length:', signature.length);
		
		if (!signature) {
			throw new NodeOperationError(context.getNode(), 'Failed to generate signature', {
				itemIndex,
			});
		}

		const approvalRequestBody: ApprovalRequest = {
			approvals: [{
				signer: `external-wallet:${signerAddress}`,
				signature: signature,
			}]
		};

		const approvalEndpoint = `wallets/${encodeURIComponent(walletAddress)}/transactions/${encodeURIComponent(transactionId)}/approvals`;
		
		console.log('[BurnToken] Submitting approval - Request:', JSON.stringify(approvalRequestBody, null, 2));

		try {
			approvalResponse = await api.post(approvalEndpoint, approvalRequestBody as unknown as IDataObject, API_VERSIONS.WALLETS);
			console.log('[BurnToken] Submit approval - Response:', JSON.stringify(approvalResponse, null, 2));
		} catch (error: unknown) {
			console.error('[BurnToken] Submit approval - Error:', error);
			// Pass through the original Crossmint API error exactly as received
			throw new NodeApiError(context.getNode(), error as object & { message?: string });
		}
	} else {
		// No pending approvals - transaction might already be executed or auto-executed
		console.log('[BurnToken] No pending approvals found - transaction may already be executed or auto-executed');
		
		// Check if transaction is already successful
		if (transactionStatus === 'success') {
			console.log('[BurnToken] Transaction already successful, no approval needed');
		}
	}
	
	// Extract txId from approval response (or transaction response if no approval was submitted)
	const approvalData = approvalResponse as IDataObject;
	const onChain = approvalData.onChain as IDataObject | undefined;
	
	// Check onChain.txId directly (this is the most reliable source for EVM)
	if (onChain && onChain.txId) {
		txId = onChain.txId as string;
	}
	
	// Try to get txId directly from response fields
	if (!txId) {
		txId = (approvalData.signature as string) || (approvalData.txId as string);
	}

	const rawResponseData = approvalResponse as IDataObject;
	const simplifiedOutput = {
		chainType: rawResponseData.chainType,
		walletType: rawResponseData.walletType,
		walletAddress: walletAddress,
		tokenLocator: tokenLocator,
		amount: amount,
		amountInWei: amountInWei,
		chain: chain,
		contractAddress: contractAddress,
		id: rawResponseData.id,
		status: rawResponseData.status,
		createdAt: rawResponseData.createdAt,
		approvals: rawResponseData.approvals || {},
		...(signature && messageToSign && {
			signingDetails: {
				signature: signature,
				signedMessage: signature,
				chainType: 'evm',
				chain: chain,
				messageToSign: messageToSign,
			},
		}),
		...(signerAddress && signature && {
			submittedApproval: {
				walletAddress,
				transactionId,
				signerAddress,
				signature,
			},
		}),
		...(txId && { txId }),
	};

	if (waitForCompletion) {
		console.log('[BurnToken] Waiting for completion, transactionId:', transactionId);
		return await handleWaitForCompletion(api, walletAddress, transactionId, approvalResponse, simplifiedOutput, context, itemIndex);
	}

	console.log('[BurnToken] Returning without waiting for completion');
	return {
		'simplified-output': simplifiedOutput,
		raw: approvalResponse
	} as IDataObject;
}
