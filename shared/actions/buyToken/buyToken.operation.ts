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
	// The signed transaction is in onChain.transaction (base64 encoded)
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
			// Decode base64 to get the signed transaction bytes
			const signedTxBuffer = Buffer.from(signedTransactionBase64, 'base64');
			// Deserialize to get the signature
			const signedTx = VersionedTransaction.deserialize(signedTxBuffer);
			// Extract the first signature (this is the txId)
			if (signedTx.signatures && signedTx.signatures.length > 0) {
				txId = base58.encode(signedTx.signatures[0]);
			}
		} catch (error) {
			// Continue to try other methods
		}
	}
	
	// If still not found, poll the transaction status to get the signature
	if (!txId) {
		// Poll transaction status to get the signature once it's submitted
		const statusEndpoint = `wallets/${encodeURIComponent(payerAddress)}/transactions/${encodeURIComponent(transactionId as string)}`;
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
	const { txId } = await signAndSubmitTransactionForSmartWallet(
		serializedTransaction,
		privateKey,
		payerAddress,
		api,
		context,
		itemIndex
	);

	// Step 3: Poll Order Status (if waitForCompletion is true)
	if (!waitForCompletion) {
		return {
			orderId: orderId,
			order: orderData,
			txId: txId,
			clientSecret: clientSecret,
		};
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

	return {
		orderId: orderId,
		status: currentStatus,
		order: currentOrderData,
		txId: txId,
		clientSecret: clientSecret,
		attempts: attempts,
	};
}
