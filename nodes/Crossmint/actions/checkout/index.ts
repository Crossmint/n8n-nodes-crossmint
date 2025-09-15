import { INodeProperties } from 'n8n-workflow';

export { findProduct } from './findProduct.operation';
export { purchaseProduct } from './purchaseProduct.operation';

export const checkoutFields: INodeProperties[] = [
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
				name: 'Find Product',
				value: 'findProduct',
				description: 'Find and create order for a product',
				action: 'Find a product',
			},
			{
				name: 'Purchase Product',
				value: 'purchaseProduct',
				description: 'Complete purchase of a product',
				action: 'Purchase a product',
			},
		],
		default: 'findProduct',
	},

	{
		displayName: 'Platform',
		name: 'platform',
		type: 'options',
		required: true,
		displayOptions: {
			show: {
				resource: ['checkout'],
				operation: ['findProduct'],
			},
		},
		options: [
			{
				name: 'Amazon',
				value: 'amazon',
				description: 'Amazon marketplace',
			},
			{
				name: 'Shopify',
				value: 'shopify',
				description: 'Shopify store',
			},
		],
		default: 'amazon',
		description: 'The e-commerce platform',
	},

	{
		displayName: 'Product Identifier',
		name: 'productIdentifier',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['checkout'],
				operation: ['findProduct'],
			},
		},
		default: '',
		placeholder: 'ASIN for Amazon or product handle for Shopify',
		description: 'Product identifier (ASIN for Amazon, product handle for Shopify)',
	},

	{
		displayName: 'Recipient Email',
		name: 'recipientEmail',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['checkout'],
				operation: ['findProduct'],
			},
		},
		default: '',
		placeholder: 'recipient@example.com',
		description: 'Email address of the product recipient',
		validation: [
			{
				type: 'regex',
				properties: {
					regex: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
					errorMessage: 'Please enter a valid email address',
				},
			},
		],
	},

	{
		displayName: 'Recipient Name',
		name: 'recipientName',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['checkout'],
				operation: ['findProduct'],
			},
		},
		default: '',
		placeholder: 'John Doe',
		description: 'Full name of the person receiving the product',
	},

	{
		displayName: 'Address Line 1',
		name: 'addressLine1',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['checkout'],
				operation: ['findProduct'],
			},
		},
		default: '',
		placeholder: '123 Main Street',
		description: 'Street address, P.O. box, or company name',
	},

	{
		displayName: 'Address Line 2',
		name: 'addressLine2',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['checkout'],
				operation: ['findProduct'],
			},
		},
		default: '',
		placeholder: 'Apartment, suite, unit, building, floor, etc.',
		description: 'Additional address information (optional)',
	},

	{
		displayName: 'City',
		name: 'city',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['checkout'],
				operation: ['findProduct'],
			},
		},
		default: '',
		placeholder: 'New York',
		description: 'City, district, suburb, town, or village',
	},

	{
		displayName: 'State',
		name: 'state',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['checkout'],
				operation: ['findProduct'],
			},
		},
		default: '',
		placeholder: 'NY',
		description: 'State, province, or region (optional)',
	},

	{
		displayName: 'Postal Code',
		name: 'postalCode',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['checkout'],
				operation: ['findProduct'],
			},
		},
		default: '',
		placeholder: '10001',
		description: 'ZIP or postal code',
	},

	{
		displayName: 'Country',
		name: 'country',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['checkout'],
				operation: ['findProduct'],
			},
		},
		default: 'US',
		placeholder: 'US',
		description: 'Country code',
	},

	{
		displayName: 'Payment Method',
		name: 'paymentMethod',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['checkout'],
				operation: ['findProduct'],
			},
		},
		default: 'ethereum-sepolia',
		placeholder: 'ethereum-sepolia',
		description: 'Payment method/chain identifier',
	},

	{
		displayName: 'Payment Currency',
		name: 'paymentCurrency',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['checkout'],
				operation: ['findProduct'],
			},
		},
		default: 'usdc',
		placeholder: 'usdc',
		description: 'Currency for payment',
	},

	{
		displayName: 'Payer Address',
		name: 'payerAddress',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['checkout'],
				operation: ['findProduct'],
			},
		},
		default: '',
		placeholder: '0x1234... or base58 address',
		description: 'Wallet address of the payer (optional)',
	},

	{
		displayName: 'Serialized Transaction',
		name: 'serializedTransaction',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['checkout'],
				operation: ['purchaseProduct'],
			},
		},
		default: '',
		placeholder: 'Serialized transaction from Create Order response',
		description: 'The serialized transaction data from the order creation',
	},

	{
		displayName: 'Payer Address',
		name: 'payerAddress',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['checkout'],
				operation: ['purchaseProduct'],
			},
		},
		default: '',
		placeholder: '0x1234... or base58 address',
		description: 'Wallet address of the payer',
	},

	{
		displayName: 'Payment Method',
		name: 'paymentMethod',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['checkout'],
				operation: ['purchaseProduct'],
			},
		},
		default: 'ethereum-sepolia',
		placeholder: 'ethereum-sepolia',
		description: 'Payment method/chain identifier',
	},

	{
		displayName: 'Private Key',
		name: 'purchasePrivateKey',
		type: 'string',
		typeOptions: {
			password: true,
		},
		required: true,
		displayOptions: {
			show: {
				resource: ['checkout'],
				operation: ['purchaseProduct'],
			},
		},
		default: '',
		placeholder: '0x1234... or base58 encoded key',
		description: 'Private key for signing the purchase transaction',
	},
];
