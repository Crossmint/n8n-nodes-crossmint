import {
	INodeType,
	INodeTypeDescription,
	INodeProperties,
	NodeConnectionType,
} from 'n8n-workflow';

export class CrossmintTokens implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Crossmint Tokens',
		name: 'crossmintTokens',
		icon: 'file:token-2.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Interact with Crossmint Tokens APIs for Amazon and Shopify products',
		defaults: {
			name: 'Crossmint Tokens',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
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
						name: 'Tokens',
						value: 'Tokens',
						description: 'Crossmint tokens operations',
					},
				],
				default: 'tokens',
			},
			// Place Tokens Operation right after Resource so it appears under Resource
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['tokens'] } },
				options: [
					{
						name: 'Mint Token',
						value: 'mintToken',
						description: 'Mint a new token to a wallet',
						action: 'Mint Token',
					},
				],
				default: 'mintToken',
			},
			// ---- Mint Token fields
			{
				displayName: 'Collection ID',
				name: 'collectionId',
				type: 'string',
				displayOptions: { show: { resource: ['tokens'], operation: ['mintToken'] } },
				default: '',
				placeholder: 'default-polygon or 9c82ef99-617f-497d-9abb-fd355291681b',
				description: 'Collection identifier (default collections: default-solana, default-polygon)',
				required: true,
			},
			{
				displayName: 'Recipient',
				name: 'tokenRecipient',
				type: 'resourceLocator',
				displayOptions: { show: { resource: ['tokens'], operation: ['mintToken'] } },
				default: { mode: 'address', value: '' },
				description: 'Select the token recipient',
				modes: [
					{
						displayName: 'Email',
						name: 'email',
						type: 'string',
						placeholder: 'user@example.com',
						validation: [
							{
								type: 'regex',
								properties: {
									regex: '^[^@]+@[^@]+\\.[^@]+$',
									errorMessage: 'Please enter a valid email address',
								},
							},
						],
					},
					{
						displayName: 'User ID',
						name: 'userId',
						type: 'string',
						placeholder: 'user-123',
					},
					{
						displayName: 'Twitter',
						name: 'twitter',
						type: 'string',
						placeholder: 'username',
						validation: [
							{
								type: 'regex',
								properties: {
									regex: '^[a-zA-Z0-9_]{1,15}$',
									errorMessage: 'Please enter a valid Twitter handle (1-15 alphanumeric characters or underscores)',
								},
							},
						],
					},
					{
						displayName: 'X',
						name: 'x',
						type: 'string',
						placeholder: 'username',
						validation: [
							{
								type: 'regex',
								properties: {
									regex: '^[a-zA-Z0-9_]{1,15}$',
									errorMessage: 'Please enter a valid X handle (1-15 alphanumeric characters or underscores)',
								},
							},
						],
					},
					{
						displayName: 'Address',
						name: 'address',
						type: 'string',
						placeholder: '0x1234567890123456789012345678901234567890',
						validation: [
							{
								type: 'regex',
								properties: {
									regex: '^(0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})$',
									errorMessage: 'Please enter a valid wallet address',
								},
							},
						],
					},
				],
			},
			{
				displayName: 'Chain',
				name: 'tokenChain',
				type: 'options',
				displayOptions: { show: { resource: ['tokens'], operation: ['mintToken'] } },
				options: [
					{ name: 'Polygon', value: 'polygon' },
					{ name: 'Ethereum', value: 'ethereum' },
					{ name: 'Base', value: 'base' },
					{ name: 'Arbitrum', value: 'arbitrum' },
					{ name: 'Optimism', value: 'optimism' },
					{ name: 'Solana', value: 'solana' },
					{ name: 'Avalanche', value: 'avalanche' },
					{ name: 'BSC', value: 'bsc' },
				],
				default: 'polygon',
				description: 'Blockchain network for the token (only used for email, userId, twitter, x recipient types)',
			},
			{
				displayName: 'Metadata Type',
				name: 'metadataType',
				type: 'options',
				displayOptions: { show: { resource: ['tokens'], operation: ['mintToken'] } },
				options: [
					{ name: 'Metadata Object', value: 'object', description: 'Define metadata inline' },
					{ name: 'Metadata URL', value: 'url', description: 'Reference external JSON metadata' },
					{ name: 'Template ID', value: 'template', description: 'Use existing template' },
				],
				default: 'object',
				description: 'How to provide the token metadata',
				required: true,
			},
			{
				displayName: 'Token Name',
				name: 'tokenName',
				type: 'string',
				displayOptions: { show: { resource: ['tokens'], operation: ['mintToken'], metadataType: ['object'] } },
				default: '',
				placeholder: 'My Awesome Token',
				description: 'The name of your token (Max length: 32)',
				required: true,
			},
			{
				displayName: 'Token Image URL',
				name: 'tokenImage',
				type: 'string',
				displayOptions: { show: { resource: ['tokens'], operation: ['mintToken'], metadataType: ['object'] } },
				default: '',
				placeholder: 'https://example.com/image.png',
				description: 'Direct link to your token image',
				required: true,
			},
			{
				displayName: 'Token Description',
				name: 'tokenDescription',
				type: 'string',
				displayOptions: { show: { resource: ['tokens'], operation: ['mintToken'], metadataType: ['object'] } },
				default: '',
				placeholder: 'A brief description of the token',
				description: 'A brief description of the token (Max length: 64)',
				required: true,
			},
			{
				displayName: 'Animation URL',
				name: 'tokenAnimationUrl',
				type: 'string',
				displayOptions: { show: { resource: ['tokens'], operation: ['mintToken'], metadataType: ['object'] } },
				default: '',
				placeholder: 'https://example.com/animation.mp4',
				description: 'Animation URL for the token (EVM only)',
			},
			{
				displayName: 'Symbol (Solana)',
				name: 'tokenSymbol',
				type: 'string',
				displayOptions: { show: { resource: ['tokens'], operation: ['mintToken'], metadataType: ['object'] } },
				default: '',
				placeholder: 'MTK',
				description: 'A shorthand identifier for the token (Max length: 10, Solana only)',
			},
			{
				displayName: 'Attributes',
				name: 'tokenAttributes',
				type: 'string',
				displayOptions: { show: { resource: ['tokens'], operation: ['mintToken'], metadataType: ['object'] } },
				default: '',
				placeholder: '[{"trait_type": "Color", "value": "Blue"}, {"trait_type": "Rarity", "value": "Rare"}]',
				description: 'JSON array of attributes (optional)',
			},
			{
				displayName: 'Metadata URL',
				name: 'metadataUrl',
				type: 'string',
				displayOptions: { show: { resource: ['tokens'], operation: ['mintToken'], metadataType: ['url'] } },
				default: '',
				placeholder: 'https://example.com/metadata.json',
				description: 'URL to a JSON file containing the metadata',
				required: true,
			},
			{
				displayName: 'Template ID',
				name: 'templateId',
				type: 'string',
				displayOptions: { show: { resource: ['tokens'], operation: ['mintToken'], metadataType: ['template'] } },
				default: '',
				placeholder: 'template-12345',
				description: 'ID of the template to use for minting',
				required: true,
			},
			{
				displayName: 'Send Notification',
				name: 'sendNotification',
				type: 'boolean',
				displayOptions: { show: { resource: ['tokens'], operation: ['mintToken'] } },
				default: true,
				description: 'Notify recipient via email about successful mint',
			},
			{
				displayName: 'Locale',
				name: 'tokenLocale',
				type: 'options',
				displayOptions: { show: { resource: ['tokens'], operation: ['mintToken'] } },
				options: [
					{ name: 'English (US)', value: 'en-US' },
					{ name: 'Spanish', value: 'es' },
					{ name: 'French', value: 'fr' },
					{ name: 'German', value: 'de' },
				],
				default: 'en-US',
				description: 'Locale for email content',
			},
			{
				displayName: 'Reupload Linked Files',
				name: 'reuploadLinkedFiles',
				type: 'boolean',
				displayOptions: { show: { resource: ['tokens'], operation: ['mintToken'] } },
				default: true,
				description: 'URLs in metadata will be resolved and reuploaded to IPFS',
			},
			{
				displayName: 'Compressed (Solana)',
				name: 'compressed',
				type: 'boolean',
				displayOptions: { show: { resource: ['tokens'], operation: ['mintToken'] } },
				default: true,
				description: 'Use token compression for cheaper mint costs (Solana only)',
			},
		] as INodeProperties[],
	};

	/*async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		return ;
	}*/
}