import {
	IDataObject,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';
import { setupOutputConnection } from '../utils/webhookUtils';
import { getSupportedTokens, buildPaymentRequirements } from './helpers/paymentHelpers';
import { parseXPaymentHeader, validateXPayment, verifyPaymentDetails } from './validation/paymentValidation';
import { FaremeterFacilitator } from './facilitator/faremeterFacilitator';
import { generateX402Error, generateResponse } from './response/paymentResponse';

export async function webhookTrigger(this: IWebhookFunctions): Promise<IWebhookResponseData> {
	return await handleX402Webhook.call(this);
}

async function handleX402Webhook(
	this: IWebhookFunctions,
): Promise<IWebhookResponseData> {
	const responseMode = this.getNodeParameter('responseMode', 'onReceived') as string;

	const headers = this.getHeaderData();
	const req = this.getRequestObject();
	const resp = this.getResponseObject();
	const requestMethod = this.getRequestObject().method;

	const prepareOutput = setupOutputConnection(this, requestMethod, {
		// jwtPayload: validationData,
	});

	// Get the credential data (always available since it's required at node level)
	const credentials = await this.getCredentials('crossmintApi');
	if (!credentials) {
		// This is an example of direct response with Express
		resp.writeHead(403);
		resp.end('crossmintApi credential not found');
		return { noWebhookResponse: true };
	}

	const facilitator = new FaremeterFacilitator();

	// Get environment to determine network (staging uses base-sepolia, production uses base)
	const environment = (credentials as IDataObject).environment as string | undefined;

	const supportedTokens = getSupportedTokens(environment);

	// We need to figure out which of the tokens have been configured for this node
	const configuredTokens = this.getNodeParameter('tokens') as {
		paymentToken: { paymentToken: string; payToAddress: string; paymentAmount: number }[];
	};

	const resourceDescription = 'n8n workflow webhook';
	const mimeType = 'application/json'; // By default (No options in node)

	const responseData = this.getNodeParameter('responseData') as string;

	const webhookUrl = this.getNodeWebhookUrl('default');
	if (webhookUrl == null) {
		resp.writeHead(403);
		resp.end('webhookUrl not found');
		return { noWebhookResponse: true };
	}

	// Build normalized payment requirements, enforcing uniqueness per network
	const paymentRequirements = buildPaymentRequirements(
		configuredTokens.paymentToken,
		supportedTokens,
		webhookUrl,
		resourceDescription,
		mimeType,
		resp,
	);
	if (paymentRequirements == null) return { noWebhookResponse: true };

	// If there's no x-payment header, return a 402 error with payment details
	const xPaymentHeader = headers['x-payment'];
	if (xPaymentHeader == null || typeof xPaymentHeader !== 'string') {
		return generateX402Error(resp, 'No x-payment header provided', paymentRequirements);
	}

	// try to decode the x-payment header if it exists
	try {
		console.log('=== STEP 1: Parsing x-payment header ===');
		const decodedXPaymentJson = parseXPaymentHeader(xPaymentHeader);
		console.log('=== Parsed x-payment header ===');
		console.log(JSON.stringify(decodedXPaymentJson, null, 2));

		console.log('=== STEP 2: Validating x-payment structure ===');
		const validation = validateXPayment(decodedXPaymentJson);
		if (validation != 'valid') {
			console.log(`=== Validation failed: ${validation} ===`);
			resp.writeHead(402, { 'Content-Type': 'application/json' });
			resp.end(
				JSON.stringify({
					x402Version: 1,
					accepts: paymentRequirements,
				}),
			);
			return { noWebhookResponse: true };
		}
		console.log('=== Validation passed ===');

		console.log('=== STEP 3: Verifying payment details ===');
		const verification = verifyPaymentDetails(decodedXPaymentJson, paymentRequirements);
		if (!verification.valid) {
			console.log(`=== Payment details verification failed: ${verification.errors} ===`);
			return generateX402Error(
				resp,
				`x-payment header is not valid for reasons: ${verification.errors}`,
				paymentRequirements,
			);
		}
		console.log('=== Payment details verification passed ===');
		console.log('=== Payment requirements used ===');
		console.log(JSON.stringify(verification.paymentRequirements, null, 2));

		// Looks like everything is valid, now we'll verify the payment via Crossmint API.
		// We need to get the actual payment config- there's only one per network.
		// Problem with the x402 spec is that they don't send the actual token address.
		// So we need to find the config that matches the network, there should be only 1,
		// and we use that.

		console.log('=== STEP 4: Calling facilitator.verifyPayment ===');
		const verifyResponse = await facilitator.verifyPayment(
			decodedXPaymentJson,
			verification.paymentRequirements!,
		);
		console.log('=== Facilitator verifyPayment response ===');
		console.log(JSON.stringify(verifyResponse, null, 2));

		if (!verifyResponse.isValid) {
			console.log(`=== Verification failed: ${verifyResponse.invalidReason} ===`);
			return generateX402Error(
				resp,
				`x-payment verification failed: ${verifyResponse.invalidReason}`,
				paymentRequirements,
			);
		}
		console.log('=== Verification passed ===');

		// If the verification is valid, we are going to be a little optimistic about the settlement. Since this can take a while, if the method errors,
		// (such as from a Cloudflare 502), we'll move on and assume it's successful.

		try {
			console.log('=== STEP 5: Calling facilitator.settlePayment ===');
			const settleResponse = await facilitator.settlePayment(
				decodedXPaymentJson,
				verification.paymentRequirements!,
			);
			console.log('=== Facilitator settlePayment response ===');
			console.log(JSON.stringify(settleResponse, null, 2));

			if (!settleResponse.success) {
				console.log(`=== Settlement failed: ${settleResponse.error} ===`);
				resp.writeHead(402, { 'Content-Type': 'application/json' });
				resp.end(
					JSON.stringify({
						x402Version: 1,
						accepts: paymentRequirements,
					}),
				);
				return { noWebhookResponse: true };
			}
			console.log('=== Settlement successful ===');

			// Payment is settled, now we need to return the workflow data
			console.log('=== STEP 6: Generating response ===');
			return generateResponse(
				this,
				req,
				responseMode,
				responseData,
				settleResponse.txHash ?? 'UNKNOWN_TX',
				prepareOutput,
				decodedXPaymentJson.network,
			);
		} catch (error) {
			console.log('=== ERROR in settlement step ===');
			console.log('Error type:', error?.constructor?.name);
			console.log('Error message:', error instanceof Error ? error.message : String(error));
			console.log('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
			this.logger.error('Error in x402 webhook settlement, moving on...', error);
			return generateResponse(this, req, responseMode, responseData, 'TBD', prepareOutput, decodedXPaymentJson?.network);
		}
	} catch (error) {
		console.log('=== ERROR in x402 webhook processing ===');
		console.log('Error type:', error?.constructor?.name);
		console.log('Error message:', error instanceof Error ? error.message : String(error));
		console.log('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
		this.logger.error('Error in x402 webhook', error);
		const errorMessage = error instanceof Error ? error.message : String(error);
		if (
			errorMessage.includes('secret') ||
			errorMessage.includes('key') ||
			errorMessage.includes('credential') ||
			errorMessage.includes('authentication')
		) {
			resp.writeHead(500, { 'Content-Type': 'application/json' });
			resp.end(
				JSON.stringify({ error: { errorMessage: `Facilitator credential error: ${errorMessage}` } }),
			);
			return { noWebhookResponse: true };
		}
		return generateX402Error(resp, `Payment processing error: ${errorMessage}`, paymentRequirements);
	}
}
