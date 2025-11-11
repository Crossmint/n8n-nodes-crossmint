import type { IDataObject } from 'n8n-workflow';
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
	const requestDataStr = JSON.stringify(requestBody, null, 2);

	// Log JSON being sent to Corbits facilitator (settle)
	const sendingLog = `=== SENDING TO CORBITS FACILITATOR (SETTLE) ===\n${requestDataStr}`;
	console.log(sendingLog);

	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
	};

	const res = await fetch(`https://${CDP_HOST}${FACILITATOR_SETTLE_PATH}`, {
		method: 'POST',
		headers,
		body: JSON.stringify(requestBody),
	});

	const responseText = await res.text();

	// Log raw response from Corbits facilitator (settle) - print immediately before any processing
	console.log(`=== RAW RESPONSE FROM CORBITS FACILITATOR (SETTLE) ===`);
	console.log(`Status Code: ${res.status}`);
	console.log(`Status Text: ${res.statusText}`);
	console.log(`Raw Response Body:`, responseText);
	console.log(`Response Headers:`, JSON.stringify(Object.fromEntries(res.headers.entries()), null, 2));

	// Log JSON received from Corbits facilitator (settle)
	const receivedLog = `=== RECEIVED FROM CORBITS FACILITATOR (SETTLE) ===\nStatus: ${res.status} ${res.statusText}\nResponse: ${responseText}`;
	console.log(receivedLog);

	if (!res.ok) {
		throw new Error(`/settle ${res.status}: ${responseText}`);
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
}

