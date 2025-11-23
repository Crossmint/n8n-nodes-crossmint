import { IExecuteFunctions, NodeOperationError, NodeApiError, IDataObject } from 'n8n-workflow';
import { CrossmintApi } from '../../transport/CrossmintApi';
import { API_VERSIONS, PAGINATION } from '../../utils/constants';
import { validateRequiredField } from '../../utils/validation';
import { ApiResponse } from '../../transport/types';

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

export async function pollOrderStatus(
	context: IExecuteFunctions,
	api: CrossmintApi,
	itemIndex: number,
): Promise<IDataObject> {
	const orderId = context.getNodeParameter('orderId', itemIndex) as string;
	const clientSecret = context.getNodeParameter('clientSecret', itemIndex, '') as string | undefined;
	const waitForCompletion = context.getNodeParameter('waitForCompletion', itemIndex, false) as boolean;

	validateRequiredField(orderId, 'Order ID', context, itemIndex);

	// Get initial order status
	let orderResponse: ApiResponse;
	try {
		orderResponse = await getOrderStatus(api, orderId, clientSecret);
	} catch (error: unknown) {
		throw new NodeApiError(context.getNode(), error as object & { message?: string });
	}

	let orderData = orderResponse as IDataObject;
	const order = (orderData.order as IDataObject | undefined) || orderData;
	const orderObj = order && typeof order === 'object' ? order as IDataObject : orderData;
	const status = (orderObj.status as string | undefined) || ((orderObj.payment as IDataObject | undefined)?.status as string | undefined);

	if (!waitForCompletion) {
		return {
			orderId: orderId,
			status: status,
			order: orderData,
		};
	}

	// Poll until completion
	let currentStatus = status;
	let attempts = 0;
	const maxAttempts = PAGINATION.MAX_ATTEMPTS;
	const pollInterval = PAGINATION.POLL_INTERVAL;

	while (
		(currentStatus === 'awaiting-payment' || 
		 currentStatus === 'pending' || 
		 currentStatus === 'processing') &&
		attempts < maxAttempts
	) {
		attempts++;
		
		// Wait before polling again
		await new Promise(resolve => setTimeout(resolve, pollInterval));

		try {
			orderResponse = await getOrderStatus(api, orderId, clientSecret);
			const updatedOrderData = orderResponse as IDataObject;
			const updatedOrder = (updatedOrderData.order as IDataObject | undefined) || updatedOrderData;
			const updatedOrderObj = updatedOrder && typeof updatedOrder === 'object' ? updatedOrder as IDataObject : updatedOrderData;
			currentStatus = (updatedOrderObj.status as string | undefined) || ((updatedOrderObj.payment as IDataObject | undefined)?.status as string | undefined);
			orderData = updatedOrderData;
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
		order: orderData,
		attempts: attempts,
	};
}

