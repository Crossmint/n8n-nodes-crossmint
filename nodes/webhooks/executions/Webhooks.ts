import {
	IDataObject,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';
import { setupOutputConnection } from '../utils/webhookUtils';
import { getSupportedTokens, buildPaymentRequirements } from './helpers/paymentHelpers';
import { parseXPaymentHeader, validateXPayment, verifyPaymentDetails } from './validation/paymentValidation';
import { verifyX402Payment, settleX402Payment } from './facilitator/coinbaseFacilitator';
import { generateX402Error, generateResponse } from './response/paymentResponse';

export async function webhookTrigger(this: IWebhookFunctions): Promise<IWebhookResponseData> {
	console.log("AAAAAAAA");
	const body = this.getBodyData();
	return await handleX402Webhook.call(this, body);
}

async function handleX402Webhook(
	this: IWebhookFunctions,
	_body: IDataObject,
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

	// Coinbase credentials (apiKeyId/apiKeySecret) are required for x402 processing
	const coinbaseKeyId = (credentials as any).apiKeyId as string | undefined;
	const coinbaseKeySecret = (credentials as any).apiKeySecret as string | undefined;
	if (!coinbaseKeyId || !coinbaseKeySecret) {
		resp.writeHead(403);
		resp.end('crossmintApi credential missing Coinbase apiKeyId or apiKeySecret');
		return { noWebhookResponse: true };
	}

	// Get environment to determine network (staging uses solana-devnet, production uses solana)
	const environment = (credentials as any).environment as string | undefined;

	const supportedTokens = getSupportedTokens(environment);

	// We need to figure out which of the tokens have been configured for this node
	const configuredTokens = this.getNodeParameter('tokens') as {
		paymentToken: { paymentToken: string; payToAddress: string; paymentAmount: number }[];
	};

	const resourceDescription = ''; // By default (No options in node)
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
		const decodedXPaymentJson = parseXPaymentHeader(xPaymentHeader);

		const validation = validateXPayment(decodedXPaymentJson);
		if (validation != 'valid') {
			resp.writeHead(402, { 'Content-Type': 'application/json' });
			resp.end(
				JSON.stringify({
					error: {
						errorMessage: 'x-payment header is not valid',
						paymentConfigs: paymentRequirements,
					},
				}),
			);
			return { noWebhookResponse: true };
		}

		const verification = verifyPaymentDetails(decodedXPaymentJson, paymentRequirements);
		if (!verification.valid) {
			return generateX402Error(
				resp,
				`x-payment header is not valid for reasons: ${verification.errors}`,
				paymentRequirements,
			);
		}

		// Looks like everything is valid, now we'll verify the payment via Crossmint API.
		// We need to get the actual payment config- there's only one per network.
		// Problem with the x402 spec is that they don't send the actual token address.
		// So we need to find the config that matches the network, there should be only 1,
		// and we use that.

		const verifyResponse = await verifyX402Payment(
			coinbaseKeyId!,
			coinbaseKeySecret!,
			decodedXPaymentJson,
			verification.paymentRequirements!,
			this.logger,
		);

		if (!verifyResponse.isValid) {
			return generateX402Error(
				resp,
				`x-payment verification failed: ${verifyResponse.invalidReason}`,
				paymentRequirements,
			);
		}

		// If the verification is valid, we are going to be a little optimistic about the settlement. Since this can take a while, if the method errors,
		// (such as from a Cloudflare 502), we'll move on and assume it's successful.

		try {
			const settleResponse = await settleX402Payment(
				coinbaseKeyId!,
				coinbaseKeySecret!,
				decodedXPaymentJson,
				verification.paymentRequirements!,
				this.logger,
			);

			if (!settleResponse.success) {
				resp.writeHead(402, { 'Content-Type': 'application/json' });
				resp.end(
					JSON.stringify({
						error: {
							errorMessage: `x-payment settlement failed: ${settleResponse.error}`,
						},
					}),
				);
				return { noWebhookResponse: true };
			}

			// Payment is settled, now we need to return the workflow data
			return generateResponse(
				this,
				req,
				responseMode,
				responseData,
				settleResponse.txHash ?? 'UNKNOWN_TX',
				prepareOutput,
			);
		} catch (error) {
			this.logger.error('Error in x402 webhook settlement, moving on...', error);
			return generateResponse(this, req, responseMode, responseData, 'TBD', prepareOutput);
		}
	} catch (error) {
		this.logger.error('Error in x402 webhook', error);
		// Return an error object if parsing/verification fails
		const errorMessage = error instanceof Error ? error.message : String(error);
		// Check if it's a credential/JWT error (happens before payment verification)
		if (
			errorMessage.includes('Ed25519') ||
			errorMessage.includes('secret') ||
			errorMessage.includes('key') ||
			errorMessage.includes('DECODER') ||
			errorMessage.includes('Invalid private key format') ||
			errorMessage.includes('Failed to sign JWT')
		) {
			resp.writeHead(500, { 'Content-Type': 'application/json' });
			resp.end(
				JSON.stringify({ error: { errorMessage: `Coinbase credential error: ${errorMessage}` } }),
			);
			return { noWebhookResponse: true };
		}
		return generateX402Error(resp, `Payment processing error: ${errorMessage}`, paymentRequirements);
	}
}
