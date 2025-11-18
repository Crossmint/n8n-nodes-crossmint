import {
	NodeApiError,
	type IDataObject,
	type IWebhookFunctions,
	type JsonObject,
} from 'n8n-workflow';
import type { IPaymentPayload, IPaymentRequirements, PaymentRequirements } from '../../../../transport/types';

export interface SettleResponse {
	success: boolean;
	txHash?: string | null;
	error?: string;
	data: IDataObject;
}

export interface FacilitatorAcceptsResponse {
	x402Version: number;
	accepts: IPaymentRequirements[];
}

export async function requestFacilitatorAccepts(
	context: IWebhookFunctions,
	facilitatorUrl: string,
	requirements: PaymentRequirements[],
	resourceUrl: string,
): Promise<FacilitatorAcceptsResponse> {
	const accepts = requirements.map((req) => serializeRequirements(req, resourceUrl));
	const response = await httpJsonRequest(context, facilitatorUrl, '/accepts', {
		x402Version: 1,
		accepts,
	});

	return {
		x402Version: typeof response.x402Version === 'number' ? response.x402Version : 1,
		accepts: Array.isArray(response.accepts) ? (response.accepts as IPaymentRequirements[]) : [],
	};
}

export async function settleX402Payment(
	context: IWebhookFunctions,
	facilitatorUrl: string,
	paymentPayload: IPaymentPayload,
	paymentRequirements: PaymentRequirements | IPaymentRequirements,
	paymentHeader?: string,
): Promise<SettleResponse> {
	const requestBody = {
		x402Version: typeof paymentPayload.x402Version === 'string' ? parseInt(paymentPayload.x402Version, 10) : paymentPayload.x402Version ?? 1,
		paymentPayload,
		paymentRequirements: serializeRequirements(paymentRequirements),
		...(paymentHeader ? { paymentHeader } : {}),
	};

	const response = await httpJsonRequest(context, facilitatorUrl, '/settle', requestBody);
	return {
		success: Boolean(response.success),
		txHash: (response.txHash as string | null | undefined) ?? null,
		error: typeof response.error === 'string' ? response.error : undefined,
		data: response,
	};
}

function serializeRequirements(
	requirements: PaymentRequirements | IPaymentRequirements,
	resourceOverride?: string,
): IPaymentRequirements {
	return {
		scheme: requirements.scheme,
		network: requirements.network,
		maxAmountRequired: requirements.maxAmountRequired,
		resource: resourceOverride ?? requirements.resource,
		description: requirements.description,
		mimeType: requirements.mimeType,
		outputSchema: requirements.outputSchema,
		payTo: requirements.payTo,
		maxTimeoutSeconds: requirements.maxTimeoutSeconds,
		asset: requirements.asset,
		extra: requirements.extra ?? {},
	};
}

async function httpJsonRequest(
	context: IWebhookFunctions,
	baseUrl: string,
	path: string,
	body: IDataObject,
): Promise<IDataObject> {
	const url = new URL(path, ensureBaseUrl(baseUrl)).toString();
	const res = await fetch(url, {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(body),
	});

	const text = await res.text();
	const json = safeParseJson(text);

	if (!res.ok) {
		const errorPayload: JsonObject = {
			message: `${path} ${res.status}: ${res.statusText}`,
			statusCode: res.status,
			body: text,
		};
		throw new NodeApiError(context.getNode(), errorPayload);
	}

	return json;
}

function ensureBaseUrl(url: string): string {
	return url.endsWith('/') ? url : `${url}/`;
}

function safeParseJson(text: string): IDataObject {
	if (!text) return {};
	try {
		return JSON.parse(text) as IDataObject;
	} catch {
		return { raw: text };
	}
}