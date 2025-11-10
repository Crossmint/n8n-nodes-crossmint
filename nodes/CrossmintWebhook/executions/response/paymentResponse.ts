import type {
	IWebhookFunctions,
	INodeExecutionData,
	IWebhookResponseData,
} from 'n8n-workflow';
import type { IPaymentRequirements } from '../types/x402Types';
import type * as express from 'express';

export function generateResponse(
	context: IWebhookFunctions,
	req: express.Request,
	responseMode: string,
	responseData: string,
	txHash: string,
	prepareOutput: (data: INodeExecutionData) => INodeExecutionData[][],
	network?: string,
): IWebhookResponseData {
	const response: INodeExecutionData = {
		json: {
			headers: req.headers,
			params: req.params,
			query: req.query,
			body: req.body,
			txHash: txHash,
		},
	};

	// Generate X-PAYMENT-RESPONSE header with Base64(JSON) settlement details
	const paymentResponseData = {
		success: true,
		txHash: txHash,
		networkId: network || 'base-sepolia',
	};
	const paymentResponseBase64 = Buffer.from(JSON.stringify(paymentResponseData)).toString('base64');

	const res = context.getResponseObject();

	if (responseMode === 'streaming') {
		// Set up streaming response headers
		res.writeHead(200, {
			'Content-Type': 'application/json; charset=utf-8',
			'Transfer-Encoding': 'chunked',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive',
			'X-PAYMENT-RESPONSE': paymentResponseBase64,
		});

		// Flush headers immediately
		res.flushHeaders();

		return {
			noWebhookResponse: true,
			workflowData: prepareOutput(response),
		};
	}

	// For non-streaming mode, set the header directly
	res.setHeader('X-PAYMENT-RESPONSE', paymentResponseBase64);

	return {
		webhookResponse: responseData,
		workflowData: prepareOutput(response),
	};
}

export function generateX402Error(
	resp: express.Response,
	errorMessage: string,
	paymentRequirements: IPaymentRequirements[],
): IWebhookResponseData {
	resp.writeHead(402, { 'Content-Type': 'application/json' });
	resp.end(
		JSON.stringify({
			x402Version: 1,
			accepts: paymentRequirements,
		}),
	);
	return { noWebhookResponse: true };
}

