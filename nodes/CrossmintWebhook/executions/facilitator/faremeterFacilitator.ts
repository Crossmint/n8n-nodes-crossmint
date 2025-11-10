import type { IPaymentPayload, PaymentRequirements } from '../types/x402Types';
import type { IFacilitator } from './IFacilitator';

const FAREMETER_BASE_URL = 'http://localhost:3000/api/v1';
const FACILITATOR_VERIFY_PATH = '/faremeter/verify';
const FACILITATOR_SETTLE_PATH = '/faremeter/settle';

export class FaremeterFacilitator implements IFacilitator {
	constructor() {}

	async verifyPayment(
		paymentPayload: IPaymentPayload,
		paymentRequirements: PaymentRequirements,
	): Promise<{ isValid: boolean; invalidReason?: string }> {
		// Format for your local Faremeter API
		const requestBody = {
			facilitatorUrl: 'https://facilitator.corbits.dev',
			resource: paymentRequirements.resource,
			accepts: [
				{
					scheme: paymentRequirements.scheme,
					network: paymentRequirements.network,
					payTo: paymentRequirements.payTo,
					asset: paymentRequirements.asset,
					maxAmountRequired: paymentRequirements.maxAmountRequired,
					description: paymentRequirements.description,
					mimeType: paymentRequirements.mimeType,
					maxTimeoutSeconds: paymentRequirements.maxTimeoutSeconds,
				},
			],
		};

		const requestDataStr = JSON.stringify(requestBody, null, 2);

		console.log(`=== SENDING TO FAREMETER FACILITATOR (VERIFY) ===\n${requestDataStr}`);
		const verifyUrl = `${FAREMETER_BASE_URL}${FACILITATOR_VERIFY_PATH}`;
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

		const parsedResponse = JSON.parse(responseText) as { 
			paymentValid?: boolean; 
			message?: string;
			middlewareResponse?: any;
			paymentResponse?: { status: number; body: any };
		};
		console.log(`=== PARSED RESPONSE FROM FAREMETER FACILITATOR (VERIFY) ===`);
		console.log(JSON.stringify(parsedResponse, null, 2));
		
		// Map your API response to expected format
		// Your API returns { paymentResponse: { status: 402/200, body: ... } }
		const isValid = parsedResponse.paymentResponse?.status === 200 || parsedResponse.paymentValid === true;
		
		return {
			isValid,
			invalidReason: isValid ? undefined : (parsedResponse.message || 'Payment validation failed'),
		};
	}

	async settlePayment(
		paymentPayload: IPaymentPayload,
		paymentRequirements: PaymentRequirements,
	): Promise<{ success: boolean; txHash?: string; error?: string }> {
		// Encode the payment payload as base64 for x-payment header
		const paymentHeaderValue = Buffer.from(JSON.stringify(paymentPayload)).toString('base64');
		
		// Format for your local Faremeter API settle endpoint
		const requestBody = {
			paytoAddress: paymentRequirements.payTo,
			facilitatorUrl: 'https://facilitator.corbits.dev',
			scheme: paymentRequirements.scheme,
			network: paymentRequirements.network,
			asset: paymentRequirements.asset,
			resource: paymentRequirements.resource,
			paymentAmount: parseFloat(paymentRequirements.maxAmountRequired) / 1000000, // Convert atomic units to USDC
			description: paymentRequirements.description,
			paymentHeaders: {
				'x-payment': paymentHeaderValue,
			},
		};

		const requestDataStr = JSON.stringify(requestBody, null, 2);

		console.log(`=== SENDING TO FAREMETER FACILITATOR (SETTLE) ===\n${requestDataStr}`);
		const settleUrl = `${FAREMETER_BASE_URL}${FACILITATOR_SETTLE_PATH}`;
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

		const parsedResponse = JSON.parse(responseText) as { 
			success: boolean; 
			paymentValid: boolean;
			message: string;
			data?: { settlementId?: string; timestamp?: string; amount?: number };
		};
		console.log(`=== PARSED RESPONSE FROM FAREMETER FACILITATOR (SETTLE) ===`);
		console.log(JSON.stringify(parsedResponse, null, 2));
		
		// Map your API response to expected format
		const result = { 
			success: parsedResponse.success && parsedResponse.paymentValid, 
			txHash: parsedResponse.data?.settlementId, 
			error: parsedResponse.success ? undefined : parsedResponse.message,
		};
		console.log(`=== PROCESSED SETTLE RESULT ===`);
		console.log(JSON.stringify(result, null, 2));
		
		return result;
	}
}
