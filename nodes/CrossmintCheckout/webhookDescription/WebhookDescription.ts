import type { INodeProperties, IWebhookDescription } from 'n8n-workflow';

import { getResponseCode, getResponseData } from '../../../shared/utils/webhookUtils';

export const defaultWebhookDescription: IWebhookDescription = {
	name: 'default',
	httpMethod: 'POST',
	isFullPath: true,
	responseCode: `={{(${getResponseCode})($parameter)}}`,
	responseMode: '={{$parameter["responseMode"]}}',
	responseData: `={{(${getResponseData})($parameter)}}`,
	responseBinaryPropertyName: '={{$parameter["responseBinaryPropertyName"]}}',
	responseContentType: '={{$parameter["options"]["responseContentType"]}}',
	responsePropertyName: '={{$parameter["options"]["responsePropertyName"]}}',
	responseHeaders: '={{$parameter["options"]["responseHeaders"]}}',
	path: '={{$parameter["path"]}}',
};

export const httpMethodsProperty: INodeProperties = {
	displayName: 'HTTP Method',
	name: 'httpMethod',
	type: 'options',
	options: [
		{
			name: 'POST',
			value: 'POST',
		},
	],
	default: 'POST',
	description: 'The HTTP method to listen to',
};

export const webhookResponseModeOptions = [
	{
		name: 'Immediately',
		value: 'onReceived',
		description: 'As soon as this node executes',
	},
	{
		name: 'When Last Node Finishes',
		value: 'lastNode',
		description: 'Returns data of the last-executed node',
	},
	{
		name: 'Streaming',
		value: 'streaming',
		description: 'Returns data in real time from streaming enabled nodes',
	},
];

export const webhookResponseModeProperty: INodeProperties = {
	displayName: 'Respond',
	name: 'responseMode',
	type: 'options',
	options: webhookResponseModeOptions,
	default: 'lastNode',
	description: 'When and how to respond to the webhook',
	displayOptions: {
		show: {
			webhookType: ['x402'],
		},
	},
};

export const webhookResponseDataProperty: INodeProperties = {
	displayName: 'Response Data',
	name: 'responseData',
	type: 'options',
	displayOptions: {
		show: {
			webhookType: ['x402'],
			responseMode: ['lastNode'],
		},
	},
	options: [
		{
			name: 'All Entries',
			value: 'allEntries',
			description: 'Returns all the entries of the last node. Always returns an array.',
		},
		{
			name: 'First Entry JSON',
			value: 'firstEntryJson',
			description:
				'Returns the JSON data of the first entry of the last node. Always returns a JSON object.',
		},
		{
			name: 'First Entry Binary',
			value: 'firstEntryBinary',
			description:
				'Returns the binary data of the first entry of the last node. Always returns a binary file.',
		},
		{
			name: 'No Response Body',
			value: 'noData',
			description: 'Returns without a body',
		},
	],
	default: 'firstEntryJson',
	description:
		'What data should be returned. If it should return all items as an array or only the first item as object.',
};

export const webhookResponseBinaryPropertyNameProperty: INodeProperties = {
	displayName: 'Property Name',
	name: 'responseBinaryPropertyName',
	type: 'string',
	required: true,
	default: 'data',
	displayOptions: {
		show: {
			responseData: ['firstEntryBinary'],
		},
	},
	description: 'Name of the binary property to return',
};

export const webhookResponseCodeSelector: INodeProperties = {
	displayName: 'Response Code',
	name: 'responseCode',
	type: 'options',
	options: [
		{ name: '200', value: 200, description: 'OK - Request has succeeded' },
		{ name: '201', value: 201, description: 'Created - Request has been fulfilled' },
		{ name: '204', value: 204, description: 'No Content - Request processed, no content returned' },
		{
			name: '301',
			value: 301,
			description: 'Moved Permanently - Requested resource moved permanently',
		},
		{ name: '302', value: 302, description: 'Found - Requested resource moved temporarily' },
		{ name: '304', value: 304, description: 'Not Modified - Resource has not been modified' },
		{ name: '400', value: 400, description: 'Bad Request - Request could not be understood' },
		{ name: '401', value: 401, description: 'Unauthorized - Request requires user authentication' },
		{
			name: '403',
			value: 403,
			description: 'Forbidden - Server understood, but refuses to fulfill',
		},
		{ name: '404', value: 404, description: 'Not Found - Server has not found a match' },
		{
			name: 'Custom Code',
			value: 'customCode',
			description: 'Write any HTTP code',
		},
	],
	default: 200,
	description: 'The HTTP response code to return',
	displayOptions: {
		show: {
			webhookType: ['x402'],
		},
	},
};

export const webhookOptionsProperty: INodeProperties = {
	displayName: 'Options',
	name: 'options',
	type: 'collection',
	placeholder: 'Add option',
	default: {},
	displayOptions: {
		show: {
			webhookType: ['x402'],
		},
	},
	// eslint-disable-next-line n8n-nodes-base/node-param-collection-type-unsorted-items
	options: [
		{
			displayName: 'Resource Description',
			name: 'resourceDescription',
			type: 'string',
			default: '',
			description: 'A description of this x402-gated resource',
		},
		{
			displayName: 'Mime Type',
			name: 'mimeType',
			type: 'string',
			default: 'application/json',
			description:
				'The mime type of the resource. Leave blank for no mime type. For n8n, this is almost always application/JSON',
		},
		{
			displayName: 'Ignore Bots',
			name: 'ignoreBots',
			type: 'boolean',
			default: false,
			description: 'Whether to ignore requests from bots like link previewers and web crawlers',
		},
		{
			displayName: 'IP(s) Whitelist',
			name: 'ipWhitelist',
			type: 'string',
			placeholder: 'e.g. 127.0.0.1',
			default: '',
			description: 'Comma-separated list of allowed IP addresses. Leave empty to allow all IPs.',
		},
		{
			displayName: 'No Response Body',
			name: 'noResponseBody',
			type: 'boolean',
			default: false,
			description: 'Whether to send any body in the response',
			displayOptions: {
				hide: {
					rawBody: [true],
				},
				show: {
					'/webhookType': ['x402'],
					'/responseMode': ['onReceived'],
				},
			},
		},
		{
			displayName: 'Raw Body',
			name: 'rawBody',
			type: 'boolean',
			displayOptions: {
				hide: {
					noResponseBody: [true],
				},
				show: {
					'/webhookType': ['x402'],
				},
			},
			default: false,
			description: 'Whether to return the raw body',
		},
		{
			displayName: 'Response Data',
			name: 'responseData',
			type: 'string',
			displayOptions: {
				show: {
					'/responseMode': ['onReceived'],
					'/webhookType': ['x402'],
				},
				hide: {
					noResponseBody: [true],
				},
			},
			default: '',
			placeholder: 'success',
			description: 'Custom response data to send',
		},
		{
			displayName: 'Response Content-Type',
			name: 'responseContentType',
			type: 'string',
			displayOptions: {
				show: {
					'/responseData': ['firstEntryJson'],
					'/responseMode': ['lastNode'],
					'/webhookType': ['x402'],
				},
			},
			default: '',
			placeholder: 'application/xml',
			// eslint-disable-next-line n8n-nodes-base/node-param-description-miscased-json
			description:
				'Set a custom content-type to return if another one as the "application/json" should be returned',
		},
		{
			displayName: 'Response Headers',
			name: 'responseHeaders',
			placeholder: 'Add Response Header',
			description: 'Add headers to the webhook response',
			type: 'fixedCollection',
			typeOptions: {
				multipleValues: true,
			},
			default: {},
			displayOptions: {
				show: {
					'/webhookType': ['x402'],
				},
			},
			options: [
				{
					name: 'entries',
					displayName: 'Entries',
					values: [
						{
							displayName: 'Name',
							name: 'name',
							type: 'string',
							default: '',
							description: 'Name of the header',
						},
						{
							displayName: 'Value',
							name: 'value',
							type: 'string',
							default: '',
							description: 'Value of the header',
						},
					],
				},
			],
		},
		{
			displayName: 'Property Name',
			name: 'responsePropertyName',
			type: 'string',
			displayOptions: {
				show: {
					'/webhookType': ['x402'],
					'/responseData': ['firstEntryJson'],
					'/responseMode': ['lastNode'],
				},
			},
			default: 'data',
			description: 'Name of the property to return the data of instead of the whole JSON',
		},
	],
};
