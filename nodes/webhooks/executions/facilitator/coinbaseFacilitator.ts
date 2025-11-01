import type { IWebhookFunctions } from 'n8n-workflow';
import { buildCdpJwtAsync } from '../crypto/CoinbaseJWT';
import type { IPaymentPayload, IPaymentRequirements, PaymentRequirements } from '../types/x402Types';

// Coinbase CDP facilitator integration
const CDP_HOST = 'api.cdp.coinbase.com';
const FACILITATOR_VERIFY_PATH = '/platform/v2/x402/verify';
const FACILITATOR_SETTLE_PATH = '/platform/v2/x402/settle';

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
	// For verify, paymentPayload.x402Version should be a string (same as settle)
	// IMPORTANT: Preserve all fields including value exactly as received - do not modify
	const paymentPayloadForVerify = {
		x402Version: String(paymentPayload.x402Version),
		scheme: paymentPayload.scheme,
		network: paymentPayload.network,
		payload: {
			authorization: {
				from: paymentPayload.payload.authorization.from,
				to: paymentPayload.payload.authorization.to,
				value: paymentPayload.payload.authorization.value, // Preserve exactly as-is (lamports for Solana)
				validAfter: paymentPayload.payload.authorization.validAfter,
				validBefore: paymentPayload.payload.authorization.validBefore,
				nonce: paymentPayload.payload.authorization.nonce,
			},
			signature: paymentPayload.payload.signature,
		},
	};
	const requestBody = {
		x402Version: String(paymentPayload.x402Version ?? 1),
		paymentPayload: paymentPayloadForVerify,
		paymentRequirements: paymentRequirementsObj,
	};
	const requestDataStr = JSON.stringify(requestBody, null, 2);

	// Log JSON being sent to Coinbase facilitator (verify)
	const sendingLog = `=== SENDING TO COINBASE FACILITATOR (VERIFY) ===\nAuthorization: Bearer ${token}\n\n${requestDataStr}`;
	if (logger) {
		logger.info(sendingLog);
	}
	console.log(sendingLog);

	const res = await fetch(`https://${CDP_HOST}${FACILITATOR_VERIFY_PATH}`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json',
			Accept: 'application/json',
		},
		body: JSON.stringify(requestBody),
	});

	const responseText = await res.text();

	// Log JSON received from Coinbase facilitator (verify)
	const receivedLog = `=== RECEIVED FROM COINBASE FACILITATOR (VERIFY) ===\nStatus: ${res.status} ${res.statusText}\nResponse: ${responseText}`;
	if (logger) {
		logger.info(receivedLog);
	}
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
	// For settle, paymentPayload.x402Version should be a string (verify uses number)
	// IMPORTANT: Preserve all fields including value exactly as received - do not modify
	const paymentPayloadForSettle = {
		x402Version: String(paymentPayload.x402Version),
		scheme: paymentPayload.scheme,
		network: paymentPayload.network,
		payload: {
			authorization: {
				from: paymentPayload.payload.authorization.from,
				to: paymentPayload.payload.authorization.to,
				value: paymentPayload.payload.authorization.value, // Preserve exactly as-is (lamports for Solana)
				validAfter: paymentPayload.payload.authorization.validAfter,
				validBefore: paymentPayload.payload.authorization.validBefore,
				nonce: paymentPayload.payload.authorization.nonce,
			},
			signature: paymentPayload.payload.signature,
		},
	};
	const requestBody = {
		x402Version: String(paymentPayload.x402Version ?? 1),
		paymentPayload: paymentPayloadForSettle,
		paymentRequirements: paymentRequirementsObj,
	};
	const requestDataStr = JSON.stringify(requestBody, null, 2);

	// Log JSON being sent to Coinbase facilitator (settle)
	const sendingLog = `=== SENDING TO COINBASE FACILITATOR (SETTLE) ===\nAuthorization: Bearer ${token}\n\n${requestDataStr}`;
	if (logger) {
		logger.info(sendingLog);
	}
	console.log(sendingLog);

	const res = await fetch(`https://${CDP_HOST}${FACILITATOR_SETTLE_PATH}`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json',
			Accept: 'application/json',
		},
		body: JSON.stringify(requestBody),
	});

	const responseText = await res.text();

	// Log JSON received from Coinbase facilitator (settle)
	const receivedLog = `=== RECEIVED FROM COINBASE FACILITATOR (SETTLE) ===\nStatus: ${res.status} ${res.statusText}\nResponse: ${responseText}`;
	if (logger) {
		logger.info(receivedLog);
	}
	console.log(receivedLog);

	if (!res.ok) {
		throw new Error(`/settle ${res.status}: ${responseText}`);
	}
	const data = JSON.parse(responseText) as { success: boolean; transaction?: { hash?: string } } &
		Record<string, any>;
	return { success: data.success, txHash: data.transaction?.hash, error: data['errorReason'] };
}

