import { IExecuteFunctions, NodeOperationError, NodeApiError, IDataObject } from 'n8n-workflow';
import { CrossmintApi } from '../../transport/CrossmintApi';
import { API_VERSIONS, PAGINATION } from '../../utils/constants';
import { validateRequiredField, validatePrivateKey } from '../../utils/validation';
import { ApiResponse } from '../../transport/types';
import { signMessage } from '../../utils/blockchain';
import { TransactionCreateRequest, ApprovalRequest } from '../../transport/types';
import { VersionedTransaction } from '@solana/web3.js';
import * as base58 from '../../utils/base58';

async function signAndSubmitTransactionForSmartWallet(
	serializedTransaction: string,
	privateKey: string,
	walletAddress: string,
	api: CrossmintApi,
	context: IExecuteFunctions,
	itemIndex: number,
): Promise<{ txId: string }> {
	// For smart wallets, we need to:
	// 1. Submit the transaction to Wallets API to create a transaction
	// 2. Get approvals from the response
	// 3. Sign the message from approvals
	// 4. Submit the signature as an approval
	// 5. Get the transaction signature/txId from the response
	
	const requestBody: TransactionCreateRequest = {
		params: {
			transaction: serializedTransaction
		}
	};
	
	const endpoint = `wallets/${encodeURIComponent(walletAddress)}/transactions`;

	let transactionResponse: ApiResponse;
	try {
		transactionResponse = await api.post(endpoint, requestBody as unknown as IDataObject, API_VERSIONS.WALLETS);
	} catch (error: unknown) {
		throw new NodeApiError(context.getNode(), error as object & { message?: string });
	}

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
	
	const signature = await signMessage(messageToSign, privateKey, context, itemIndex);

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

	// Get the transaction signature/txId from the approval response
	const approvalData = approvalResponse as IDataObject;
	const onChain = approvalData.onChain as IDataObject | undefined;
	
	let txId: string | undefined;
	
	// Try to get txId directly from response fields
	txId = (approvalData.signature as string) || (approvalData.txId as string) || (transactionResponse as IDataObject).signature as string;
	
	// Check onChain.txId directly (this is the most reliable source)
	if (!txId && onChain && onChain.txId) {
		txId = onChain.txId as string;
	}
	
	// If not found, extract from onChain.transaction
	if (!txId && onChain && onChain.transaction) {
		try {
			const signedTransactionBase64 = onChain.transaction as string;
			const signedTxBuffer = Buffer.from(signedTransactionBase64, 'base64');
			const signedTx = VersionedTransaction.deserialize(signedTxBuffer);
			if (signedTx.signatures && signedTx.signatures.length > 0) {
				txId = base58.encode(signedTx.signatures[0]);
			}
		} catch (error) {
			// Continue to try other methods
		}
	}
	
	// If still not found, poll the transaction status to get the signature
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
				
				// Try to get signature from status response
				txId = (statusResponse.signature as string) || (statusResponse.txId as string);
				
				// Check onChain.txId directly (this is the most reliable source)
				if (!txId && statusOnChain && statusOnChain.txId) {
					txId = statusOnChain.txId as string;
					break;
				}
				
				// Or extract from onChain.transaction
				if (!txId && statusOnChain && statusOnChain.transaction) {
					try {
						const signedTransactionBase64 = statusOnChain.transaction as string;
						const signedTxBuffer = Buffer.from(signedTransactionBase64, 'base64');
						const signedTx = VersionedTransaction.deserialize(signedTxBuffer);
						if (signedTx.signatures && signedTx.signatures.length > 0) {
							txId = base58.encode(signedTx.signatures[0]);
							break;
						}
					} catch (error) {
						// Continue polling
					}
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

	// Create burn transaction using Wallets API
	// For EVM chains (like Base), we'll use the transfer endpoint with a burn address
	// The burn address is typically 0x000000000000000000000000000000000000dEaD
	const burnAddress = '0x000000000000000000000000000000000000dEaD';
	
	const requestBody = {
		params: {
			chain: chain,
			to: burnAddress,
			tokenLocator: tokenLocator,
			amount: amount,
		}
	};

	const endpoint = `wallets/${encodeURIComponent(walletAddress)}/transfers`;

	let transferResponse: ApiResponse;
	try {
		transferResponse = await api.post(endpoint, requestBody as unknown as IDataObject, API_VERSIONS.WALLETS);
	} catch (error: unknown) {
		throw new NodeApiError(context.getNode(), error as object & { message?: string });
	}

	const transferData = transferResponse as IDataObject;
	const serializedTransaction = transferData.serializedTransaction as string | undefined;

	if (!serializedTransaction) {
		throw new NodeOperationError(context.getNode(), 'Invalid transfer response: missing serialized transaction', {
			itemIndex,
		});
	}

	// Sign and submit transaction using smart wallet flow
	const { txId } = await signAndSubmitTransactionForSmartWallet(
		serializedTransaction,
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
			burnAddress: burnAddress,
		};
	}

	// Poll transaction status until completion
	const transactionId = (transferData.id as string) || (transferData.transactionId as string);
	if (!transactionId) {
		// If we don't have a transaction ID, return what we have
		return {
			walletAddress: walletAddress,
			tokenLocator: tokenLocator,
			amount: amount,
			txId: txId,
			burnAddress: burnAddress,
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
		burnAddress: burnAddress,
		status: currentStatus,
		attempts: attempts,
	};
}

