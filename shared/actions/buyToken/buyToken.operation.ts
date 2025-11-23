import { IExecuteFunctions, NodeOperationError, NodeApiError, IDataObject } from 'n8n-workflow';
import { CrossmintApi } from '../../transport/CrossmintApi';
import { API_VERSIONS, PAGINATION } from '../../utils/constants';
import { validateRequiredField, validatePrivateKey } from '../../utils/validation';
import { ApiResponse } from '../../transport/types';
import { VersionedTransaction, Keypair } from '@solana/web3.js';
import * as base58 from '../../utils/base58';
import { OrderCreateRequest } from './createOrder.operation';

async function signVersionedTransaction(
	serializedTransaction: string,
	privateKey: string,
	context: IExecuteFunctions,
	itemIndex: number,
): Promise<{ signedTransaction: string; signature: string }> {
	try {
		const txBuffer = Buffer.from(serializedTransaction, 'base64');
		const transaction = VersionedTransaction.deserialize(txBuffer);

		const secretKeyBytes = base58.decode(privateKey);
		if (secretKeyBytes.length !== 64) {
			throw new NodeOperationError(
				context.getNode(),
				'Invalid Solana private key: must decode to 64 bytes',
				{ itemIndex }
			);
		}

		const keypair = Keypair.fromSecretKey(secretKeyBytes);
		transaction.sign([keypair]);

		const signedTxBuffer = transaction.serialize();
		const signedTransaction = Buffer.from(signedTxBuffer).toString('base64');

		const signatures = transaction.signatures;
		if (!signatures || signatures.length === 0) {
			throw new NodeOperationError(
				context.getNode(),
				'Failed to extract signature from signed transaction',
				{ itemIndex }
			);
		}

		const signature = base58.encode(signatures[0]);

		return {
			signedTransaction,
			signature,
		};
	} catch (error: unknown) {
		throw new NodeOperationError(
			context.getNode(),
			`Failed to sign transaction: ${(error as Error).message}`,
			{ itemIndex }
		);
	}
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
	const maxSlippageBps = context.getNodeParameter('maxSlippageBps', itemIndex) as string;
	const privateKey = context.getNodeParameter('privateKey', itemIndex) as string;
	const waitForCompletion = context.getNodeParameter('waitForCompletion', itemIndex, true) as boolean;

	// Validate inputs
	validateRequiredField(payerAddress, 'Payer address', context, itemIndex);
	validateRequiredField(recipientWalletAddress, 'Recipient wallet address', context, itemIndex);
	validateRequiredField(tokenLocator, 'Token locator', context, itemIndex);
	validateRequiredField(amount, 'Amount', context, itemIndex);
	validateRequiredField(maxSlippageBps, 'Max slippage BPS', context, itemIndex);
	validatePrivateKey(privateKey, context, itemIndex);

	// Step 1: Create Order
	const requestBody: OrderCreateRequest = {
		payment: {
			method: 'solana',
			currency: 'usdc',
			payerAddress: payerAddress,
		},
		lineItems: [
			{
				tokenLocator: tokenLocator,
				executionParameters: {
					mode: 'exact-in',
					amount: amount,
					maxSlippageBps: maxSlippageBps,
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
	const serializedTransaction = preparation.serializedTransaction as string;
	const orderId = (order.orderId || order.id) as string;

	if (!serializedTransaction || !orderId) {
		throw new NodeOperationError(context.getNode(), 'Invalid order response: missing serialized transaction or order ID', {
			itemIndex,
		});
	}

	// Step 2-3: Sign and Submit Transaction
	const { signedTransaction, signature: txId } = await signVersionedTransaction(
		serializedTransaction,
		privateKey,
		context,
		itemIndex
	);

	const endpoint = `orders/${encodeURIComponent(orderId)}/payments/crypto`;
	const submitRequestBody = { txId: txId };

	let submitResponse: ApiResponse;
	try {
		submitResponse = await api.post(endpoint, submitRequestBody as unknown as IDataObject, API_VERSIONS.ORDERS);
	} catch (error: unknown) {
		throw new NodeApiError(context.getNode(), error as object & { message?: string });
	}

	// Step 4: Poll Order Status (if waitForCompletion is true)
	if (!waitForCompletion) {
		return {
			orderId: orderId,
			order: orderData,
			txId: txId,
			signedTransaction: signedTransaction,
			submitResponse: submitResponse,
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
		signedTransaction: signedTransaction,
		submitResponse: submitResponse,
		clientSecret: clientSecret,
		attempts: attempts,
	};
}

