import type { IWebhookFunctions, INodeExecutionData, IDataObject } from 'n8n-workflow';

export type WebhookParameters = {
	httpMethod?: string | string[];
	responseMode: string;
	responseData: string;
	responseCode?: number; //typeVersion <= 1.1
	options?: {
		responseData?: string;
		responseCode?: {
			values?: {
				responseCode: number;
				customCode?: number;
			};
		};
		noResponseBody?: boolean;
	};
};

export const getResponseCode = (parameters: WebhookParameters) => {
	if (parameters.responseCode) {
		return parameters.responseCode;
	}
	const responseCodeOptions = parameters.options;
	if (responseCodeOptions?.responseCode?.values) {
		const { responseCode, customCode } = responseCodeOptions.responseCode.values;

		if (customCode) {
			return customCode;
		}

		return responseCode;
	}
	return 200;
};

export const getResponseData = (parameters: WebhookParameters) => {
	const { responseData, responseMode, options } = parameters;
	if (responseData) return responseData;

	if (responseMode === 'onReceived') {
		const data = options?.responseData;
		if (data) return data;
	}

	if (options?.noResponseBody) return 'noData';

	return undefined;
};

export const configuredOutputs = (parameters: WebhookParameters) => {
	const httpMethod = parameters.httpMethod ?? 'POST';

	if (!Array.isArray(httpMethod))
		return [
			{
				type: 'main',
				displayName: httpMethod,
			},
		];

	const outputs = httpMethod.map((method) => {
		return {
			type: 'main',
			displayName: method,
		};
	});

	return outputs;
};

export const setupOutputConnection = (
	ctx: IWebhookFunctions,
	method: string,
	additionalData: {
		jwtPayload?: IDataObject;
	},
) => {
	let httpMethod: string[] | string;

	try {
		httpMethod = ctx.getNodeParameter('httpMethod', 0, 'POST') as string[] | string;
	} catch {
		httpMethod = 'POST';
	}
	let webhookUrl = ctx.getNodeWebhookUrl('default') as string;
	const executionMode = ctx.getMode() === 'manual' ? 'test' : 'production';

	if (executionMode === 'test') {
		webhookUrl = webhookUrl.replace('/webhook/', '/webhook-test/');
	}

	// multi methods could be set in settings of node, so we need to check if it's an array
	if (!Array.isArray(httpMethod)) {
		return (outputData: INodeExecutionData): INodeExecutionData[][] => {
			outputData.json.webhookUrl = webhookUrl;
			outputData.json.executionMode = executionMode;
			if (additionalData?.jwtPayload) {
				outputData.json.jwtPayload = additionalData.jwtPayload;
			}
			return [[outputData]];
		};
	}

	const outputIndex = httpMethod.indexOf(method.toUpperCase());
	const outputs: INodeExecutionData[][] = httpMethod.map(() => []);

	return (outputData: INodeExecutionData): INodeExecutionData[][] => {
		outputData.json.webhookUrl = webhookUrl;
		outputData.json.executionMode = executionMode;
		if (additionalData?.jwtPayload) {
			outputData.json.jwtPayload = additionalData.jwtPayload;
		}
		outputs[outputIndex] = [outputData];
		return outputs;
	};
};

export const isIpWhitelisted = (
	whitelist: string | string[] | undefined,
	ips: string[],
	ip?: string,
) => {
	if (whitelist === undefined || whitelist === '') {
		return true;
	}

	if (!Array.isArray(whitelist)) {
		whitelist = whitelist.split(',').map((entry) => entry.trim());
	}

	for (const address of whitelist) {
		if (ip?.includes(address)) {
			return true;
		}

		if (ips.some((entry) => entry.includes(address))) {
			return true;
		}
	}

	return false;
};
