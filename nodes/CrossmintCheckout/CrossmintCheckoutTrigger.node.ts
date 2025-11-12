import {
	ILoadOptionsFunctions,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
	IWebhookDescription,
} from 'n8n-workflow';
import { webhookTrigger } from '../../shared/actions/checkout/PaywallWebhook.operation';
import { configuredOutputs, getResponseCode, getResponseData } from '../../shared/utils/webhookUtils';

const webhookDescription: IWebhookDescription = {
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

export class CrossmintCheckoutTrigger implements INodeType {
	methods = {
		loadOptions: {
			async getPaymentTokens(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const credentials = await this.getCredentials('crossmintApi').catch(() => null);
				const environment = (credentials as { environment?: string } | null)?.environment ?? 'staging';

				if (environment === 'production') {
					return [
						{
							name: 'USDC (Base)',
							value: 'base:usdc',
						},
					];
				}

				return [
					{
						name: 'USDC (Base Sepolia)',
						value: 'base-sepolia:usdc',
					},
				];
			},
		},
	};

	description: INodeTypeDescription = {
		displayName: 'Crossmint Checkout Trigger',
		name: 'crossmintCheckoutTrigger',
		icon: { light: 'file:crossmint-checkout.svg', dark: 'file:crossmint-checkout.svg' },
		group: ['trigger'],
		version: 1,
		description: 'Starts the workflow when a Crossmint webhook is received and authenticated',
		defaults: {
			name: 'Crossmint Paywall',
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
				displayName: 'Mode',
				name: 'mode',
				type: 'options',
				options: [
					{
						name: 'Paywall',
						value: 'paywall',
						description:
							'X402 Paywall',
					},
				],
				default: 'paywall',
				description: 'Webhook mode',
			},
			{
				displayName: 'Path',
				name: 'path',
				type: 'string',
				displayOptions: {
					show: {
						mode: ['paywall'],
					},
				},
				default: '',
				placeholder: 'webhook',
				description:
					"The path to listen to, dynamic values could be specified by using ':', e.g. 'your-path/:dynamic-value'. If dynamic values are set 'webhookId' would be prepended to path.",
			},
			{
				displayName: 'Respond',
				name: 'responseMode',
				type: 'options',
				displayOptions: {
					show: {
						mode: ['paywall'],
					},
				},
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
						mode: ['paywall'],
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
				displayOptions: {
					show: {
						mode: ['paywall'],
					},
				},
				required: true,
				default: [],
				description: 'The tokens that will be accepted for payment',
				typeOptions: {
					multipleValues: true,
				},
				options: [
					{
						name: 'paymentToken',
						displayName: 'Payment Token Name or ID',
						values: [
							{
								displayName: 'Payment Token Name or ID',
								name: 'paymentToken',
								type: 'options',
								typeOptions: {
									loadOptionsMethod: 'getPaymentTokens',
								},
								required: true,
								default: '',
								description:
									'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
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
								default: 0.5,
								typeOptions: {
									numberPrecision: 6,
								},
								description:
									'The minimum payment amount required. Supports up to 6 decimals for USDC (e.g. $1.00 = 1.0, $0.01 = 0.01).',
							},
						],
					},
				],
			},
		],
	};
	
	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		return webhookTrigger(this);
	}
}
