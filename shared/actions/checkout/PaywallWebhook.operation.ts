import { IWebhookFunctions, IWebhookResponseData } from 'n8n-workflow';
import { setupOutputConnection } from '../../utils/webhookUtils';
import { getSupportedTokens, buildPaymentRequirements } from '../../utils/x402/helpers/paymentHelpers';
import { parseXPaymentHeader, validateXPayment } from '../../utils/x402/validation/paymentValidation';
import { requestFacilitatorAccepts, settleX402Payment } from '../../utils/x402/corbits/facilitator/corbitsFacilitator';
import { generateX402Error, generateResponse } from '../../utils/x402/response/paymentResponse';
import type { IPaymentPayload, IPaymentRequirements } from '../../transport/types';

const CORBITS_FACILITATOR_URL = 'https://facilitator.corbits.dev';

export async function webhookTrigger(context: IWebhookFunctions): Promise<IWebhookResponseData> {
	return await handleX402Webhook(context);
}

async function handleX402Webhook(
	context: IWebhookFunctions,
): Promise<IWebhookResponseData> {
	const responseMode = context.getNodeParameter('responseMode', 'onReceived') as string;

	const headers = context.getHeaderData();
	const req = context.getRequestObject();
	const resp = context.getResponseObject();
	const requestMethod = req.method;

	context.logger?.info('Paywall webhook request received', {
		method: requestMethod,
		headers,
		body: req.body,
	});

	const prepareOutput = setupOutputConnection(context, requestMethod, {});

	// Get Crossmint API credentials
	const credentials = await context.getCredentials('crossmintApi');
	if (!credentials) {
		resp.writeHead(403);
		resp.end('crossmintApi credential not found');
		return { noWebhookResponse: true };
	}

	// Get environment to determine network (staging: solana-devnet, production: solana-mainnet-beta)
	const environment = (credentials as unknown as { environment?: string } | undefined)?.environment;

	const supportedTokens = getSupportedTokens(environment);

	// Get configured payment tokens from node parameters
	const configuredTokens = context.getNodeParameter('tokens') as {
		paymentToken: { paymentToken: string; payToAddress: string; paymentAmount: number }[];
	};

	const resourceDescription = 'n8n workflow webhook';
	const mimeType = 'application/json';

	const responseData = context.getNodeParameter('responseData') as string;

	const webhookUrl = context.getNodeWebhookUrl('default');
	if (webhookUrl == null) {
		resp.writeHead(403);
		resp.end('webhookUrl not found');
		return { noWebhookResponse: true };
	}

	// Build payment requirements from configured tokens
	const paymentRequirements = buildPaymentRequirements(
		configuredTokens.paymentToken,
		supportedTokens,
		webhookUrl,
		resourceDescription,
		mimeType,
		resp,
	);
	if (paymentRequirements == null) return { noWebhookResponse: true };

	const facilitatorRequirements = await requestFacilitatorAccepts(context, CORBITS_FACILITATOR_URL, paymentRequirements, webhookUrl);
	const facilitatorAccepts = facilitatorRequirements.accepts;

	// Check for X-PAYMENT header
	const xPaymentHeader = headers['x-payment'];
	if (xPaymentHeader == null || typeof xPaymentHeader !== 'string') {
		context.logger?.warn('Paywall webhook missing x-payment header');
		return generateX402Error(resp, 'No x-payment header provided', facilitatorAccepts);
	}

	// Process payment: decode, validate, verify, and settle
	try {
		const decodedXPaymentJson = parseXPaymentHeader(xPaymentHeader);

		const validation = validateXPayment(decodedXPaymentJson);
		if (validation != 'valid') {
			resp.writeHead(402, { 'Content-Type': 'application/json' });
			resp.end(
				JSON.stringify({
					x402Version: 1,
					accepts: facilitatorAccepts,
				}),
			);
			return { noWebhookResponse: true };
		}

		const matchingRequirement = findMatchingFacilitatorRequirement(decodedXPaymentJson, facilitatorAccepts);
		if (!matchingRequirement) {
			return generateX402Error(
				resp,
				'Unable to find matching payment requirement for provided x-payment header',
				facilitatorAccepts,
			);
		}

		// Settle payment with facilitator (continue on error to avoid blocking workflow)
		try {
			const settleResponse = await settleX402Payment(
				context,
				CORBITS_FACILITATOR_URL,
				decodedXPaymentJson,
				matchingRequirement,
				xPaymentHeader,
			);

			if (!settleResponse.success) {
				resp.writeHead(402, { 'Content-Type': 'application/json' });
				resp.end(
					JSON.stringify({
						x402Version: 1,
						accepts: facilitatorAccepts,
					}),
				);
				return { noWebhookResponse: true };
			}

			// Return workflow data with settlement details
			return generateResponse(
				context,
				req,
				responseMode,
				responseData,
				prepareOutput,
				decodedXPaymentJson.network,
				settleResponse.data,
			);
		} catch (error) {
			context.logger.error('Error in x402 webhook settlement', error);
			const errorMessage = error instanceof Error ? error.message : String(error);

			resp.writeHead(402, { 'Content-Type': 'application/json' });
			resp.end(
				JSON.stringify({
					x402Version: 1,
					error: `Settlement failed: ${errorMessage}`,
					accepts: facilitatorAccepts,
				}),
			);
			return { noWebhookResponse: true };
		}
	} catch (error) {
		context.logger.error('Error in x402 webhook', error);
		const errorMessage = error instanceof Error ? error.message : String(error);

		return generateX402Error(resp, `Payment processing error: ${errorMessage}`, facilitatorAccepts);
	}
}

function findMatchingFacilitatorRequirement(
	payment: IPaymentPayload,
	requirements: IPaymentRequirements[],
): IPaymentRequirements | undefined {
	return requirements.find((req) => {
		const schemeMatches = req.scheme === payment.scheme;
		const networkMatches = req.network === payment.network;
		const assetMatches = payment.asset ? req.asset === payment.asset : true;
		return schemeMatches && networkMatches && assetMatches;
	});
}
