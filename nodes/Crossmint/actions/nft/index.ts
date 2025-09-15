import { INodeProperties } from 'n8n-workflow';

export { mintNFT } from './mintNFT.operation';
export { getNFTsFromWallet } from './getNFTsFromWallet.operation';

export const nftFields: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['nft'],
			},
		},
		options: [
			{
				name: 'Mint NFT',
				value: 'mintNFT',
				description: 'Mint a new NFT',
				action: 'Mint an NFT',
			},
			{
				name: 'Get NFTs from Wallet',
				value: 'getNFTsFromWallet',
				description: 'Get NFTs owned by a wallet',
				action: 'Get NFTs from wallet',
			},
		],
		default: 'mintNFT',
	},

	{
		displayName: 'Collection ID',
		name: 'collectionId',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['nft'],
				operation: ['mintNFT'],
			},
		},
		default: '',
		placeholder: 'collection-id-123',
		description: 'The collection identifier to mint the NFT in',
	},

	{
		displayName: 'NFT Recipient',
		name: 'nftRecipient',
		type: 'resourceLocator',
		default: { mode: 'address', value: '' },
		required: true,
		displayOptions: {
			show: {
				resource: ['nft'],
				operation: ['mintNFT'],
			},
		},
		modes: [
			{
				displayName: 'Address',
				name: 'address',
				type: 'string',
				placeholder: '0x1234... or base58 address',
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
				placeholder: 'user@example.com',
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
				displayName: 'User ID',
				name: 'userId',
				type: 'string',
				placeholder: 'user123',
			},
			{
				displayName: 'Twitter',
				name: 'twitter',
				type: 'string',
				placeholder: 'username',
			},
			{
				displayName: 'X (Twitter)',
				name: 'x',
				type: 'string',
				placeholder: 'username',
			},
		],
		description: 'Who should receive the NFT',
	},

	{
		displayName: 'Chain',
		name: 'nftChain',
		type: 'options',
		required: true,
		displayOptions: {
			show: {
				resource: ['nft'],
				operation: ['mintNFT'],
				'/nftRecipient.mode': ['email', 'userId', 'twitter', 'x'],
			},
		},
		options: [
			{
				name: 'Polygon',
				value: 'polygon',
				description: 'Polygon blockchain',
			},
			{
				name: 'Solana',
				value: 'solana',
				description: 'Solana blockchain',
			},
		],
		default: 'polygon',
		description: 'The blockchain for the NFT (required for non-address recipients)',
	},

	{
		displayName: 'Metadata Type',
		name: 'metadataType',
		type: 'options',
		required: true,
		displayOptions: {
			show: {
				resource: ['nft'],
				operation: ['mintNFT'],
			},
		},
		options: [
			{
				name: 'Template',
				value: 'template',
				description: 'Use a predefined template',
			},
			{
				name: 'URL',
				value: 'url',
				description: 'Provide metadata URL',
			},
			{
				name: 'Object',
				value: 'object',
				description: 'Define metadata object',
			},
		],
		default: 'object',
		description: 'How to specify the NFT metadata',
	},

	{
		displayName: 'Template ID',
		name: 'templateId',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['nft'],
				operation: ['mintNFT'],
				metadataType: ['template'],
			},
		},
		default: '',
		placeholder: 'template-id-123',
		description: 'The template ID to use for the NFT',
	},

	{
		displayName: 'Metadata URL',
		name: 'metadataUrl',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['nft'],
				operation: ['mintNFT'],
				metadataType: ['url'],
			},
		},
		default: '',
		placeholder: 'https://example.com/metadata.json',
		description: 'URL pointing to the NFT metadata JSON',
	},

	{
		displayName: 'NFT Name',
		name: 'nftName',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['nft'],
				operation: ['mintNFT'],
				metadataType: ['object'],
			},
		},
		default: '',
		placeholder: 'My Awesome NFT',
		description: 'Name of the NFT',
	},

	{
		displayName: 'NFT Image',
		name: 'nftImage',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['nft'],
				operation: ['mintNFT'],
				metadataType: ['object'],
			},
		},
		default: '',
		placeholder: 'https://example.com/image.png',
		description: 'URL of the NFT image',
	},

	{
		displayName: 'NFT Description',
		name: 'nftDescription',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['nft'],
				operation: ['mintNFT'],
				metadataType: ['object'],
			},
		},
		default: '',
		placeholder: 'This is an awesome NFT',
		description: 'Description of the NFT',
	},

	{
		displayName: 'Animation URL',
		name: 'nftAnimationUrl',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['nft'],
				operation: ['mintNFT'],
				metadataType: ['object'],
			},
		},
		default: '',
		placeholder: 'https://example.com/animation.mp4',
		description: 'URL of the NFT animation (optional)',
	},

	{
		displayName: 'Symbol',
		name: 'nftSymbol',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['nft'],
				operation: ['mintNFT'],
				metadataType: ['object'],
			},
		},
		default: '',
		placeholder: 'MYNFT',
		description: 'Symbol for the NFT (optional)',
	},

	{
		displayName: 'Attributes',
		name: 'nftAttributes',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['nft'],
				operation: ['mintNFT'],
				metadataType: ['object'],
			},
		},
		default: '',
		placeholder: '[{"trait_type": "Color", "value": "Blue"}]',
		description: 'JSON array of NFT attributes (optional)',
	},

	{
		displayName: 'Send Notification',
		name: 'sendNotification',
		type: 'boolean',
		displayOptions: {
			show: {
				resource: ['nft'],
				operation: ['mintNFT'],
			},
		},
		default: true,
		description: 'Whether to send a notification to the recipient',
	},

	{
		displayName: 'Locale',
		name: 'nftLocale',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['nft'],
				operation: ['mintNFT'],
			},
		},
		default: 'en-US',
		placeholder: 'en-US',
		description: 'Locale for notifications',
	},

	{
		displayName: 'Reupload Linked Files',
		name: 'reuploadLinkedFiles',
		type: 'boolean',
		displayOptions: {
			show: {
				resource: ['nft'],
				operation: ['mintNFT'],
			},
		},
		default: false,
		description: 'Whether to reupload linked files to IPFS',
	},

	{
		displayName: 'Compressed',
		name: 'compressed',
		type: 'boolean',
		displayOptions: {
			show: {
				resource: ['nft'],
				operation: ['mintNFT'],
			},
		},
		default: false,
		description: 'Whether to use compressed NFTs (Solana only)',
	},

	{
		displayName: 'Wallet Identifier',
		name: 'walletIdentifier',
		type: 'resourceLocator',
		default: { mode: 'address', value: '' },
		required: true,
		displayOptions: {
			show: {
				resource: ['nft'],
				operation: ['getNFTsFromWallet'],
			},
		},
		modes: [
			{
				displayName: 'Address',
				name: 'address',
				type: 'string',
				placeholder: '0x1234... or base58 address',
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
				placeholder: 'user@example.com',
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
				displayName: 'User ID',
				name: 'userId',
				type: 'string',
				placeholder: 'user123',
			},
		],
		description: 'How to identify the wallet',
	},

	{
		displayName: 'Chain',
		name: 'nftsWalletChain',
		type: 'options',
		required: true,
		displayOptions: {
			show: {
				resource: ['nft'],
				operation: ['getNFTsFromWallet'],
				'/walletIdentifier.mode': ['email', 'userId'],
			},
		},
		options: [
			{
				name: 'Polygon',
				value: 'polygon',
				description: 'Polygon blockchain',
			},
			{
				name: 'Solana',
				value: 'solana',
				description: 'Solana blockchain',
			},
		],
		default: 'polygon',
		description: 'The blockchain to search for NFTs (required for non-address identifiers)',
	},

	{
		displayName: 'Contract Addresses',
		name: 'contractAddresses',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['nft'],
				operation: ['getNFTsFromWallet'],
			},
		},
		default: '',
		placeholder: '0x1234...,0x5678...',
		description: 'Comma-separated list of contract addresses to filter by (optional)',
	},

	{
		displayName: 'Token ID',
		name: 'nftsTokenId',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['nft'],
				operation: ['getNFTsFromWallet'],
			},
		},
		default: '',
		placeholder: '123',
		description: 'Specific token ID to filter by (optional)',
	},
];
