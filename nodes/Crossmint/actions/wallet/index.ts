import { INodeProperties } from 'n8n-workflow';

export { createWallet } from './createWallet.operation';
export { getWallet } from './getWallet.operation';
export { getBalance } from './getBalance.operation';
export { transferToken } from './transferToken.operation';
export { signTransaction } from './signTransaction.operation';

export const walletFields: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['wallet'],
			},
		},
		options: [
			{
				name: 'Create Wallet',
				value: 'createWallet',
				description: 'Create a new smart wallet',
				action: 'Create a wallet',
			},
			{
				name: 'Get Wallet',
				value: 'getWallet',
				description: 'Get wallet information',
				action: 'Get a wallet',
			},
			{
				name: 'Get Balance',
				value: 'getBalance',
				description: 'Get wallet balance',
				action: 'Get wallet balance',
			},
			{
				name: 'Transfer Token',
				value: 'transferToken',
				description: 'Transfer tokens between wallets',
				action: 'Transfer tokens',
			},
			{
				name: 'Sign and Submit Transaction',
				value: 'signAndSubmitTransaction',
				description: 'Sign and submit a transaction',
				action: 'Sign and submit transaction',
			},
		],
		default: 'createWallet',
	},

	{
		displayName: 'Chain Type',
		name: 'chainType',
		type: 'options',
		required: true,
		displayOptions: {
			show: {
				resource: ['wallet'],
				operation: ['createWallet'],
			},
		},
		options: [
			{
				name: 'EVM',
				value: 'evm',
				description: 'Ethereum Virtual Machine compatible chains',
			},
			{
				name: 'Solana',
				value: 'solana',
				description: 'Solana blockchain',
			},
		],
		default: 'evm',
		description: 'The blockchain type for the wallet',
	},

	{
		displayName: 'Owner Type',
		name: 'ownerType',
		type: 'options',
		required: true,
		displayOptions: {
			show: {
				resource: ['wallet'],
				operation: ['createWallet'],
			},
		},
		options: [
			{
				name: 'None',
				value: 'none',
				description: 'No owner specified',
			},
			{
				name: 'Email',
				value: 'email',
				description: 'Email address',
			},
			{
				name: 'User ID',
				value: 'userId',
				description: 'User identifier',
			},
			{
				name: 'Phone Number',
				value: 'phoneNumber',
				description: 'Phone number',
			},
			{
				name: 'Twitter',
				value: 'twitter',
				description: 'Twitter handle',
			},
			{
				name: 'X (Twitter)',
				value: 'x',
				description: 'X (formerly Twitter) handle',
			},
		],
		default: 'none',
		description: 'The type of owner identifier',
	},

	{
		displayName: 'Owner Email',
		name: 'ownerEmail',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['wallet'],
				operation: ['createWallet'],
				ownerType: ['email'],
			},
		},
		default: '',
		placeholder: 'user@example.com',
		description: 'Email address of the wallet owner',
	},

	{
		displayName: 'Owner User ID',
		name: 'ownerUserId',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['wallet'],
				operation: ['createWallet'],
				ownerType: ['userId'],
			},
		},
		default: '',
		placeholder: 'user123',
		description: 'User ID of the wallet owner',
	},

	{
		displayName: 'Owner Phone Number',
		name: 'ownerPhoneNumber',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['wallet'],
				operation: ['createWallet'],
				ownerType: ['phoneNumber'],
			},
		},
		default: '',
		placeholder: '+1234567890',
		description: 'Phone number of the wallet owner',
	},

	{
		displayName: 'Owner Twitter Handle',
		name: 'ownerTwitterHandle',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['wallet'],
				operation: ['createWallet'],
				ownerType: ['twitter'],
			},
		},
		default: '',
		placeholder: 'username',
		description: 'Twitter handle of the wallet owner (without @)',
	},

	{
		displayName: 'Owner X Handle',
		name: 'ownerXHandle',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['wallet'],
				operation: ['createWallet'],
				ownerType: ['x'],
			},
		},
		default: '',
		placeholder: 'username',
		description: 'X (formerly Twitter) handle of the wallet owner (without @)',
	},

	{
		displayName: 'External Signer Private Key',
		name: 'externalSignerDetails',
		type: 'string',
		typeOptions: {
			password: true,
		},
		required: true,
		displayOptions: {
			show: {
				resource: ['wallet'],
				operation: ['createWallet'],
			},
		},
		default: '',
		placeholder: '0x1234... or base58 encoded key',
		description: 'Private key for the external signer (32-byte hex for EVM, base58 for Solana)',
	},

	{
		displayName: 'Wallet Locator',
		name: 'getWalletLocator',
		type: 'resourceLocator',
		default: { mode: 'address', value: '' },
		required: true,
		displayOptions: {
			show: {
				resource: ['wallet'],
				operation: ['getWallet'],
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
				displayName: 'Phone Number',
				name: 'phoneNumber',
				type: 'string',
				placeholder: '+1234567890',
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
		description: 'How to identify the wallet',
	},

	{
		displayName: 'Chain Type',
		name: 'getWalletChainType',
		type: 'options',
		required: true,
		displayOptions: {
			show: {
				resource: ['wallet'],
				operation: ['getWallet'],
				'/getWalletLocator.mode': ['email', 'userId', 'phoneNumber', 'twitter', 'x'],
			},
		},
		options: [
			{
				name: 'EVM',
				value: 'evm',
				description: 'Ethereum Virtual Machine compatible chains',
			},
			{
				name: 'Solana',
				value: 'solana',
				description: 'Solana blockchain',
			},
		],
		default: 'evm',
		description: 'The blockchain type (required for non-address locators)',
	},

	{
		displayName: 'Wallet Locator',
		name: 'walletLocator',
		type: 'resourceLocator',
		default: { mode: 'address', value: '' },
		required: true,
		displayOptions: {
			show: {
				resource: ['wallet'],
				operation: ['getBalance'],
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
				displayName: 'Phone Number',
				name: 'phoneNumber',
				type: 'string',
				placeholder: '+1234567890',
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
		description: 'How to identify the wallet',
	},

	{
		displayName: 'Chain Type',
		name: 'balanceWalletChainType',
		type: 'options',
		required: true,
		displayOptions: {
			show: {
				resource: ['wallet'],
				operation: ['getBalance'],
				'/walletLocator.mode': ['email', 'userId', 'phoneNumber', 'twitter', 'x'],
			},
		},
		options: [
			{
				name: 'EVM',
				value: 'evm',
				description: 'Ethereum Virtual Machine compatible chains',
			},
			{
				name: 'Solana',
				value: 'solana',
				description: 'Solana blockchain',
			},
		],
		default: 'evm',
		description: 'The blockchain type (required for non-address locators)',
	},

	{
		displayName: 'Chains',
		name: 'chains',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['wallet'],
				operation: ['getBalance'],
			},
		},
		default: 'ethereum-sepolia',
		placeholder: 'ethereum-sepolia,polygon-amoy',
		description: 'Comma-separated list of chains to check balances for',
	},

	{
		displayName: 'Tokens',
		name: 'tokens',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['wallet'],
				operation: ['getBalance'],
			},
		},
		default: 'native',
		placeholder: 'native,usdc,usdt',
		description: 'Comma-separated list of tokens to check balances for',
	},

	{
		displayName: 'Amount',
		name: 'amount',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['wallet'],
				operation: ['transferToken'],
			},
		},
		default: '',
		placeholder: '1.5',
		description: 'Amount of tokens to transfer',
		validation: [
			{
				type: 'regex',
				properties: {
					regex: '^\\d+(\\.\\d+)?$',
					errorMessage: 'Please enter a valid positive number',
				},
			},
		],
	},

	{
		displayName: 'Token Chain',
		name: 'tokenChain',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['wallet'],
				operation: ['transferToken'],
			},
		},
		default: 'ethereum-sepolia',
		placeholder: 'ethereum-sepolia',
		description: 'The blockchain chain for the token',
	},

	{
		displayName: 'Token Name',
		name: 'tokenName',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['wallet'],
				operation: ['transferToken'],
			},
		},
		default: 'usdc',
		placeholder: 'usdc',
		description: 'The token identifier (e.g., usdc, native)',
	},

	{
		displayName: 'Blockchain Type',
		name: 'blockchainType',
		type: 'options',
		required: true,
		displayOptions: {
			show: {
				resource: ['wallet'],
				operation: ['transferToken'],
			},
		},
		options: [
			{
				name: 'EVM',
				value: 'evm',
				description: 'Ethereum Virtual Machine compatible chains',
			},
			{
				name: 'Solana',
				value: 'solana',
				description: 'Solana blockchain',
			},
		],
		default: 'evm',
		description: 'The blockchain type for both wallets',
	},

	{
		displayName: 'Origin Wallet',
		name: 'originWallet',
		type: 'resourceLocator',
		default: { mode: 'address', value: '' },
		required: true,
		displayOptions: {
			show: {
				resource: ['wallet'],
				operation: ['transferToken'],
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
				displayName: 'Phone Number',
				name: 'phoneNumber',
				type: 'string',
				placeholder: '+1234567890',
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
		description: 'The wallet to transfer tokens from',
	},

	{
		displayName: 'Recipient Wallet',
		name: 'recipientWallet',
		type: 'resourceLocator',
		default: { mode: 'address', value: '' },
		required: true,
		displayOptions: {
			show: {
				resource: ['wallet'],
				operation: ['transferToken'],
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
				displayName: 'Phone Number',
				name: 'phoneNumber',
				type: 'string',
				placeholder: '+1234567890',
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
		description: 'The wallet to transfer tokens to',
	},

	{
		displayName: 'Chain',
		name: 'signSubmitChain',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['wallet'],
				operation: ['signAndSubmitTransaction'],
			},
		},
		default: 'ethereum-sepolia',
		placeholder: 'ethereum-sepolia',
		description: 'The blockchain chain for the transaction',
	},

	{
		displayName: 'Private Key',
		name: 'signSubmitPrivateKey',
		type: 'string',
		typeOptions: {
			password: true,
		},
		required: true,
		displayOptions: {
			show: {
				resource: ['wallet'],
				operation: ['signAndSubmitTransaction'],
			},
		},
		default: '',
		placeholder: '0x1234... or base58 encoded key',
		description: 'Private key for signing the transaction',
	},

	{
		displayName: 'Transaction Data',
		name: 'signSubmitTransactionData',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['wallet'],
				operation: ['signAndSubmitTransaction'],
			},
		},
		default: '',
		placeholder: 'Transaction data to sign',
		description: 'The transaction data or message to sign',
	},

	{
		displayName: 'Wallet Address',
		name: 'signSubmitWalletAddress',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['wallet'],
				operation: ['signAndSubmitTransaction'],
			},
		},
		default: '',
		placeholder: '0x1234... or base58 address',
		description: 'The wallet address for the transaction',
	},

	{
		displayName: 'Transaction ID',
		name: 'signSubmitTransactionId',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['wallet'],
				operation: ['signAndSubmitTransaction'],
			},
		},
		default: '',
		placeholder: 'transaction-id-123',
		description: 'The transaction ID to approve',
	},

	{
		displayName: 'Signer Address',
		name: 'signSubmitSignerAddress',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['wallet'],
				operation: ['signAndSubmitTransaction'],
			},
		},
		default: '',
		placeholder: '0x1234... or base58 address',
		description: 'The address of the signer',
	},

	{
		displayName: 'Wait for Completion',
		name: 'waitForCompletion',
		type: 'boolean',
		displayOptions: {
			show: {
				resource: ['wallet'],
				operation: ['signAndSubmitTransaction'],
			},
		},
		default: false,
		description: 'Whether to wait for the transaction to complete before returning',
	},
];
