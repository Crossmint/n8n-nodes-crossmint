import {
	INodeType,
	INodeTypeDescription,
	INodeProperties,
	NodeConnectionType,
	IExecuteFunctions,
	INodeExecutionData,
	IDataObject,
	NodeOperationError
} from 'n8n-workflow';

import { CrossmintApi } from '../../shared/transport/CrossmintApi';
import { CrossmintCredentials } from '../../shared/transport/types';
import { mintToken } from '../../shared/actions/token/mintToken';
import { getMintStatus } from '../../shared/actions/token/getMintStatus';
import { getTokensFromWallet } from '../../shared/actions/token/getTokensFromWallet';

export class CrossmintTokens implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Crossmint Tokens',
		name: 'crossmintTokens',
		icon: 'file:crossmint-tokens-img.svg',
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
						value: 'tokens',
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
					{
						name: 'Get Mint Status',
						value: 'getMintStatus',
						description: 'Get the status and associated information for a mint operation',
						action: 'Get Mint Status',
					},
					{
						name: 'Get Tokens from Wallet',
						value: 'getTokensFromWallet',
						description: 'Fetch the tokens in a provided wallet',
						action: 'Get Tokens from Wallet',
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
					{ name: 'Spanish (Spain)', value: 'es-ES' },
					{ name: 'French (France)', value: 'fr-FR' },
					{ name: 'Italian (Italy)', value: 'it-IT' },
					{ name: 'Korean (Korea)', value: 'ko-KR' },
					{ name: 'Portuguese (Portugal)', value: 'pt-PT' },
					{ name: 'Japanese (Japan)', value: 'ja-JP' },
					{ name: 'Chinese (Simplified)', value: 'zh-CN' },
					{ name: 'Chinese (Traditional)', value: 'zh-TW' },
					{ name: 'German (Germany)', value: 'de-DE' },
					{ name: 'Russian (Russia)', value: 'ru-RU' },
					{ name: 'Turkish (Turkey)', value: 'tr-TR' },
					{ name: 'Ukrainian (Ukraine)', value: 'uk-UA' },
					{ name: 'Thai (Thailand)', value: 'th-TH' },
					{ name: 'Vietnamese (Vietnam)', value: 'vi-VN' },
					{ name: 'Klingon', value: 'Klingon' },
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
			// ---- Get Mint Status fields
			{
				displayName: 'Collection ID',
				name: 'statusCollectionId',
				type: 'string',
				displayOptions: { show: { resource: ['tokens'], operation: ['getMintStatus'] } },
				default: '',
				placeholder: 'default-polygon or 9c82ef99-617f-497d-9abb-fd355291681b',
				description: 'Collection identifier (default collections: default-solana, default-polygon)',
				required: true,
			},
			{
				displayName: 'Token ID',
				name: 'tokenId',
				type: 'string',
				displayOptions: { show: { resource: ['tokens'], operation: ['getMintStatus'] } },
				default: '',
				placeholder: 'abc123-def456-ghi789',
				description: 'Unique ID of the minted token returned in the mint response',
				required: true,
			},
			// ---- Get Tokens from Wallet fields
			{
				displayName: 'Wallet',
				name: 'walletIdentifier',
				type: 'resourceLocator',
				default: { mode: 'address', value: '' },
				description: 'Select the wallet to get tokens from',
				displayOptions: { show: { resource: ['tokens'], operation: ['getTokensFromWallet'] } },
				modes: [
					{
						displayName: 'Address',
						name: 'address',
						type: 'string',
						hint: 'Enter wallet address',
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
					{
						displayName: 'Email',
						name: 'email',
						type: 'string',
						hint: 'Enter email address',
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
						hint: 'Enter user ID',
						placeholder: 'user-123',
					},
					{
						displayName: 'Phone',
						name: 'phoneNumber',
						type: 'string',
						hint: 'Enter phone number with country code',
						placeholder: '+1234567890',
						validation: [
							{
								type: 'regex',
								properties: {
									regex: '^\\+[1-9]\\d{1,14}$',
									errorMessage: 'Please enter a valid phone number with country code',
								},
							},
						],
					},
					{
						displayName: 'Twitter',
						name: 'twitter',
						type: 'string',
						hint: 'Enter Twitter handle (without @)',
						placeholder: 'username',
					},
					{
						displayName: 'X',
						name: 'x',
						type: 'string',
						hint: 'Enter X handle (without @)',
						placeholder: 'username',
					},
				],
			},
			{
				displayName: 'Chain',
				name: 'walletChain',
				type: 'options',
				displayOptions: { show: { resource: ['tokens'], operation: ['getTokensFromWallet'] } },
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
				description: 'Blockchain network (only needed for email, userId, phoneNumber, twitter, x modes)',
				required: true,
			},
			{
				displayName: 'Options',
				name: 'walletTokensOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: { show: { resource: ['tokens'], operation: ['getTokensFromWallet'] } },
				options: [
					{
						displayName: 'Page',
						name: 'page',
						type: 'number',
						default: 1,
						description: 'Page index',
						typeOptions: {
							minValue: 1,
						},
					},
					{
						displayName: 'Per Page',
						name: 'perPage',
						type: 'number',
						default: 20,
						description: 'Number of items to display per page',
						typeOptions: {
							minValue: 1,
							maxValue: 100,
						},
					},
					{
						displayName: 'Contract Address',
						name: 'contractAddress',
						type: 'string',
						default: '',
						placeholder: '0x1234567890123456789012345678901234567890',
						description: 'Filter tokens by contract address (comma-separated for multiple)',
					},
					{
						displayName: 'Token ID',
						name: 'tokenId',
						type: 'string',
						default: '',
						placeholder: '123',
						description: 'Filter tokens by token ID',
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
					case 'mintToken':
						result = await mintToken(this, api, itemIndex);
						break;
					case 'getMintStatus':
						result = await getMintStatus(this, api, itemIndex);
						break;
					case 'getTokensFromWallet':
						result = await getTokensFromWallet(this, api, itemIndex);
						break;
					default:
						throw new NodeOperationError(this.getNode(), `Unknown token operation: ${operation}`, {
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