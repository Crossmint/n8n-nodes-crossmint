import {
	NodeApiError,
	type IDataObject,
	type IWebhookFunctions,
	type JsonObject,
} from 'n8n-workflow';
import type { IPaymentPayload, IPaymentRequirements, PaymentRequirements } from '../../../../transport/types';

// Corbits facilitator integration
const CDP_HOST = 'facilitator.corbits.dev';
const FACILITATOR_SETTLE_PATH = '/settle';

/**
 * Creates correlation header for Corbits API requests
 */
export interface SettleResponse {
	success: boolean;
	txHash?: string;
	error?: string;
	data: IDataObject;
}


export async function settleX402Payment(
	context: IWebhookFunctions,
	paymentPayload: IPaymentPayload,
	paymentRequirements: PaymentRequirements,
	paymentHeader?: string,
): Promise<SettleResponse> {
	// Convert PaymentRequirements class instance to plain object for proper JSON serialization
	const paymentRequirementsObj: IPaymentRequirements = {
		scheme: paymentRequirements.scheme,
		network: paymentRequirements.network,
		maxAmountRequired: paymentRequirements.maxAmountRequired,
		resource: paymentRequirements.resource,
		description: paymentRequirements.description,
		mimeType: paymentRequirements.mimeType,
		outputSchema: paymentRequirements.outputSchema,
		payTo: paymentRequirements.payTo,
		maxTimeoutSeconds: paymentRequirements.maxTimeoutSeconds,
		asset: paymentRequirements.asset,
		extra: paymentRequirements.extra,
	};
	const requestBody = {
		x402Version: typeof paymentPayload.x402Version === 'string' ? parseInt(paymentPayload.x402Version, 10) : paymentPayload.x402Version ?? 1,
		paymentPayload: {
			...paymentPayload,
			x402Version: typeof paymentPayload.x402Version === 'string' ? parseInt(paymentPayload.x402Version, 10) : paymentPayload.x402Version ?? 1,
		},
		paymentRequirements: paymentRequirementsObj,
		...(paymentHeader ? { paymentHeader } : {}),
	};
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
	};


	try {
		console.log('Sending request to Corbits facilitator', {
			url: `https://${CDP_HOST}${FACILITATOR_SETTLE_PATH}`,
			headers,
			body: JSON.stringify(requestBody),
		});

		const res = await fetch(`https://${CDP_HOST}${FACILITATOR_SETTLE_PATH}`, {
			method: 'POST',
			headers,
			body: JSON.stringify(requestBody),
		});

		const responseText = await res.text();
		console.log('Received response from Corbits facilitator', {
			status: res.status,
			statusText: res.statusText,
			headers: Object.fromEntries(res.headers.entries()),
			body: responseText,
		});

		if (!res.ok) {
			const errorPayload: JsonObject = {
				message: `/settle ${res.status}: ${res.statusText}`,
				statusCode: res.status,
				body: responseText,
				headers: Object.fromEntries(res.headers.entries()),
			};
			throw new NodeApiError(context.getNode(), errorPayload);
		}
		const data = JSON.parse(responseText) as IDataObject & {
			success?: boolean;
			transaction?: {
				hash?: string;
			};
			errorReason?: string;
		};

		return {
			success: Boolean(data.success),
			txHash: (data.transaction as IDataObject | undefined)?.hash as string | undefined,
			error: typeof data.errorReason === 'string' ? data.errorReason : undefined,
			data,
		};

	} catch (error) {
		if (error instanceof NodeApiError) {
			throw error;
		}

		throw new NodeApiError(context.getNode(), error as object & { message?: string });
	}
}

