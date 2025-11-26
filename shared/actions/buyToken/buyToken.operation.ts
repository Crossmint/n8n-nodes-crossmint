import { IExecuteFunctions, NodeOperationError, NodeApiError, IDataObject } from 'n8n-workflow';
import { CrossmintApi } from '../../transport/CrossmintApi';
import { API_VERSIONS, PAGINATION } from '../../utils/constants';
import { validateRequiredField, validatePrivateKey } from '../../utils/validation';
import { ApiResponse } from '../../transport/types';
import { signMessage } from '../../utils/blockchain';
import { TransactionCreateRequest, ApprovalRequest } from '../../transport/types';
import { OrderCreateRequest } from './createOrder.operation';
import { VersionedTransaction } from '@solana/web3.js';
import * as base58 from '../../utils/base58';

async function signAndSubmitTransactionForSmartWallet(
	serializedTransaction: string,
	privateKey: string,
	payerAddress: string,
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
	
	const endpoint = `wallets/${encodeURIComponent(payerAddress)}/transactions`;

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

	const approvalEndpoint = `wallets/${encodeURIComponent(payerAddress)}/transactions/${encodeURIComponent(transactionId as string)}/approvals`;

	let approvalResponse: ApiResponse;
	try {
		approvalResponse = await api.post(approvalEndpoint, approvalRequestBody as unknown as IDataObject, API_VERSIONS.WALLETS);
	} catch (error: unknown) {
		throw new NodeApiError(context.getNode(), error as object & { message?: string });
	}

	// Get the transaction signature/txId from the approval response
	// For Solana, the transaction might be base58 or base64 encoded
	const approvalData = approvalResponse as IDataObject;
	const onChain = approvalData.onChain as IDataObject | undefined;
	
	let txId: string | undefined;
	
	// First, check onChain.txId directly (this is the most reliable source)
	if (onChain && onChain.txId) {
		txId = onChain.txId as string;
	}
	
	// Try to get txId directly from response fields
	if (!txId) {
		txId = (approvalData.signature as string) || (approvalData.txId as string) || (transactionResponse as IDataObject).signature as string;
	}
	
	// If not found, extract from onChain.transaction (try both base58 and base64)
	if (!txId && onChain && onChain.transaction) {
		const transactionData = onChain.transaction as string;
		try {
			// Try base58 first (common for Solana)
			const signedTxBuffer = Buffer.from(base58.decode(transactionData));
			const signedTx = VersionedTransaction.deserialize(signedTxBuffer);
			if (signedTx.signatures && signedTx.signatures.length > 0) {
				txId = base58.encode(signedTx.signatures[0]);
			}
		} catch (base58Error) {
			// If base58 fails, try base64
			try {
				const signedTxBuffer = Buffer.from(transactionData, 'base64');
				const signedTx = VersionedTransaction.deserialize(signedTxBuffer);
				if (signedTx.signatures && signedTx.signatures.length > 0) {
					txId = base58.encode(signedTx.signatures[0]);
				}
			} catch (base64Error) {
				// Continue to try other methods
			}
		}
	}
	
	// If still not found, wait a bit and then poll the transaction status
	// The transaction needs time to be submitted to the blockchain
	if (!txId) {
		// Wait 2 seconds for the transaction to be submitted
		await new Promise(resolve => setTimeout(resolve, 2000));
		
		// Poll transaction status to get the signature once it's submitted
		const statusEndpoint = `wallets/${encodeURIComponent(payerAddress)}/transactions/${encodeURIComponent(transactionId as string)}`;
		let attempts = 0;
		const maxAttempts = 15; // Increased attempts
		
		while (attempts < maxAttempts && !txId) {
			attempts++;
			await new Promise(resolve => setTimeout(resolve, 1500)); // Wait 1.5 seconds between attempts
			
			try {
				const statusResponse = await api.get(statusEndpoint, API_VERSIONS.WALLETS) as IDataObject;
				const statusOnChain = statusResponse.onChain as IDataObject | undefined;
				
				// First check onChain.txId (most reliable)
				if (statusOnChain && statusOnChain.txId) {
					txId = statusOnChain.txId as string;
					break;
				}
				
				// Try to get signature from status response
				if (!txId) {
					txId = (statusResponse.signature as string) || (statusResponse.txId as string);
				}
				
				// Or extract from onChain.transaction (try both base58 and base64)
				if (!txId && statusOnChain && statusOnChain.transaction) {
					const transactionData = statusOnChain.transaction as string;
					try {
						// Try base58 first
						const signedTxBuffer = Buffer.from(base58.decode(transactionData));
						const signedTx = VersionedTransaction.deserialize(signedTxBuffer);
						if (signedTx.signatures && signedTx.signatures.length > 0) {
							txId = base58.encode(signedTx.signatures[0]);
							break;
						}
					} catch (base58Error) {
						// If base58 fails, try base64
						try {
							const signedTxBuffer = Buffer.from(transactionData, 'base64');
							const signedTx = VersionedTransaction.deserialize(signedTxBuffer);
							if (signedTx.signatures && signedTx.signatures.length > 0) {
								txId = base58.encode(signedTx.signatures[0]);
								break;
							}
						} catch (base64Error) {
							// Continue polling
						}
					}
				}
				
				// If transaction is completed/failed, stop polling
				const status = statusResponse.status as string;
				if (status === 'success' || status === 'failed') {
					// If we still don't have txId but transaction is successful, 
					// try one more time to get it from the response
					if (!txId && statusOnChain && statusOnChain.txId) {
						txId = statusOnChain.txId as string;
					}
					break;
				}
			} catch (error) {
				// Continue polling
			}
		}
	}
	
	// If still not found, return undefined instead of throwing error
	// The caller can handle this case (e.g., check order status for txId)
	if (!txId) {
		// Don't throw error - let the caller handle it
		// The transaction might still be processing
		return { txId: '' };
	}

	return { txId };
}

async function getOrderStatus(
	api: CrossmintApi,
	orderId: string,
	clientSecret?: string,
): Promise<ApiResponse> {
	const endpoint = `orders/${encodeURIComponent(orderId)}`;
	const headers: Record<string, string> = {};
	
	if (clientSecret) {
		headers['authorization'] = clientSecret;
	}

	return await api.get(endpoint, API_VERSIONS.ORDERS, headers);
}

export async function buyToken(
	context: IExecuteFunctions,
	api: CrossmintApi,
	itemIndex: number,
): Promise<IDataObject> {
	// Get all parameters
	const payerAddress = context.getNodeParameter('payerAddress', itemIndex) as string;
	const recipientWalletAddress = context.getNodeParameter('recipientWalletAddress', itemIndex) as string;
	const tokenLocator = context.getNodeParameter('tokenLocator', itemIndex) as string;
	const amount = context.getNodeParameter('amount', itemIndex) as string;
	const maxSlippageBps = context.getNodeParameter('maxSlippageBps', itemIndex) as string | undefined;
	const paymentCurrency = context.getNodeParameter('paymentCurrency', itemIndex) as 'sol' | 'usdc' | 'bonk';
	const privateKey = context.getNodeParameter('privateKey', itemIndex) as string;
	const waitForCompletion = context.getNodeParameter('waitForCompletion', itemIndex, true) as boolean;

	// Validate inputs
	validateRequiredField(payerAddress, 'Payer address', context, itemIndex);
	validateRequiredField(recipientWalletAddress, 'Recipient wallet address', context, itemIndex);
	validateRequiredField(tokenLocator, 'Token locator', context, itemIndex);
	validateRequiredField(amount, 'Amount', context, itemIndex);
	// maxSlippageBps is optional according to API docs
	validatePrivateKey(privateKey, context, itemIndex);

	// Step 1: Create Order
	const requestBody: OrderCreateRequest = {
		payment: {
			method: 'solana',
			currency: paymentCurrency,
			payerAddress: payerAddress,
		},
		lineItems: [
			{
				tokenLocator: tokenLocator,
				executionParameters: {
					mode: 'exact-in',
					amount: amount,
					...(maxSlippageBps && { maxSlippageBps: maxSlippageBps }),
				},
			},
		],
		recipient: {
			walletAddress: recipientWalletAddress,
		},
	};

	let orderResponse: ApiResponse;
	try {
		orderResponse = await api.post('orders', requestBody as unknown as IDataObject, API_VERSIONS.ORDERS);
	} catch (error: unknown) {
		throw new NodeApiError(context.getNode(), error as object & { message?: string });
	}

	const orderData = orderResponse as IDataObject;
	const order = orderData.order as IDataObject;
	const clientSecret = orderData.clientSecret as string;

	if (!order) {
		throw new NodeOperationError(context.getNode(), 'Invalid order response: missing order data', {
			itemIndex,
		});
	}

	const payment = order.payment as IDataObject;
	if (!payment || !payment.preparation) {
		throw new NodeOperationError(context.getNode(), 'Invalid order response: missing payment preparation', {
			itemIndex,
		});
	}

	const preparation = payment.preparation as IDataObject;
	
	// Try multiple possible locations for the serialized transaction
	// It might be in different places depending on the API response structure
	let serializedTransaction: string | undefined = 
		(preparation.serializedTransaction as string | undefined) ||
		(preparation.transaction as string | undefined) ||
		((preparation as any).tx as string | undefined) ||
		(payment.serializedTransaction as string | undefined);
	
	const orderId = (order.orderId || order.id) as string;

	if (!serializedTransaction || !orderId) {
		throw new NodeOperationError(context.getNode(), 'Invalid order response: missing serialized transaction or order ID', {
			itemIndex,
			description: `Order ID: ${orderId || 'missing'}, Serialized Transaction: ${serializedTransaction ? 'present' : 'missing'}, Preparation keys: ${preparation ? Object.keys(preparation).join(', ') : 'none'}`,
		});
	}

	// Step 2-3: Sign and Submit Transaction (using smart wallet flow)
	const { txId: walletTxId } = await signAndSubmitTransactionForSmartWallet(
		serializedTransaction,
		privateKey,
		payerAddress,
		api,
		context,
		itemIndex
	);

	// Step 3: Poll Order Status (if waitForCompletion is true)
	// Also try to extract txId from order status if not found from wallet transaction
	let txId = walletTxId;
	
	if (!waitForCompletion) {
		// If we don't have txId yet, try to get it from order status
		if (!txId || txId === '') {
			try {
				const statusResponse = await getOrderStatus(api, orderId, clientSecret);
				const orderStatusData = statusResponse as IDataObject;
				const orderStatus = (orderStatusData.order as IDataObject | undefined) || orderStatusData;
				const payment = (orderStatus as IDataObject)?.payment as IDataObject | undefined;
				// Try to extract txId from payment or order data
				txId = (payment?.txId as string) || 
				       (payment?.transactionId as string) || 
				       (orderStatus?.txId as string) ||
				       (orderStatus?.transactionId as string) ||
				       '';
			} catch (error) {
				// If we can't get order status, continue with empty txId
			}
		}
		
		// Return the exact API response structure
		// Use Object.assign to ensure we preserve all fields from the API response
		const response = Object.assign({}, orderData) as IDataObject;
		// Add txId to the response if we have it and it's not already there
		if (txId && txId !== '' && !response.txId) {
			response.txId = txId;
		}
		return response;
	}

	// Poll until completion
	let currentOrderData = orderData;
	let currentStatus: string | undefined;
	let attempts = 0;
	const maxAttempts = PAGINATION.MAX_ATTEMPTS;
	const pollInterval = PAGINATION.POLL_INTERVAL;

	// Get initial status
	const initialOrder = (currentOrderData.order as IDataObject | undefined) || currentOrderData;
	const initialOrderObj = initialOrder && typeof initialOrder === 'object' ? initialOrder as IDataObject : currentOrderData;
	currentStatus = (initialOrderObj.status as string | undefined) || ((initialOrderObj.payment as IDataObject | undefined)?.status as string | undefined);

	while (
		(currentStatus === 'awaiting-payment' || 
		 currentStatus === 'pending' || 
		 currentStatus === 'processing') &&
		attempts < maxAttempts
	) {
		attempts++;
		await new Promise(resolve => setTimeout(resolve, pollInterval));

		try {
			const statusResponse = await getOrderStatus(api, orderId, clientSecret);
			const updatedOrderData = statusResponse as IDataObject;
			const updatedOrder = (updatedOrderData.order as IDataObject | undefined) || updatedOrderData;
			const updatedOrderObj = updatedOrder && typeof updatedOrder === 'object' ? updatedOrder as IDataObject : updatedOrderData;
			currentStatus = (updatedOrderObj.status as string | undefined) || ((updatedOrderObj.payment as IDataObject | undefined)?.status as string | undefined);
			currentOrderData = updatedOrderData;
			
			// Try to extract txId from order status if we don't have it yet
			if ((!txId || txId === '') && updatedOrderObj) {
				const payment = (updatedOrderObj.payment as IDataObject | undefined);
				txId = (payment?.txId as string) || 
				       (payment?.transactionId as string) || 
				       (updatedOrderObj.txId as string) ||
				       (updatedOrderObj.transactionId as string) ||
				       txId || '';
			}
		} catch (error: unknown) {
			throw new NodeOperationError(
				context.getNode(),
				`Failed to get order status during polling: ${(error as Error).message}`,
				{
					itemIndex,
					description: 'Order status polling failed. This may be due to temporary API issues.',
				}
			);
		}

		if (currentStatus === 'completed' || currentStatus === 'success' || currentStatus === 'failed') {
			break;
		}
	}

	if (attempts >= maxAttempts && currentStatus !== 'completed' && currentStatus !== 'success' && currentStatus !== 'failed') {
		throw new NodeOperationError(
			context.getNode(),
			`Order did not complete within ${maxAttempts} attempts. Current status: ${currentStatus}`,
			{ itemIndex }
		);
	}

	// Return the exact API response structure
	// Use Object.assign to ensure we preserve all fields from the API response
	const response = Object.assign({}, currentOrderData) as IDataObject;
	// Add txId to the response if we have it and it's not already there
	if (txId && txId !== '' && !response.txId) {
		response.txId = txId;
	}
	// Add attempts count for debugging purposes (only if not already present)
	if (!response.attempts) {
		response.attempts = attempts;
	}
	return response;
}
