import { IExecuteFunctions, NodeOperationError, NodeApiError, IDataObject } from 'n8n-workflow';
import { CrossmintApi } from '../../transport/CrossmintApi';
import { API_VERSIONS, PAGINATION } from '../../utils/constants';
import { validateRequiredField, validatePrivateKey } from '../../utils/validation';
import { ApiResponse } from '../../transport/types';
import { signEVMMessage } from '../../utils/blockchain';
import { TransactionCreateRequest, ApprovalRequest } from '../../transport/types';

async function signAndSubmitTransactionForSmartWallet(
	transactionResponse: ApiResponse,
	privateKey: string,
	walletAddress: string,
	api: CrossmintApi,
	context: IExecuteFunctions,
	itemIndex: number,
): Promise<{ txId: string }> {
	// For EVM smart wallets, we need to:
	// 1. Get approvals from the transaction response
	// 2. Sign the message from approvals using EVM signing
	// 3. Submit the signature as an approval
	// 4. Get the transaction hash/txId from the response
	
	const transactionId = (transactionResponse as IDataObject).id; 
	
	const response = transactionResponse as IDataObject;
	const approvals = response.approvals as { pending?: Array<{ message: string; signer: { address?: string; locator?: string } }> };
	if (!approvals || !approvals.pending || !approvals.pending[0]) {
		throw new NodeOperationError(context.getNode(), 'No pending approval found in transaction response', {
			itemIndex,
		});
	}
	
	const messageToSign = approvals.pending[0].message;
	const signerAddress = approvals.pending[0].signer.address || (approvals.pending[0].signer.locator as string).split(':')[1];
	
	// Sign message using EVM signing (hex private key)
	const signature = await signEVMMessage(messageToSign, privateKey, context, itemIndex);

	const approvalRequestBody: ApprovalRequest = {
		approvals: [{
			signer: `external-wallet:${signerAddress}`,
			signature: signature,
		}]
	};

	const approvalEndpoint = `wallets/${encodeURIComponent(walletAddress)}/transactions/${encodeURIComponent(transactionId as string)}/approvals`;

	let approvalResponse: ApiResponse;
	try {
		approvalResponse = await api.post(approvalEndpoint, approvalRequestBody as unknown as IDataObject, API_VERSIONS.WALLETS);
	} catch (error: unknown) {
		throw new NodeApiError(context.getNode(), error as object & { message?: string });
	}

	// Get the transaction hash/txId from the approval response
	const approvalData = approvalResponse as IDataObject;
	const onChain = approvalData.onChain as IDataObject | undefined;
	
	let txId: string | undefined;
	
	// Try to get txId directly from response fields
	txId = (approvalData.signature as string) || (approvalData.txId as string) || (transactionResponse as IDataObject).signature as string;
	
	// Check onChain.txId directly (this is the most reliable source for EVM)
	if (!txId && onChain && onChain.txId) {
		txId = onChain.txId as string;
	}
	
	// If still not found, poll the transaction status to get the txId
	if (!txId) {
		const statusEndpoint = `wallets/${encodeURIComponent(walletAddress)}/transactions/${encodeURIComponent(transactionId as string)}`;
		let attempts = 0;
		const maxAttempts = 10;
		
		while (attempts < maxAttempts && !txId) {
			attempts++;
			await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
			
			try {
				const statusResponse = await api.get(statusEndpoint, API_VERSIONS.WALLETS) as IDataObject;
				const statusOnChain = statusResponse.onChain as IDataObject | undefined;
				
				// Try to get txId from status response
				txId = (statusResponse.signature as string) || (statusResponse.txId as string);
				
				// Check onChain.txId directly (this is the most reliable source for EVM)
				if (!txId && statusOnChain && statusOnChain.txId) {
					txId = statusOnChain.txId as string;
					break;
				}
				
				// If transaction is completed/failed, stop polling
				const status = statusResponse.status as string;
				if (status === 'success' || status === 'failed') {
					break;
				}
			} catch (error) {
				// Continue polling
			}
		}
	}
	
	if (!txId) {
		throw new NodeOperationError(context.getNode(), 'Could not extract txId from approval response or transaction status. The transaction may need to be checked manually.', {
			itemIndex,
		});
	}

	return { txId };
}

export async function burnToken(
	context: IExecuteFunctions,
	api: CrossmintApi,
	itemIndex: number,
): Promise<IDataObject> {
	// Get all parameters
	const walletAddress = context.getNodeParameter('walletAddress', itemIndex) as string;
	const tokenLocator = context.getNodeParameter('tokenLocator', itemIndex) as string;
	const amount = context.getNodeParameter('amount', itemIndex) as string;
	const privateKey = context.getNodeParameter('privateKey', itemIndex) as string;
	const waitForCompletion = context.getNodeParameter('waitForCompletion', itemIndex, true) as boolean;

	// Validate inputs
	validateRequiredField(walletAddress, 'Wallet address', context, itemIndex);
	validateRequiredField(tokenLocator, 'Token locator', context, itemIndex);
	validateRequiredField(amount, 'Amount', context, itemIndex);
	validatePrivateKey(privateKey, context, itemIndex);

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

	// Create transaction that calls the burn function
	const requestBody: TransactionCreateRequest = {
		params: {
			chain: chain,
			calls: [{
				address: contractAddress,
				functionName: 'burn',
				abi: burnFunctionABI,
				args: [amount],
				value: '0'
			}]
		}
	};

	const endpoint = `wallets/${encodeURIComponent(walletAddress)}/transactions`;

	let transactionResponse: ApiResponse;
	try {
		transactionResponse = await api.post(endpoint, requestBody as unknown as IDataObject, API_VERSIONS.WALLETS);
	} catch (error: unknown) {
		throw new NodeApiError(context.getNode(), error as object & { message?: string });
	}

	// Sign and submit transaction using smart wallet flow
	const { txId } = await signAndSubmitTransactionForSmartWallet(
		transactionResponse,
		privateKey,
		walletAddress,
		api,
		context,
		itemIndex
	);

	// If waitForCompletion is false, return immediately
	if (!waitForCompletion) {
		return {
			walletAddress: walletAddress,
			tokenLocator: tokenLocator,
			amount: amount,
			txId: txId,
		};
	}

	// Poll transaction status until completion
	const transactionId = (transactionResponse as IDataObject).id as string;
	if (!transactionId) {
		// If we don't have a transaction ID, return what we have
		return {
			walletAddress: walletAddress,
			tokenLocator: tokenLocator,
			amount: amount,
			txId: txId,
		};
	}

	const statusEndpoint = `wallets/${encodeURIComponent(walletAddress)}/transactions/${encodeURIComponent(transactionId)}`;
	let attempts = 0;
	const maxAttempts = PAGINATION.MAX_ATTEMPTS;
	const pollInterval = PAGINATION.POLL_INTERVAL;
	let currentStatus: string | undefined = 'pending';

	while (
		(currentStatus === 'pending' || currentStatus === 'processing') &&
		attempts < maxAttempts
	) {
		attempts++;
		await new Promise(resolve => setTimeout(resolve, pollInterval));

		try {
			const statusResponse = await api.get(statusEndpoint, API_VERSIONS.WALLETS) as IDataObject;
			currentStatus = statusResponse.status as string;

			if (currentStatus === 'success' || currentStatus === 'failed') {
				break;
			}
		} catch (error: unknown) {
			throw new NodeOperationError(
				context.getNode(),
				`Failed to get transaction status during polling: ${(error as Error).message}`,
				{
					itemIndex,
					description: 'Transaction status polling failed. This may be due to temporary API issues.',
				}
			);
		}
	}

	return {
		walletAddress: walletAddress,
		tokenLocator: tokenLocator,
		amount: amount,
		txId: txId,
		status: currentStatus,
		attempts: attempts,
	};
}

