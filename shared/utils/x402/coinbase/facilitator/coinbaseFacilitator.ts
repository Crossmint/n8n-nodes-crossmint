import type { IWebhookFunctions } from 'n8n-workflow';
import { buildCdpJwtAsync } from '../CoinbaseJWT';
import type { IPaymentPayload, IPaymentRequirements, PaymentRequirements } from '../../../../transport/types';

// Coinbase CDP facilitator integration
const CDP_HOST = 'api.cdp.coinbase.com';
const FACILITATOR_VERIFY_PATH = '/platform/v2/x402/verify';
const FACILITATOR_SETTLE_PATH = '/platform/v2/x402/settle';

/**
 * Creates correlation header for Coinbase API requests
 */
function createCorrelationHeader(): string {
	const data: Record<string, string> = {
		sdk_version: '1.29.0',
		sdk_language: 'typescript',
		source: 'x402',
		source_version: '0.7.1',
	};
	return Object.keys(data)
		.map(key => `${key}=${encodeURIComponent(data[key])}`)
		.join(',');
}

export async function verifyX402Payment(
	apiKeyId: string,
	apiKeySecret: string,
	paymentPayload: IPaymentPayload,
	paymentRequirements: PaymentRequirements,
	logger?: IWebhookFunctions['logger'],
): Promise<{ isValid: boolean; invalidReason?: string }> {
	const token = await buildCdpJwtAsync({
		apiKeyId,
		apiKeySecret,
		method: 'POST',
		host: CDP_HOST,
		path: FACILITATOR_VERIFY_PATH,
	});
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
	};
	const requestDataStr = JSON.stringify(requestBody, null, 2);

	// Log JSON being sent to Coinbase facilitator (verify)
	const sendingLog = `=== SENDING TO COINBASE FACILITATOR (VERIFY) ===\nAuthorization: Bearer ${token}\n\n${requestDataStr}`;
	console.log(sendingLog);

	const correlationHeader = createCorrelationHeader();
	const res = await fetch(`https://${CDP_HOST}${FACILITATOR_VERIFY_PATH}`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`,
			'Correlation-Context': correlationHeader,
		},
		body: JSON.stringify(requestBody),
	});

	const responseText = await res.text();

	// Log raw response from Coinbase facilitator (verify) - print immediately before any processing
	console.log(`=== RAW RESPONSE FROM COINBASE FACILITATOR (VERIFY) ===`);
	console.log(`Status Code: ${res.status}`);
	console.log(`Status Text: ${res.statusText}`);
	console.log(`Raw Response Body:`, responseText);
	console.log(`Response Headers:`, JSON.stringify(Object.fromEntries(res.headers.entries()), null, 2));

	// Log JSON received from Coinbase facilitator (verify)
	const receivedLog = `=== RECEIVED FROM COINBASE FACILITATOR (VERIFY) ===\nStatus: ${res.status} ${res.statusText}\nResponse: ${responseText}`;
	console.log(receivedLog);

	if (!res.ok) {
		throw new Error(`/verify ${res.status}: ${responseText}`);
	}
	return JSON.parse(responseText) as { isValid: boolean; invalidReason?: string };
}

export async function settleX402Payment(
	apiKeyId: string,
	apiKeySecret: string,
	paymentPayload: IPaymentPayload,
	paymentRequirements: PaymentRequirements,
	logger?: IWebhookFunctions['logger'],
): Promise<{ success: boolean; txHash?: string; error?: string }> {
	const token = await buildCdpJwtAsync({
		apiKeyId,
		apiKeySecret,
		method: 'POST',
		host: CDP_HOST,
		path: FACILITATOR_SETTLE_PATH,
	});
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
	};
	const requestDataStr = JSON.stringify(requestBody, null, 2);

	// Log JSON being sent to Coinbase facilitator (settle)
	const sendingLog = `=== SENDING TO COINBASE FACILITATOR (SETTLE) ===\nAuthorization: Bearer ${token}\n\n${requestDataStr}`;
	console.log(sendingLog);

	const correlationHeader = createCorrelationHeader();
	const res = await fetch(`https://${CDP_HOST}${FACILITATOR_SETTLE_PATH}`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`,
			'Correlation-Context': correlationHeader,
		},
		body: JSON.stringify(requestBody),
	});

	const responseText = await res.text();

	// Log raw response from Coinbase facilitator (settle) - print immediately before any processing
	console.log(`=== RAW RESPONSE FROM COINBASE FACILITATOR (SETTLE) ===`);
	console.log(`Status Code: ${res.status}`);
	console.log(`Status Text: ${res.statusText}`);
	console.log(`Raw Response Body:`, responseText);
	console.log(`Response Headers:`, JSON.stringify(Object.fromEntries(res.headers.entries()), null, 2));

	// Log JSON received from Coinbase facilitator (settle)
	const receivedLog = `=== RECEIVED FROM COINBASE FACILITATOR (SETTLE) ===\nStatus: ${res.status} ${res.statusText}\nResponse: ${responseText}`;
	console.log(receivedLog);

	if (!res.ok) {
		throw new Error(`/settle ${res.status}: ${responseText}`);
	}
	const data = JSON.parse(responseText) as { success: boolean; transaction?: { hash?: string } } &
		Record<string, any>;
	return { success: data.success, txHash: data.transaction?.hash, error: data['errorReason'] };
}

