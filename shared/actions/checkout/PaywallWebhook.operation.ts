import { IWebhookFunctions, IWebhookResponseData } from 'n8n-workflow';
import { setupOutputConnection } from '../../utils/webhookUtils';
import { getSupportedTokens, buildPaymentRequirements } from '../../utils/x402/helpers/paymentHelpers';
import { parseXPaymentHeader, validateXPayment, verifyPaymentDetails } from '../../utils/x402/validation/paymentValidation';
import { settleX402Payment, enrichPaymentRequirements } from '../../utils/x402/corbits/facilitator/corbitsFacilitator';
import { generateX402Error, generateResponse } from '../../utils/x402/response/paymentResponse';
import { isSolanaAddressSanctioned } from '../../utils/x402/security/sanctionChecks';

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
	const requestMethod = context.getRequestObject().method;

	const prepareOutput = setupOutputConnection(context, requestMethod, {});

	// Get Crossmint API credentials
	const credentials = await context.getCredentials('crossmintApi');
	if (!credentials) {
		resp.writeHead(403);
		resp.end('crossmintApi credential not found');
		return { noWebhookResponse: true };
	}

	// Get environment to determine network (staging: solana-devnet, production: solana)
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
	let paymentRequirements = buildPaymentRequirements(
		configuredTokens.paymentToken,
		supportedTokens,
		webhookUrl,
		resourceDescription,
		mimeType,
		resp,
	);
	if (paymentRequirements == null) return { noWebhookResponse: true };

	// Check for X-PAYMENT header
	const xPaymentHeader = headers['x-payment'];
	if (xPaymentHeader == null || typeof xPaymentHeader !== 'string') {
		// Enrich requirements with facilitator /accepts before returning 402
		// This adds feePayer, recentBlockhash, and decimals for Solana
		const enrichedRequirements = await enrichPaymentRequirements(context, paymentRequirements);
		return generateX402Error(resp, 'No x-payment header provided', enrichedRequirements);
	}

	// Process payment: decode, validate, verify, and settle
	try {
		context.logger.info('=== X402 Payment Processing Started ===', {});
		context.logger.info('X-PAYMENT header received', { length: xPaymentHeader.length });

		const decodedXPaymentJson = parseXPaymentHeader(xPaymentHeader);
		const isSolana = decodedXPaymentJson.network?.toLowerCase().includes('solana');
		
		context.logger.info('Payment decoded successfully:', {
			x402Version: decodedXPaymentJson.x402Version,
			scheme: decodedXPaymentJson.scheme,
			network: decodedXPaymentJson.network,
			format: isSolana ? 'Solana transaction' : 'EVM authorization',
			...(isSolana 
				? { transactionLength: decodedXPaymentJson.payload?.transaction?.length || 0 }
				: {
					from: decodedXPaymentJson.payload?.authorization?.from,
					to: decodedXPaymentJson.payload?.authorization?.to,
					value: decodedXPaymentJson.payload?.authorization?.value,
				}
			),
		});

		context.logger.info('Step 1: Validating payment structure...', {});
		const validation = validateXPayment(decodedXPaymentJson);
		if (validation != 'valid') {
			context.logger.warn('Payment validation failed', { validation });
			// Enrich requirements before returning 402
			const enrichedRequirements = await enrichPaymentRequirements(context, paymentRequirements);
			resp.writeHead(402, { 'Content-Type': 'application/json' });
			resp.end(
				JSON.stringify({
					x402Version: 1,
					accepts: enrichedRequirements,
				}),
			);
			return { noWebhookResponse: true };
		}
		context.logger.info('✅ Payment structure validation passed', {});

		context.logger.info('Step 2: Verifying payment details...', {});
		const verification = verifyPaymentDetails(decodedXPaymentJson, paymentRequirements);
		if (!verification.valid) {
			context.logger.warn('Payment verification failed', { errors: verification.errors });
			// Enrich requirements before returning 402
			const enrichedRequirements = await enrichPaymentRequirements(context, paymentRequirements);
			return generateX402Error(
				resp,
				`x-payment header is not valid for reasons: ${verification.errors}`,
				enrichedRequirements,
			);
		}
		context.logger.info('✅ Payment verification passed', {});

		// Perform sanction checks on the payer wallet address
		context.logger.info('Step 3: Performing sanction checks...', {});
		try {
			if (isSolana) {
				// For Solana, the payer address is in the transaction
				// We would need to deserialize the transaction to extract it
				// For now, skip client-side sanction checks for Solana - facilitator will validate
				context.logger.info('Skipping client-side sanction check for Solana - facilitator will validate transaction', {});
				// TODO: Deserialize Solana transaction to extract payer address for sanction checks
				// The facilitator's /settle endpoint performs validation including security checks
			} else {
				// EVM authorization-based sanction checks
				const fromAddress = decodedXPaymentJson.payload?.authorization?.from;
				if (fromAddress) {
					context.logger.info('Checking address for sanctions', { fromAddress });
					const isSanctioned = await isSolanaAddressSanctioned(fromAddress);
					if (isSanctioned) {
						// Reject the connection if the address is sanctioned
						context.logger.warn(`Payment rejected: sanctioned address ${fromAddress}`);
						return generateX402Error(
							resp,
							'Payment rejected: sender address is sanctioned',
							paymentRequirements,
						);
					}
					context.logger.info('✅ Address is not sanctioned', {});
				} else {
					context.logger.warn('No from address found in authorization', {});
				}
			}
		} catch (sanctionError) {
			// If sanction check fails (invalid Solana address, API error, etc.), fail-closed for security
			const errorMessage = sanctionError instanceof Error ? sanctionError.message : String(sanctionError);
			context.logger.error('❌ Sanction check failed', { error: errorMessage });
			
			// Fail-closed: reject payment if sanction check fails
			return generateX402Error(
				resp,
				`Payment rejected: sanction check failed - ${errorMessage}`,
				paymentRequirements,
			);
		}

		// Settle payment with facilitator (continue on error to avoid blocking workflow)
		context.logger.info('Step 4: Settling payment with facilitator...', {});
		try {
			context.logger.info('Settlement request details', {
				network: decodedXPaymentJson.network,
				scheme: decodedXPaymentJson.scheme,
				format: isSolana ? 'Solana transaction' : 'EVM authorization',
				...(isSolana
					? { transactionLength: decodedXPaymentJson.payload?.transaction?.length || 0 }
					: {
						from: decodedXPaymentJson.payload?.authorization?.from,
						to: decodedXPaymentJson.payload?.authorization?.to,
						value: decodedXPaymentJson.payload?.authorization?.value,
						signature: decodedXPaymentJson.payload?.signature?.substring(0, 20) + '...',
					}
				),
			});

			const settleResponse = await settleX402Payment(
				context,
				decodedXPaymentJson,
				verification.paymentRequirements!,
				xPaymentHeader,
			);

			context.logger.info('Settlement response', {
				success: settleResponse.success,
				txHash: settleResponse.txHash,
				error: settleResponse.error,
			});

			if (!settleResponse.success) {
				context.logger.warn('❌ Settlement failed', { error: settleResponse.error || 'Unknown error' });
				resp.writeHead(402, { 'Content-Type': 'application/json' });
				resp.end(
					JSON.stringify({
						x402Version: 1,
						accepts: paymentRequirements,
					}),
				);
				return { noWebhookResponse: true };
			}
			context.logger.info('✅ Settlement successful', {});

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
			context.logger.error('❌ Error in x402 webhook settlement', error);
			const errorMessage = error instanceof Error ? error.message : String(error);
			context.logger.error('Settlement error details:', {
				message: errorMessage,
				stack: error instanceof Error ? error.stack : undefined,
			});

			resp.writeHead(402, { 'Content-Type': 'application/json' });
			resp.end(
				JSON.stringify({
					x402Version: 1,
					error: `Settlement failed: ${errorMessage}`,
					accepts: paymentRequirements,
				}),
			);
			return { noWebhookResponse: true };
		}
	} catch (error) {
		context.logger.error('❌ Error in x402 webhook processing', error);
		const errorMessage = error instanceof Error ? error.message : String(error);
		context.logger.error('Webhook error details:', {
			message: errorMessage,
			stack: error instanceof Error ? error.stack : undefined,
		});

		return generateX402Error(resp, `Payment processing error: ${errorMessage}`, paymentRequirements);
	}
}
