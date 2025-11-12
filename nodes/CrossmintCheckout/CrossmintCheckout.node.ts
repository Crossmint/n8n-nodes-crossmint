import {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	INodeExecutionData,
	INodeProperties,
	NodeOperationError,
	NodeConnectionTypes,
} from 'n8n-workflow';
import { CrossmintApi } from '../../shared/transport/CrossmintApi';
import { CrossmintCredentials } from '../../shared/transport/types';
import { findProduct } from '../../shared/actions/checkout/findProduct.operation';
import { purchaseProduct } from '../../shared/actions/checkout/purchaseProduct.operation';
import { paywallRequest } from '../../shared/actions/checkout/paywallRequest.operation';

export class CrossmintCheckout implements INodeType {
	methods = {
		loadOptions: {
			async getPaymentTokens(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const selectedEnvironment = (this.getCurrentNodeParameter('environment') as string | undefined) ?? null;
				const credentials = await this.getCredentials('crossmintApi').catch(() => null);
				const credentialsEnvironment = (credentials as { environment?: string } | null)?.environment ?? 'staging';
				const environment = selectedEnvironment ?? credentialsEnvironment;

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
		displayName: 'Crossmint Checkout',
		name: 'crossmintCheckout',
		icon: 'file:crossmint-checkout.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Interact with Crossmint Checkout APIs for Amazon and Shopify products',
		defaults: {
			name: 'Crossmint Checkout',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'crossmintApi',
				required: true,
			},
		],
		requestDefaults: {
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
		},
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Checkout',
						value: 'checkout',
						description: 'Crossmint checkout operations',
					},
				],
				default: 'checkout',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['checkout'],
					},
				},
				options: [
					{
						name: 'Create Order',
						value: 'findProduct',
						description: 'Search and find products on Amazon and Shopify',
						action: 'Create order',
					},
					{
						name: 'Pay Order',
						value: 'purchaseProduct',
						description: 'Purchase a product with automated checkout',
						action: 'Pay order',
					},
					{
						name: 'Paywall Request',
						value: 'paywallRequest',
						description: 'Generate payment requirements for a Crossmint Paywall',
						action: 'Paywall Request',
					},
				],
				default: 'findProduct',
			},
			{
				displayName: 'Platform',
				name: 'platform',
				type: 'options',
				displayOptions: { show: { resource: ['checkout'], operation: ['findProduct'] } },
				options: [
					{ name: 'Amazon', value: 'amazon', description: 'Amazon marketplace' },
					{ name: 'Shopify', value: 'shopify', description: 'Shopify store' },
				],
				default: 'amazon',
				description: 'E-commerce platform for the purchase',
				required: true,
			},
			// ---- Find Product fields (all fields needed for POST /orders)

			// ---- Purchase Product fields (Step 2: Submit Transaction)
			{
				displayName: 'Serialized Transaction',
				name: 'serializedTransaction',
				type: 'string',
				displayOptions: { show: { resource: ['checkout'], operation: ['purchaseProduct'] } },
				default: '',
				placeholder: 'Copy from Find Product response: order.payment.preparation.serializedTransaction',
				description: 'Serialized transaction from Find Product response',
				required: true,
			},
			{
				displayName: 'Payment Chain',
				name: 'paymentMethod',
				type: 'options',
				displayOptions: { show: { resource: ['checkout'], operation: ['purchaseProduct'] } },
				options: [
					{ name: 'Solana', value: 'solana', description: 'Solana blockchain' },
				],
				default: 'solana',
				description: 'Payment method for completing the transaction',
				required: true,
			},
			{
				displayName: 'Payer Wallet Address',
				name: 'payerAddress',
				type: 'string',
				displayOptions: { show: { resource: ['checkout'], operation: ['purchaseProduct'] } },
				default: '',
				placeholder: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
				description: 'Agent wallet address for crypto payments - must be a Crossmint managed wallet with USDC funds',
				required: true,
			},
			// External signer is always required for Pay Order
			{
				displayName: 'Private Key',
				name: 'purchasePrivateKey',
				type: 'string',
				typeOptions: { password: true },
				displayOptions: { show: { resource: ['checkout'], operation: ['purchaseProduct'] } },
				default: '',
				placeholder: 'base58 encoded private key',
				description: 'Private key to sign with (base58 for Solana) - External signer is required',
				required: true,
			},
			{
				displayName: 'Product Identifier',
				name: 'productIdentifier',
				type: 'string',
				displayOptions: { show: { resource: ['checkout'], operation: ['findProduct'], platform: ['amazon'] } },
				default: '',
				placeholder: 'B01DFKC2SO or https://www.amazon.com/dp/B01DFKC2SO',
				description: 'Amazon ASIN (e.g. B01DFKC2SO) or full Amazon product URL',
				required: true,
			},
			{
				displayName: 'Product Identifier',
				name: 'productIdentifier',
				type: 'string',
				displayOptions: { show: { resource: ['checkout'], operation: ['findProduct'], platform: ['shopify'] } },
				default: '',
				placeholder: 'https://store.shopify.com/products/product-handle',
				description: 'Full Shopify product URL (will use default variant)',
				required: true,
			},
			{
				displayName: 'Recipient Email',
				name: 'recipientEmail',
				type: 'string',
				displayOptions: { show: { resource: ['checkout'], operation: ['findProduct'] } },
				default: '',
				placeholder: 'recipient@example.com',
				description: 'Email address of the person receiving the product',
				required: true,
			},
			{
				displayName: 'Recipient Name',
				name: 'recipientName',
				type: 'string',
				displayOptions: { show: { resource: ['checkout'], operation: ['findProduct'] } },
				default: '',
				placeholder: 'Manuel Paella',
				description: 'Full name of the recipient',
				required: true,
			},
			{
				displayName: 'Address Line 1',
				name: 'addressLine1',
				type: 'string',
				displayOptions: { show: { resource: ['checkout'], operation: ['findProduct'] } },
				default: '',
				placeholder: '123 Fake Street',
				description: 'Street address, P.O. box, company name, c/o.',
				required: true,
			},
			{
				displayName: 'Address Line 2 (Optional)',
				name: 'addressLine2',
				type: 'string',
				displayOptions: { show: { resource: ['checkout'], operation: ['findProduct'] } },
				default: '',
				placeholder: 'Apartment 4B',
				description: 'Apartment, suite, unit, building, floor, etc',
			},
			{
				displayName: 'City',
				name: 'city',
				type: 'string',
				displayOptions: { show: { resource: ['checkout'], operation: ['findProduct'] } },
				default: '',
				placeholder: 'Valencia',
				description: 'City, district, suburb, town, or village',
				required: true,
			},
			{
				displayName: 'State',
				name: 'state',
				type: 'string',
				displayOptions: { show: { resource: ['checkout'], operation: ['findProduct'] } },
				default: '',
				placeholder: 'FL',
				description: 'US State (required)',
				required: true,
			},
			{
				displayName: 'ZIP Code',
				name: 'postalCode',
				type: 'string',
				displayOptions: { show: { resource: ['checkout'], operation: ['findProduct'] } },
				default: '',
				placeholder: '33130',
				description: 'US ZIP code',
				required: true,
			},
			{
				displayName: 'Country',
				name: 'country',
				type: 'options',
				displayOptions: { show: { resource: ['checkout'], operation: ['findProduct'] } },
				options: [
					{ name: 'United States', value: 'US' },
				],
				default: 'US',
				description: 'Two-letter country code (ISO 3166-1 alpha-2)',
				required: true,
			},
			{
				displayName: 'Environment',
				name: 'environment',
				type: 'options',
				displayOptions: { show: { resource: ['checkout'], operation: ['findProduct'] } },
				options: [
					{ name: 'Staging (Testnet)', value: 'staging', description: 'Use testnet chains for testing' },
					{ name: 'Production (Mainnet)', value: 'production', description: 'Use mainnet chains for real transactions' },
				],
				default: 'staging',
				description: 'Environment to use for payment methods',
				required: true,
			},
			{
				displayName: 'Payment Chain',
				name: 'paymentMethod',
				type: 'options',
				displayOptions: { show: { resource: ['checkout'], operation: ['findProduct'], environment: ['staging'] } },
				options: [
					{ name: 'Solana', value: 'solana', description: 'Solana blockchain' },
				],
				default: 'solana',
				description: 'Payment method for the purchase (Staging/Testnet)',
				required: true,
			},
			{
				displayName: 'Payment Chain',
				name: 'paymentMethod',
				type: 'options',
				displayOptions: { show: { resource: ['checkout'], operation: ['findProduct'], environment: ['production'] } },
				options: [
					{ name: 'Solana', value: 'solana', description: 'Solana blockchain' },
				],
				default: 'solana',
				description: 'Payment method for the purchase (Production/Mainnet)',
				required: true,
			},
			{
				displayName: 'Payment Currency',
				name: 'paymentCurrency',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['checkout'], operation: ['findProduct'],
						paymentMethod: ['solana'],
					},
				},
				options: [
					{ name: 'USDC', value: 'usdc', description: 'USD Coin' },
					{ name: 'SOL', value: 'sol', description: 'Solana native token' },
				],
				default: 'usdc',
				description: 'Cryptocurrency to pay with',
				required: true,
			},
			{
				displayName: 'Payer Wallet Address',
				name: 'payerAddress',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['checkout'], operation: ['findProduct'],
						paymentMethod: ['solana'],
					},
				},
				default: '',
				placeholder: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
				description: 'Agent wallet address for crypto payments - must be a Crossmint managed wallet with USDC funds',
				required: true,
			},
			// Paywall Request
			{
				displayName: 'Resource URL',
				name: 'resourceUrl',
				type: 'string',
				displayOptions: { show: { resource: ['checkout'], operation: ['paywallRequest'] } },
				default: '',
				placeholder: 'https://example.com/resource',
				description: 'URL that identifies the protected resource',
				required: true,
			},
			{
				displayName: 'Payment Rules',
				name: 'payRules',
				type: 'fixedCollection',
				displayOptions: {
					show: {
						resource: ['checkout'],
						operation: ['paywallRequest'],
					},
				},
				required: true,
				default: [],
				description: 'Ordered payment rules evaluated from top to bottom',
				typeOptions: {
					multipleValues: true,
				},
				options: [
					{
						name: 'rule',
						displayName: 'Rule',
						// eslint-disable-next-line n8n-nodes-base/node-param-fixed-collection-type-unsorted-items
						values: [
							{
								displayName: 'Payment Token',
								name: 'paymentToken',
								type: 'options',
								typeOptions: {
									loadOptionsMethod: 'getPaymentTokens',
								},
								required: true,
								default: '',
								description: 'Token that will be accepted for the payment',
							},
							{
								displayName: 'Pay To Address',
								name: 'payToAddress',
								type: 'string',
								required: true,
								default: '',
								description: 'Address that will receive the payment',
							},
						],
					},
				],
			},
		] as INodeProperties[],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const credentials = await this.getCredentials<CrossmintCredentials>('crossmintApi');
		const api = new CrossmintApi(this, credentials);

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const operation = this.getNodeParameter('operation', itemIndex) as string;
				let result: IDataObject;

				switch (operation) {
					case 'findProduct':
						result = await findProduct(this, api, itemIndex);
						break;
					case 'purchaseProduct':
						result = await purchaseProduct(this, api, itemIndex);
						break;
					case 'paywallRequest':
						result = await paywallRequest(this, itemIndex);
						break;
					default:
						throw new NodeOperationError(this.getNode(), `Unknown checkout operation: ${operation}`, {
							itemIndex,
						});
				}

				const executionData: INodeExecutionData = {
					json: result,
					pairedItem: { item: itemIndex },
				};

				returnData.push(executionData);
			} catch (error) {
				if (this.continueOnFail()) {
					const executionData: INodeExecutionData = {
						json: { error: error.message },
						pairedItem: { item: itemIndex },
					};
					returnData.push(executionData);
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}