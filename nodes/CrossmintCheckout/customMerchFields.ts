import { INodeProperties } from 'n8n-workflow';

export const customMerchFields: INodeProperties[] = [
	{
		displayName: 'Platform',
		name: 'platform',
		type: 'options',
		displayOptions: {
			show: {
				resource: ['checkout'],
				operation: ['findProduct'],
				'@version': [2],
			},
		},
		options: [
			{ name: 'Amazon', value: 'amazon', description: 'Amazon marketplace' },
			{ name: 'Shopify', value: 'shopify', description: 'Shopify store' },
			{ name: 'Custom Merch', value: 'customMerch', description: 'Direct URL products with variant attributes' },
		],
		default: 'amazon',
		description: 'E-commerce platform for the purchase',
		required: true,
	},
	{
		displayName: 'Variant Size',
		name: 'variantSize',
		type: 'options',
		displayOptions: {
			show: {
				resource: ['checkout'],
				operation: ['findProduct'],
				platform: ['customMerch'],
				'@version': [2],
			},
		},
		options: [
			{ name: 'XS', value: 'XS' },
			{ name: 'S', value: 'S' },
			{ name: 'M', value: 'M' },
			{ name: 'L', value: 'L' },
			{ name: 'XL', value: 'XL' },
			{ name: 'XXL', value: 'XXL' },
		],
		default: 'M',
		description: 'Size variant to send with the order',
		required: true,
	},
	{
		displayName: 'Variant Color',
		name: 'variantColor',
		type: 'options',
		displayOptions: {
			show: {
				resource: ['checkout'],
				operation: ['findProduct'],
				platform: ['customMerch'],
				'@version': [2],
			},
		},
		options: [
			{ name: 'Black', value: 'black' },
			{ name: 'White', value: 'white' },
		],
		default: 'white',
		description: 'Color variant to send with the order',
		required: true,
	},
	{
		displayName: 'Design URL',
		name: 'designUrl',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['checkout'],
				operation: ['findProduct'],
				platform: ['customMerch'],
				'@version': [2],
			},
		},
		default: '',
		placeholder: 'https://www.crossmint.com/assets/crossmint/logo.png',
		description: 'Hosted asset URL for the custom design artwork',
		required: true,
	},
	{
		displayName: 'Shipping Address',
		name: 'shippingAddressUi',
		placeholder: 'Add Shipping Address',
		type: 'fixedCollection',
		default: {},
		description: 'Recipient shipping address details',
		displayOptions: {
			show: { resource: ['checkout'], operation: ['findProduct'], platform: ['customMerch'], '@version': [2] },
		},
		options: [
			{
				name: 'shippingAddressValues',
				displayName: 'Address',
				values: [
					{
						displayName: 'Recipient Email',
						name: 'recipientEmail',
						type: 'string',
						default: '',
						placeholder: 'recipient@example.com',
						description: 'Email address of the person receiving the product',
						required: true,
					},
					{
						displayName: 'Recipient Name',
						name: 'recipientName',
						type: 'string',
						default: '',
						placeholder: 'Manuel Paella',
						description: 'Full name of the recipient',
						required: true,
					},
					{
						displayName: 'Address Line 1',
						name: 'addressLine1',
						type: 'string',
						default: '',
						placeholder: '123 Fake Street',
						description: 'Street address, P.O. box, company name, c/o.',
						required: true,
					},
					{
						displayName: 'Address Line 2 (Optional)',
						name: 'addressLine2',
						type: 'string',
						default: '',
						placeholder: 'Apartment 4B',
						description: 'Apartment, suite, unit, building, floor, etc',
					},
					{
						displayName: 'City',
						name: 'city',
						type: 'string',
						default: '',
						placeholder: 'Valencia',
						description: 'City, district, suburb, town, or village',
						required: true,
					},
					{
						displayName: 'State/Province',
						name: 'state',
						type: 'string',
						default: '',
						placeholder: 'FL, Ontario, or leave empty if not applicable',
						description: 'State, province, or region (optional - leave empty if your country does not use this)',
					},
					{
						displayName: 'Postal Code',
						name: 'postalCode',
						type: 'string',
						default: '',
						placeholder: '33130, SW1A 1AA, 75001, etc.',
						description: 'Postal or ZIP code for the recipient address',
						required: true,
					},
					{
						displayName: 'Country Code',
						name: 'country',
						type: 'string',
						default: '',
						placeholder: 'US, GB, FR, DE, etc.',
						description: 'Two-letter ISO 3166-1 alpha-2 country code (e.g., US, GB, FR, DE). Must be exactly 2 uppercase letters.',
						required: true,
					},
				],
			},
		],
	},
	{
		displayName: 'Payment Details',
		name: 'paymentDetailsUi',
		placeholder: 'Add Payment Details',
		type: 'fixedCollection',
		default: {},
		description: 'Payment method and wallet configuration',
		displayOptions: {
			show: { resource: ['checkout'], operation: ['findProduct'], platform: ['customMerch'], '@version': [2] },
		},
		options: [
			{
				name: 'paymentDetailsValues',
				displayName: 'Payment',
				values: [
					{
						displayName: 'Payment Receipt Email',
						name: 'paymentReceiptEmail',
						type: 'string',
						default: '',
						placeholder: 'billing@example.com',
						description: 'Email address for payment receipt (defaults to recipient email when empty)',
					},
					{
						displayName: 'Environment',
						name: 'environment',
						type: 'options',
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
						displayOptions: {
							show: {
								environment: ['staging'],
							},
						},
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
						displayOptions: {
							show: {
								environment: ['production'],
							},
						},
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
								paymentMethod: ['solana'],
							},
						},
						default: '',
						placeholder: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
						description: 'Agent wallet address for crypto payments - must be a Crossmint managed wallet with USDC funds',
						required: true,
					},
				],
			},
		],
	},
];

