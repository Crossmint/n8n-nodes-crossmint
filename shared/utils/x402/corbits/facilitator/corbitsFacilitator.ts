import {
	NodeApiError,
	type IDataObject,
	type IWebhookFunctions,
	type JsonObject,
} from 'n8n-workflow';
import type { IPaymentPayload, IPaymentRequirements, PaymentRequirements } from '../../../../transport/types';

// Corbits facilitator integration
const CDP_HOST = 'facilitator.corbits.dev';
const FACILITATOR_ACCEPTS_PATH = '/accepts';
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

/**
 * Enrich payment requirements by calling facilitator /accepts endpoint
 * For Solana, this adds feePayer, recentBlockhash, and decimals to the extra field
 */
export async function enrichPaymentRequirements(
	context: IWebhookFunctions,
	paymentRequirements: PaymentRequirements[],
): Promise<IPaymentRequirements[]> {
	// Check if any requirement is for Solana
	const hasSolana = paymentRequirements.some((req) => req.network?.toLowerCase().includes('solana'));
	
	if (!hasSolana) {
		// No Solana requirements, convert to IPaymentRequirements and return as-is
		return paymentRequirements.map((req) => ({
			scheme: req.scheme,
			network: req.network,
			maxAmountRequired: req.maxAmountRequired,
			resource: req.resource,
			description: req.description,
			mimeType: req.mimeType,
			outputSchema: req.outputSchema,
			payTo: req.payTo,
			maxTimeoutSeconds: req.maxTimeoutSeconds,
			asset: req.asset,
			extra: req.extra,
		}));
	}

	context.logger.info('Enriching payment requirements with facilitator /accepts endpoint', {});

	// Convert PaymentRequirements class instances to plain objects
	const paymentRequirementsObj: IPaymentRequirements[] = paymentRequirements.map((req) => ({
		scheme: req.scheme,
		network: req.network,
		maxAmountRequired: req.maxAmountRequired,
		resource: req.resource,
		description: req.description,
		mimeType: req.mimeType,
		outputSchema: req.outputSchema,
		payTo: req.payTo,
		maxTimeoutSeconds: req.maxTimeoutSeconds,
		asset: req.asset,
		extra: req.extra,
	}));

	try {
		// Facilitator /accepts expects x402Version and accepts array format
		const requestBody = {
			x402Version: 1,
			accepts: paymentRequirementsObj,
		};

		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
		};

		const requestBodyJson = JSON.stringify(requestBody, null, 2);
		
		console.log('=== FACILITATOR ACCEPTS REQUEST JSON ===');
		console.log(requestBodyJson);
		console.log('=== END FACILITATOR ACCEPTS REQUEST JSON ===');

		context.logger.info('Calling facilitator /accepts endpoint', { url: `https://${CDP_HOST}${FACILITATOR_ACCEPTS_PATH}` });

		const res = await fetch(`https://${CDP_HOST}${FACILITATOR_ACCEPTS_PATH}`, {
			method: 'POST',
			headers,
			body: requestBodyJson,
		});

		const responseText = await res.text();
		
		console.log('=== FACILITATOR ACCEPTS RESPONSE JSON ===');
		console.log(responseText);
		console.log('=== END FACILITATOR ACCEPTS RESPONSE JSON ===');

		context.logger.info('Facilitator /accepts response status', { status: res.status, statusText: res.statusText });
		context.logger.info('Facilitator /accepts response body', { body: responseText });

		if (!res.ok) {
			context.logger.warn('Facilitator /accepts returned error, using original requirements', { 
				status: res.status,
				error: responseText,
			});
			// Return original requirements if enrichment fails
			return paymentRequirementsObj;
		}

		const enrichedData = JSON.parse(responseText) as { 
			accepts?: IPaymentRequirements[];
			paymentRequirements?: IPaymentRequirements[];
		};
		
		// Facilitator may return enriched requirements in 'accepts' or 'paymentRequirements' field
		const enrichedRequirements = enrichedData.accepts || enrichedData.paymentRequirements;
		
		if (enrichedRequirements && Array.isArray(enrichedRequirements)) {
			context.logger.info('✅ Payment requirements enriched successfully', {});
			return enrichedRequirements;
		}

		context.logger.warn('Facilitator /accepts response missing accepts/paymentRequirements, using original', {});
		return paymentRequirementsObj;
	} catch (error) {
		context.logger.error('Error enriching payment requirements', { 
			error: error instanceof Error ? error.message : String(error),
		});
		// Return original requirements if enrichment fails
		return paymentRequirementsObj;
	}
}


export async function settleX402Payment(
	context: IWebhookFunctions,
	paymentPayload: IPaymentPayload,
	paymentRequirements: PaymentRequirements,
	paymentHeader?: string,
): Promise<SettleResponse> {
	context.logger.info('=== Facilitator Settlement Started ===', {});
	context.logger.info('Settlement URL', { url: `https://${CDP_HOST}${FACILITATOR_SETTLE_PATH}` });

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
	
	// Extract transaction from payload for Solana, or use empty string for EVM
	const isSolana = paymentPayload.network?.toLowerCase().includes('solana');
	const transaction = isSolana 
		? (paymentPayload.payload?.transaction || '')
		: '';
	
	const requestBody = {
		x402Version: typeof paymentPayload.x402Version === 'string' ? parseInt(paymentPayload.x402Version, 10) : paymentPayload.x402Version ?? 1,
		paymentPayload: {
			...paymentPayload,
			x402Version: typeof paymentPayload.x402Version === 'string' ? parseInt(paymentPayload.x402Version, 10) : paymentPayload.x402Version ?? 1,
		},
		paymentRequirements: paymentRequirementsObj,
		...(paymentHeader ? { paymentHeader } : {}),
		// For Solana: base64-encoded partially-signed transaction from payload
		// For EVM: empty string (facilitator creates transaction from authorization)
		transaction: transaction,
	};
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
	};

	const requestBodyJson = JSON.stringify(requestBody, null, 2);
	
	console.log('=== FACILITATOR REQUEST JSON ===');
	console.log(requestBodyJson);
	console.log('=== END FACILITATOR REQUEST JSON ===');
	
	context.logger.info('Settlement request body (summary)', {
		x402Version: requestBody.x402Version,
		network: requestBody.paymentPayload.network,
		scheme: requestBody.paymentPayload.scheme,
		from: requestBody.paymentPayload.payload?.authorization?.from,
		to: requestBody.paymentPayload.payload?.authorization?.to,
		value: requestBody.paymentPayload.payload?.authorization?.value,
		asset: paymentRequirementsObj.asset,
		payTo: paymentRequirementsObj.payTo,
		transaction: requestBody.transaction,
	});
	context.logger.info('Settlement request body (full JSON)', { 
		body: requestBodyJson,
		bodyLength: requestBodyJson.length,
	});

	try {
		context.logger.info('Sending settlement request to facilitator...', {});
		context.logger.info('Request URL', { url: `https://${CDP_HOST}${FACILITATOR_SETTLE_PATH}` });
		context.logger.info('Request headers', { headers });
		context.logger.info('Request body (full JSON)', { body: requestBodyJson });
		
		const res = await fetch(`https://${CDP_HOST}${FACILITATOR_SETTLE_PATH}`, {
			method: 'POST',
			headers,
			body: requestBodyJson,
		});

		context.logger.info('Facilitator response status', { status: res.status, statusText: res.statusText });
		context.logger.info('Facilitator response headers', { headers: Object.fromEntries(res.headers.entries()) });

		const responseText = await res.text();
		
		console.log('=== FACILITATOR RESPONSE JSON ===');
		console.log(responseText);
		console.log('=== END FACILITATOR RESPONSE JSON ===');
		
		context.logger.info('Facilitator response body (raw text)', { body: responseText, bodyLength: responseText.length });

		if (!res.ok) {
			context.logger.error('❌ Facilitator returned error status', { 
				status: res.status,
				statusText: res.statusText,
				responseBody: responseText,
			});
			
			// Try to parse error response if it's JSON
			let parsedErrorBody: any = responseText;
			try {
				parsedErrorBody = JSON.parse(responseText);
				context.logger.error('Facilitator error response (parsed)', { 
					error: parsedErrorBody,
					errorMessage: parsedErrorBody.error || parsedErrorBody.message,
					fullError: JSON.stringify(parsedErrorBody, null, 2),
				});
				console.log('=== FACILITATOR ERROR DETAILS ===');
				console.log(JSON.stringify(parsedErrorBody, null, 2));
				console.log('=== END FACILITATOR ERROR DETAILS ===');
			} catch {
				context.logger.error('Facilitator error response (not JSON)', { error: responseText });
			}
			
			const errorPayload: JsonObject = {
				message: `/settle ${res.status}: ${res.statusText}`,
				statusCode: res.status,
				body: responseText,
				headers: Object.fromEntries(res.headers.entries()),
			};
			throw new NodeApiError(context.getNode(), errorPayload);
		}
		
		// Parse successful response
		let data: IDataObject & {
			success?: boolean;
			transaction?: {
				hash?: string;
			};
			errorReason?: string;
		};
		
		try {
			data = JSON.parse(responseText) as IDataObject & {
				success?: boolean;
				transaction?: {
					hash?: string;
				};
				errorReason?: string;
			};
			context.logger.info('Facilitator response parsed successfully', {});
		} catch (parseError) {
			context.logger.error('❌ Failed to parse facilitator response as JSON', { 
				error: parseError instanceof Error ? parseError.message : String(parseError),
				responseText: responseText,
			});
			throw new Error(`Failed to parse facilitator response: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
		}

		// Log the full response as JSON string for better visibility
		const fullResponseJson = JSON.stringify(data, null, 2);
		console.log('=== FACILITATOR RESPONSE PARSED JSON ===');
		console.log(fullResponseJson);
		console.log('=== END FACILITATOR RESPONSE PARSED JSON ===');
		context.logger.info('Facilitator response parsed (full JSON)', {
			fullResponseJson: fullResponseJson,
		});
		
		// Log key values with console.log for visibility
		console.log('[FACILITATOR] success:', data.success, 'type:', typeof data.success);
		console.log('[FACILITATOR] errorReason:', data.errorReason);
		console.log('[FACILITATOR] transaction:', data.transaction);
		console.log('[FACILITATOR] All keys:', Object.keys(data));
		
		// Log each key-value pair
		for (const key of Object.keys(data)) {
			const value = data[key];
			console.log(`[FACILITATOR] response[${key}]:`, value, `(type: ${typeof value})`);
			context.logger.info(`Facilitator response[${key}]`, { 
				value: value,
				valueString: String(value),
				type: typeof value,
			});
		}

		// Check for success field - it might be missing, false, or a string
		const successValue: unknown = data.success;
		const isSuccess = successValue === true || (typeof successValue === 'string' && successValue.toLowerCase() === 'true');
		
		// Check for error in various possible fields
		const errorMessage = typeof data.errorReason === 'string' 
			? data.errorReason 
			: (typeof (data as any).error === 'string' ? (data as any).error : undefined);
		
		console.log('[FACILITATOR] Final success check:', {
			rawValue: successValue,
			booleanValue: Boolean(successValue),
			isSuccess: isSuccess,
			errorMessage: errorMessage,
		});

		return {
			success: isSuccess,
			txHash: (data.transaction as IDataObject | undefined)?.hash as string | undefined,
			error: errorMessage,
			data,
		};

	} catch (error) {
		context.logger.error('❌ Error in facilitator settlement:', error);
		if (error instanceof NodeApiError) {
			context.logger.error('NodeApiError details:', {
				message: error.message,
				statusCode: (error as any).statusCode,
				body: (error as any).body,
			});
			throw error;
		}

		context.logger.error('Unknown error type:', {
			error: String(error),
			message: error instanceof Error ? error.message : undefined,
		});
		throw new NodeApiError(context.getNode(), error as object & { message?: string });
	}
}

