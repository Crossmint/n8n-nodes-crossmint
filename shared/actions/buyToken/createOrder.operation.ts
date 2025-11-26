import { IExecuteFunctions, NodeOperationError, NodeApiError, IDataObject } from 'n8n-workflow';
import { CrossmintApi } from '../../transport/CrossmintApi';
import { API_VERSIONS } from '../../utils/constants';
import { validateRequiredField } from '../../utils/validation';
import { ApiResponse } from '../../transport/types';

export interface OrderCreateRequest {
	payment: {
		method: 'solana';
		currency: 'sol' | 'usdc' | 'bonk';
		payerAddress: string;
		receiptEmail?: string;
	};
	lineItems: Array<{
		tokenLocator: string;
		executionParameters: {
			mode: 'exact-in';
			amount: string;
			maxSlippageBps?: string;
		};
	}>;
	recipient: {
		walletAddress: string;
	};
	locale?: string;
}

export async function createOrder(
	context: IExecuteFunctions,
	api: CrossmintApi,
	itemIndex: number,
): Promise<IDataObject> {
	const payerAddress = context.getNodeParameter('payerAddress', itemIndex) as string;
	const recipientWalletAddress = context.getNodeParameter('recipientWalletAddress', itemIndex) as string;
	const tokenLocator = context.getNodeParameter('tokenLocator', itemIndex) as string;
	const amount = context.getNodeParameter('amount', itemIndex) as string;
	const maxSlippageBps = context.getNodeParameter('maxSlippageBps', itemIndex) as string | undefined;
	const paymentCurrency = context.getNodeParameter('paymentCurrency', itemIndex, 'usdc') as 'sol' | 'usdc' | 'bonk';

	validateRequiredField(payerAddress, 'Payer address', context, itemIndex);
	validateRequiredField(recipientWalletAddress, 'Recipient wallet address', context, itemIndex);
	validateRequiredField(tokenLocator, 'Token locator', context, itemIndex);
	validateRequiredField(amount, 'Amount', context, itemIndex);
	// maxSlippageBps is optional according to API docs

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

	const endpoint = 'orders';

	let orderResponse: ApiResponse;
	try {
		orderResponse = await api.post(endpoint, requestBody as unknown as IDataObject, API_VERSIONS.ORDERS);
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

	if (!serializedTransaction) {
		throw new NodeOperationError(context.getNode(), 'Invalid order response: missing serialized transaction', {
			itemIndex,
		});
	}

	return {
		clientSecret: clientSecret,
		orderId: order.orderId || order.id,
		order: order,
		serializedTransaction: serializedTransaction,
		payment: payment,
	};
}

