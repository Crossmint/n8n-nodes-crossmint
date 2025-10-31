import {
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
	IWebhookDescription,
} from 'n8n-workflow';
import { webhookTrigger } from './executions/Webhooks';
import { configuredOutputs, getResponseCode, getResponseData } from './utils/webhookUtils';

const webhookDescription: IWebhookDescription = {
	name: 'default',
	httpMethod: '={{$parameter["httpMethod"] || "POST"}}',
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

export class CrossmintWebhooks implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Crossmint Webhooks',
		name: 'crossmintWebhook',
		icon: { light: 'file:crossmint-wallet.svg', dark: 'file:crossmint-wallet.svg' },
		group: ['trigger'],
		version: 1,
		description: 'Starts the workflow when a Crossmint webhook is received and authenticated',
		defaults: {
			name: 'Crossmint Webhook',
		},
		inputs: [],
		outputs: `={{(${configuredOutputs})($parameter)}}`,
		webhooks: [webhookDescription],
		credentials: [
			{
				name: 'crossmintApi',
				required: true,
			}
		],
		supportsCORS: true,
		triggerPanel: {
			header: '',
			executionsHelp: {
				inactive:
					'Webhooks have two modes: test and production. <br /> <br /> <b>Use test mode while you build your workflow</b>. Click the \'listen\' button, then make a request to the test URL. The executions will show up in the editor.<br /> <br /> <b>Use production mode to run your workflow automatically</b>. <a data-key="activate">Activate</a> the workflow, then make requests to the production URL. These executions will show up in the executions list, but not in the editor.',
				active:
					'Webhooks have two modes: test and production. <br /> <br /> <b>Use test mode while you build your workflow</b>. Click the \'listen\' button, then make a request to the test URL. The executions will show up in the editor.<br /> <br /> <b>Use production mode to run your workflow automatically</b>. Since the workflow is activated, you can make requests to the production URL. These executions will show up in the <a data-key="executions">executions list</a>, but not in the editor.',
			},
			activationHint:
				"Once you've finished building your workflow, run it without having to click this button by using the production webhook URL.",
		},
		properties: [
			{
				displayName: 'Path',
				name: 'path',
				type: 'string',
				default: '',
				placeholder: 'webhook',
				description:
					"The path to listen to, dynamic values could be specified by using ':', e.g. 'your-path/:dynamic-value'. If dynamic values are set 'webhookId' would be prepended to path.",
			},
			{
				displayName: 'Respond',
				name: 'responseMode',
				type: 'options',
				options: [
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
				],
				default: 'lastNode',
				description: 'When and how to respond to the webhook',
			},
			{
				displayName: 'Response Data',
				name: 'responseData',
				type: 'options',
				displayOptions: {
					show: {
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
			},
			{
				displayName: 'Tokens',
				name: 'tokens',
				type: 'fixedCollection',
				required: true,
				default: [],
				description: 'The tokens that will be accepted for payment',
				typeOptions: {
					multipleValues: true,
				},
				options: [
					{
						name: 'paymentToken',
						displayName: 'Payment Token',
						// eslint-disable-next-line n8n-nodes-base/node-param-fixed-collection-type-unsorted-items
						values: [
							{
								displayName: 'Payment Token',
								name: 'paymentToken',
								type: 'options',
								options: [
									{
										name: 'USDC (Solana)',
										value: 'solana:usdc',
									},
									{
										name: 'SOL (Solana)',
										value: 'solana:sol',
									},
								],
								required: true,
								default: 'solana:usdc',
								description: 'The token to accept for payment',
							},
							{
								displayName: 'Pay To Address',
								name: 'payToAddress',
								type: 'string',
								required: true,
								default: '',
								description:
									'The address that will receive the payment. Should be in the form of an EVM address with the leading 0x.',
							},
							{
								displayName: 'Payment Amount',
								name: 'paymentAmount',
								type: 'number',
								required: true,
								default: 1000000,
								description:
									'The minimum payment amount required in atomic units (must be an integer). Examples: SOL uses lamports (9 decimals) - 0.006 SOL = 6000000 lamports. USDC uses 6 decimals - $1.00 = 1000000. No decimal points allowed.',
							},
						],
					},
				],
			},
		],
	};
	
	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		return webhookTrigger.call(this);
	}
}
