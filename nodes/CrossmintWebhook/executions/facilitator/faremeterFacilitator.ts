import type { IPaymentPayload, IPaymentRequirements, PaymentRequirements } from '../types/x402Types';
import type { IFacilitator } from './IFacilitator';

const FAREMETER_HOST = 'api.faremeter.com';
const FACILITATOR_VERIFY_PATH = '/v1/x402/verify';
const FACILITATOR_SETTLE_PATH = '/v1/x402/settle';

export class FaremeterFacilitator implements IFacilitator {
	constructor() {}

	async verifyPayment(
		paymentPayload: IPaymentPayload,
		paymentRequirements: PaymentRequirements,
	): Promise<{ isValid: boolean; invalidReason?: string }> {
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

		console.log(`=== SENDING TO FAREMETER FACILITATOR (VERIFY) ===\n${requestDataStr}`);
		const verifyUrl = `https://${FAREMETER_HOST}${FACILITATOR_VERIFY_PATH}`;
		console.log(`=== Fetch URL: ${verifyUrl} ===`);

		let res: Response;
		try {
			res = await fetch(verifyUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Accept': 'application/json',
				},
				body: JSON.stringify(requestBody),
			});
		} catch (fetchError) {
			console.log(`=== FETCH ERROR (VERIFY) ===`);
			console.log('Error type:', fetchError?.constructor?.name);
			console.log('Error message:', fetchError instanceof Error ? fetchError.message : String(fetchError));
			console.log('Error stack:', fetchError instanceof Error ? fetchError.stack : 'No stack trace');
			console.log('Error cause:', (fetchError as any)?.cause);
			throw fetchError;
		}

		const responseText = await res.text();

		console.log(`=== RAW RESPONSE FROM FAREMETER FACILITATOR (VERIFY) ===`);
		console.log(`Status Code: ${res.status}`);
		console.log(`Status Text: ${res.statusText}`);
		console.log(`Raw Response Body:`, responseText);
		console.log(`Response Headers:`, JSON.stringify(Object.fromEntries(res.headers.entries()), null, 2));

		const receivedLog = `=== RECEIVED FROM FAREMETER FACILITATOR (VERIFY) ===\nStatus: ${res.status} ${res.statusText}\nResponse: ${responseText}`;
		console.log(receivedLog);

		if (!res.ok) {
			throw new Error(`/verify ${res.status}: ${responseText}`);
		}

		const parsedResponse = JSON.parse(responseText) as { isValid: boolean; invalidReason?: string };
		console.log(`=== PARSED RESPONSE FROM FAREMETER FACILITATOR (VERIFY) ===`);
		console.log(JSON.stringify(parsedResponse, null, 2));
		
		return parsedResponse;
	}

	async settlePayment(
		paymentPayload: IPaymentPayload,
		paymentRequirements: PaymentRequirements,
	): Promise<{ success: boolean; txHash?: string; error?: string }> {
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

		console.log(`=== SENDING TO FAREMETER FACILITATOR (SETTLE) ===\n${requestDataStr}`);
		const settleUrl = `https://${FAREMETER_HOST}${FACILITATOR_SETTLE_PATH}`;
		console.log(`=== Fetch URL: ${settleUrl} ===`);

		let res: Response;
		try {
			res = await fetch(settleUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Accept': 'application/json',
				},
				body: JSON.stringify(requestBody),
			});
		} catch (fetchError) {
			console.log(`=== FETCH ERROR (SETTLE) ===`);
			console.log('Error type:', fetchError?.constructor?.name);
			console.log('Error message:', fetchError instanceof Error ? fetchError.message : String(fetchError));
			console.log('Error stack:', fetchError instanceof Error ? fetchError.stack : 'No stack trace');
			console.log('Error cause:', (fetchError as any)?.cause);
			throw fetchError;
		}

		const responseText = await res.text();

		console.log(`=== RAW RESPONSE FROM FAREMETER FACILITATOR (SETTLE) ===`);
		console.log(`Status Code: ${res.status}`);
		console.log(`Status Text: ${res.statusText}`);
		console.log(`Raw Response Body:`, responseText);
		console.log(`Response Headers:`, JSON.stringify(Object.fromEntries(res.headers.entries()), null, 2));

		const receivedLog = `=== RECEIVED FROM FAREMETER FACILITATOR (SETTLE) ===\nStatus: ${res.status} ${res.statusText}\nResponse: ${responseText}`;
		console.log(receivedLog);

		if (!res.ok) {
			throw new Error(`/settle ${res.status}: ${responseText}`);
		}

		const parsedResponse = JSON.parse(responseText) as { success: boolean; transaction?: { hash?: string }; errorReason?: string };
		console.log(`=== PARSED RESPONSE FROM FAREMETER FACILITATOR (SETTLE) ===`);
		console.log(JSON.stringify(parsedResponse, null, 2));
		
		const result = { success: parsedResponse.success, txHash: parsedResponse.transaction?.hash, error: parsedResponse.errorReason };
		console.log(`=== PROCESSED SETTLE RESULT ===`);
		console.log(JSON.stringify(result, null, 2));
		
		return result;
	}
}
