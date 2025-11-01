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
	if (responseMode === 'streaming') {
		const res = context.getResponseObject();

		// Set up streaming response headers
		res.writeHead(200, {
			'Content-Type': 'application/json; charset=utf-8',
			'Transfer-Encoding': 'chunked',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive',
		});

		// Flush headers immediately
		res.flushHeaders();

		return {
			noWebhookResponse: true,
			workflowData: prepareOutput(response),
		};
	}

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
			error: {
				errorMessage,
				paymentConfigs: paymentRequirements,
			},
		}),
	);
	return { noWebhookResponse: true };
}

