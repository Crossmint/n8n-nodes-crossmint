import {
	INodeType,
	INodeTypeDescription,
	INodeProperties,
	NodeConnectionTypes,
} from 'n8n-workflow';

const httpMethodsProperty: INodeProperties = {
	displayName: 'HTTP Method',
	name: 'httpMethod',
	type: 'options',
	options: [
		{
			name: 'DELETE',
			value: 'DELETE',
		},
		{
			name: 'GET',
			value: 'GET',
		},
		{
			name: 'HEAD',
			value: 'HEAD',
		},
		{
			name: 'PATCH',
			value: 'PATCH',
		},
		{
			name: 'POST',
			value: 'POST',
		},
		{
			name: 'PUT',
			value: 'PUT',
		},
	],
	default: 'GET',
	description: 'The HTTP method to listen to',
};

export class CrossmintX402 implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Crossmint X402',
		name: 'crossmintX402',
		icon: { light: 'file:crossmint-wallet.svg', dark: 'file:crossmint-wallet.svg' },
		group: ['trigger'],
		version: 1,
		description: 'Starts the workflow when a 1Shot API webhook is received and authenticated',
		defaults: {
			name: '1Shot API Webhook',
		},
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		//webhooks: [defaultWebhookDescription],
		credentials: [
			{
				name: 'crossmintApi',
				required: true,
			},
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
				displayName: 'Webhook Type',
				name: 'webhookType',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: '1Shot Signature Verification',
						value: 'oneshot',
						description: 'Standard 1Shot webhook with ED-25519 signature verification',
					},
					{
						name: 'X402 Payment Gateway',
						value: 'x402',
						description: 'X402 payment-gated webhook requiring authorization',
					},
				],
				default: 'oneshot',
				description: 'Choose the type of webhook verification to use',
			},
			{
				displayName: 'Public Key',
				name: 'publicKey',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						webhookType: ['oneshot'],
					},
				},
				default: '',
				description: 'The ED-25519 public key provided by 1Shot for webhook verification',
			},
			{
				displayName: 'Allow Multiple HTTP Methods',
				name: 'multipleMethods',
				type: 'boolean',
				default: false,
				isNodeSetting: true,
				description: 'Whether to allow the webhook to listen for multiple HTTP methods',
			},
			{
				...httpMethodsProperty,
				displayOptions: {
					show: {
						multipleMethods: [false],
						webhookType: ['x402'],
					},
				},
			},
			{
				displayName: 'HTTP Methods',
				name: 'httpMethod',
				type: 'multiOptions',
				options: [
					{
						name: 'DELETE',
						value: 'DELETE',
					},
					{
						name: 'GET',
						value: 'GET',
					},
					{
						name: 'HEAD',
						value: 'HEAD',
					},
					{
						name: 'PATCH',
						value: 'PATCH',
					},
					{
						name: 'POST',
						value: 'POST',
					},
					{
						name: 'PUT',
						value: 'PUT',
					},
				],
				default: ['GET', 'POST'],
				description: 'The HTTP methods to listen to',
				displayOptions: {
					show: {
						webhookType: ['x402'],
						multipleMethods: [true],
					},
				},
			},
			{
				displayName: 'Path',
				name: 'path',
				type: 'string',
				default: '',
				placeholder: 'webhook',
				description:
					"The path to listen to, dynamic values could be specified by using ':', e.g. 'your-path/:dynamic-value'. If dynamic values are set 'webhookId' would be prepended to path.",
			},
			//webhookResponseModeProperty,
			{
				displayName:
					'Insert a node that supports streaming (e.g. \'AI Agent\') and enable streaming to stream directly to the response while the workflow is executed. <a href="https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.respondtowebhook/" target="_blank">More details</a>',
				name: 'webhookStreamingNotice',
				type: 'notice',
				displayOptions: {
					show: {
						webhookType: ['x402'],
						responseMode: ['streaming'],
					},
				},
				default: '',
			},
			//webhookResponseCodeSelector,
			//webhookResponseDataProperty,
			{
				displayName:
					'If you are sending back a response, add a "Content-Type" response header with the appropriate value to avoid unexpected behavior',
				name: 'contentTypeNotice',
				type: 'notice',
				default: '',
				displayOptions: {
					show: {
						responseMode: ['onReceived'],
						webhookType: ['x402'],
					},
				},
			},
			{
				displayName: 'Tokens',
				name: 'tokens',
				type: 'fixedCollection',
				required: true,
				displayOptions: {
					show: {
						webhookType: ['x402'],
					},
				},
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
								displayName: 'Payment Token Name or ID',
								name: 'paymentToken',
								type: 'options',
								typeOptions: {
									loadOptionsMethod: 'loadX402TokenOptions',
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
								default: 1000000,
								description:
									'The minimum payment amount required to trigger the workflow. This is in Wei for the token specified. For example, USDC has 6 decimals, so for $1.00 payment enter 1000000.',
							},
						],
					},
				],
			},
			//webhookOptionsProperty,
		],
	};

	/*methods = {
		loadOptions: {
			loadX402TokenOptions,
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		return webhookTrigger.call(this);
	}*/
}
