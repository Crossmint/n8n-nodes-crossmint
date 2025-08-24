import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IHttpRequestOptions,
} from 'n8n-workflow';
import { NodeConnectionType, NodeOperationError, NodeApiError, ApplicationError } from 'n8n-workflow';
import { createHash, createPrivateKey, sign, createPublicKey, createECDH } from 'crypto';

export class CrossmintNode implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Crossmint',
		name: 'crossmintNode',
		icon: 'file:logo.svg',
		group: ['blockchain'],
		version: 1,
		description: 'Hybrid integration: transfer money using Crossmint with external wallet support',
		defaults: {
			name: 'Crossmint',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		credentials: [
			{
				name: 'crossmintApi',
				required: true,
				displayOptions: {
					show: {
						operation: ['createWallet', 'getWallet', 'transferToken', 'getBalance'],
					},
				},
			},
			{
				name: 'crossmintPrivateKeyApi',
				required: true,
				displayOptions: {
					show: {
						operation: ['signTransaction'],
					},
				},
			},
			{
				name: 'crossmintPrivateKeyApi',
				required: true,
				displayOptions: {
					show: {
						operation: ['createWallet'],
						ownerType: ['externalSigner'],
					},
				},
			},
		],

		properties: [
			// =========================
			// RESOURCE (agrupa Actions)
			// =========================
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Wallet', value: 'wallet' },
					{ name: 'Checkout', value: 'checkout' },
				],
				default: 'wallet',
				description: 'Select the Crossmint resource',
			},

			// =========================
			// WALLET ACTIONS
			// =========================
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['wallet'] } },
				options: [
					{
						name: 'Get or Create Wallet',
						value: 'createWallet',
						description: 'Get or Create Crossmint wallet for company or user',
						action: 'Get or create wallet',
					},
					{
						name: 'Get Wallet',
						value: 'getWallet',
						description: 'Retrieve a wallet by its locator',
						action: 'Get wallet',
					},
					{
						name: 'Transfer Token',
						value: 'transferToken',
						description: 'Transfer Token from Crossmint wallet to any address',
						action: 'Transfer token',
					},
					{
						name: 'Get Balance',
						value: 'getBalance',
						description: 'Get balance of any wallet',
						action: 'Get balance',
					},
					{
						name: 'Sign Transaction',
						value: 'signTransaction',
						description: 'Sign EVM or Solana transaction with private key',
						action: 'Sign transaction',
					},
				],
				default: 'transferToken',
			},

			// ---- Get or Create Wallet fields
			{
				displayName: 'Chain Type',
				name: 'chainType',
				type: 'options',
				displayOptions: { show: { resource: ['wallet'], operation: ['createWallet'] } },
				options: [
					{ name: 'EVM', value: 'evm', description: 'Ethereum Virtual Machine' },
					{ name: 'Solana', value: 'solana', description: 'Solana blockchain' },
				],
				default: 'evm',
				description: 'Blockchain type',
			},
			{
				displayName: 'Owner Type (Optional)',
				name: 'ownerType',
				type: 'options',
				displayOptions: { show: { resource: ['wallet'], operation: ['createWallet'] } },
				options: [
					{ name: 'None', value: 'none', description: 'No owner specified' },
					{ name: 'Email', value: 'email', description: 'Use email address as owner' },
					{ name: 'User ID', value: 'userId', description: 'Use user ID as owner' },
					{ name: 'Phone Number', value: 'phoneNumber', description: 'Use phone number as owner' },
					{ name: 'Twitter Handle', value: 'twitter', description: 'Use Twitter handle as owner' },
					{ name: 'X Handle', value: 'x', description: 'Use X handle as owner' },
					{ name: 'External Signer', value: 'externalSigner', description: 'Use external private key as wallet signer' },
				],
				default: 'none',
				description: 'Type of user locator to identify the wallet owner',
			},
			{
				displayName: 'Owner Email',
				name: 'ownerEmail',
				type: 'string',
				displayOptions: { show: { resource: ['wallet'], operation: ['createWallet'], ownerType: ['email'] } },
				default: '',
				placeholder: 'user@example.com',
				description: 'Email address of the wallet owner',
				required: true,
			},
			{
				displayName: 'Owner User ID',
				name: 'ownerUserId',
				type: 'string',
				displayOptions: { show: { resource: ['wallet'], operation: ['createWallet'], ownerType: ['userId'] } },
				default: '',
				placeholder: 'user-123',
				description: 'User ID of the wallet owner',
				required: true,
			},
			{
				displayName: 'Owner Phone Number',
				name: 'ownerPhoneNumber',
				type: 'string',
				displayOptions: { show: { resource: ['wallet'], operation: ['createWallet'], ownerType: ['phoneNumber'] } },
				default: '',
				placeholder: '+1234567890',
				description: 'Phone number of the wallet owner (with country code)',
				required: true,
			},
			{
				displayName: 'Owner Twitter Handle',
				name: 'ownerTwitterHandle',
				type: 'string',
				displayOptions: { show: { resource: ['wallet'], operation: ['createWallet'], ownerType: ['twitter'] } },
				default: '',
				placeholder: 'username',
				description: 'Twitter handle of the wallet owner (without @)',
				required: true,
			},
			{
				displayName: 'Owner X Handle',
				name: 'ownerXHandle',
				type: 'string',
				displayOptions: { show: { resource: ['wallet'], operation: ['createWallet'], ownerType: ['x'] } },
				default: '',
				placeholder: 'username',
				description: 'X handle of the wallet owner (without @)',
				required: true,
			},
			{
				displayName: 'Signer Chain Type',
				name: 'signerChainType',
				type: 'options',
				displayOptions: { show: { resource: ['wallet'], operation: ['createWallet'], ownerType: ['externalSigner'] } },
				options: [
					{ name: 'EVM', value: 'evm', description: 'Ethereum Virtual Machine' },
					{ name: 'Solana', value: 'solana', description: 'Solana blockchain' },
				],
				default: 'evm',
				description: 'Blockchain type for the external signer',
				required: true,
			},

			// ---- Get Wallet fields
			{
				displayName: 'Locator Type',
				name: 'getWalletLocatorType',
				type: 'options',
				displayOptions: { show: { resource: ['wallet'], operation: ['getWallet'] } },
				options: [
					{ name: 'Wallet Address', value: 'address', description: 'Use wallet address directly' },
					{ name: 'Email', value: 'email', description: 'Use email address with chain type' },
					{ name: 'User ID', value: 'userId', description: 'Use user ID with chain type' },
					{ name: 'Phone Number', value: 'phoneNumber', description: 'Use phone number with chain type' },
					{ name: 'Twitter Handle', value: 'twitter', description: 'Use Twitter handle with chain type' },
					{ name: 'X Handle', value: 'x', description: 'Use X handle with chain type' },
					{ name: 'Me', value: 'me', description: 'Use "me" with chain type (client API key)' },
				],
				default: 'address',
				description: 'Type of wallet locator to use',
			},
			{
				displayName: 'Wallet Address',
				name: 'getWalletAddress',
				type: 'string',
				displayOptions: { show: { resource: ['wallet'], operation: ['getWallet'], getWalletLocatorType: ['address'] } },
				default: '',
				placeholder: '0x1234567890123456789012345678901234567890',
				required: true,
			},
			{
				displayName: 'Email',
				name: 'getWalletEmail',
				type: 'string',
				displayOptions: { show: { resource: ['wallet'], operation: ['getWallet'], getWalletLocatorType: ['email'] } },
				default: '',
				placeholder: 'user@example.com',
				description: 'Email address of the wallet owner',
				required: true,
			},
			{
				displayName: 'User ID',
				name: 'getWalletUserId',
				type: 'string',
				displayOptions: { show: { resource: ['wallet'], operation: ['getWallet'], getWalletLocatorType: ['userId'] } },
				default: '',
				placeholder: 'user-123',
				description: 'User ID of the wallet owner',
				required: true,
			},
			{
				displayName: 'Phone Number',
				name: 'getWalletPhoneNumber',
				type: 'string',
				displayOptions: { show: { resource: ['wallet'], operation: ['getWallet'], getWalletLocatorType: ['phoneNumber'] } },
				default: '',
				placeholder: '+1234567890',
				description: 'Phone number of the wallet owner (with country code)',
				required: true,
			},
			{
				displayName: 'Twitter Handle',
				name: 'getWalletTwitterHandle',
				type: 'string',
				displayOptions: { show: { resource: ['wallet'], operation: ['getWallet'], getWalletLocatorType: ['twitter'] } },
				default: '',
				placeholder: 'username',
				description: 'Twitter handle of the wallet owner (without @)',
				required: true,
			},
			{
				displayName: 'X Handle',
				name: 'getWalletXHandle',
				type: 'string',
				displayOptions: { show: { resource: ['wallet'], operation: ['getWallet'], getWalletLocatorType: ['x'] } },
				default: '',
				placeholder: 'username',
				description: 'X handle of the wallet owner (without @)',
				required: true,
			},
			{
				displayName: 'Chain Type',
				name: 'getWalletChainType',
				type: 'options',
				displayOptions: { show: { resource: ['wallet'], operation: ['getWallet'], getWalletLocatorType: ['email', 'userId', 'phoneNumber', 'twitter', 'x', 'me'] } },
				options: [
					{ name: 'EVM', value: 'evm', description: 'Ethereum Virtual Machine' },
					{ name: 'Solana', value: 'solana', description: 'Solana blockchain' },
				],
				default: 'evm',
				description: 'Blockchain type for the wallet locator',
				required: true,
			},

			// ---- Transfer Token fields
			{
				displayName: 'Origin Locator Type',
				name: 'originLocatorType',
				type: 'options',
				displayOptions: { show: { resource: ['wallet'], operation: ['transferToken'] } },
				options: [
					{ name: 'Wallet Address', value: 'address', description: 'Use wallet address directly' },
					{ name: 'Email', value: 'email', description: 'Use email address with chain type' },
					{ name: 'User ID', value: 'userId', description: 'Use user ID with chain type' },
					{ name: 'Phone Number', value: 'phoneNumber', description: 'Use phone number with chain type' },
					{ name: 'Twitter Handle', value: 'twitter', description: 'Use Twitter handle with chain type' },
					{ name: 'X Handle', value: 'x', description: 'Use X handle with chain type' },
					{ name: 'Me', value: 'me', description: 'Use "me" with chain type (client API key)' },
				],
				default: 'address',
				description: 'Type of origin wallet locator to use',
			},
			{
				displayName: 'Origin Wallet Address',
				name: 'originWalletAddress',
				type: 'string',
				displayOptions: { show: { resource: ['wallet'], operation: ['transferToken'], originLocatorType: ['address'] } },
				default: '',
				placeholder: '0x1234567890123456789012345678901234567890',
				required: true,
			},
			{
				displayName: 'Origin Email',
				name: 'originWalletEmail',
				type: 'string',
				displayOptions: { show: { resource: ['wallet'], operation: ['transferToken'], originLocatorType: ['email'] } },
				default: '',
				placeholder: 'user@example.com',
				description: 'Email address of the origin wallet owner',
				required: true,
			},
			{
				displayName: 'Origin User ID',
				name: 'originWalletUserId',
				type: 'string',
				displayOptions: { show: { resource: ['wallet'], operation: ['transferToken'], originLocatorType: ['userId'] } },
				default: '',
				placeholder: 'user-123',
				description: 'User ID of the origin wallet owner',
				required: true,
			},
			{
				displayName: 'Origin Phone Number',
				name: 'originWalletPhoneNumber',
				type: 'string',
				displayOptions: { show: { resource: ['wallet'], operation: ['transferToken'], originLocatorType: ['phoneNumber'] } },
				default: '',
				placeholder: '+1234567890',
				description: 'Phone number of the origin wallet owner (with country code)',
				required: true,
			},
			{
				displayName: 'Origin Twitter Handle',
				name: 'originWalletTwitterHandle',
				type: 'string',
				displayOptions: { show: { resource: ['wallet'], operation: ['transferToken'], originLocatorType: ['twitter'] } },
				default: '',
				placeholder: 'username',
				description: 'Twitter handle of the origin wallet owner (without @)',
				required: true,
			},
			{
				displayName: 'Origin X Handle',
				name: 'originWalletXHandle',
				type: 'string',
				displayOptions: { show: { resource: ['wallet'], operation: ['transferToken'], originLocatorType: ['x'] } },
				default: '',
				placeholder: 'username',
				description: 'X handle of the origin wallet owner (without @)',
				required: true,
			},
			{
				displayName: 'Origin Wallet Type',
				name: 'originWalletType',
				type: 'options',
				displayOptions: { show: { resource: ['wallet'], operation: ['transferToken'], originLocatorType: ['email', 'userId', 'phoneNumber', 'twitter', 'x', 'me'] } },
				options: [
					{ name: 'EVM', value: 'evm', description: 'Ethereum Virtual Machine' },
					{ name: 'Solana', value: 'solana', description: 'Solana blockchain' },
				],
				default: 'evm',
				description: 'Blockchain type for the origin wallet',
				required: true,
			},
			{
				displayName: 'Recipient Locator Type',
				name: 'recipientLocatorType',
				type: 'options',
				displayOptions: { show: { resource: ['wallet'], operation: ['transferToken'] } },
				options: [
					{ name: 'Wallet Address', value: 'address', description: 'Use wallet address directly' },
					{ name: 'Email', value: 'email', description: 'Use email address with chain type' },
					{ name: 'User ID', value: 'userId', description: 'Use user ID with chain type' },
					{ name: 'Phone Number', value: 'phoneNumber', description: 'Use phone number with chain type' },
					{ name: 'Twitter Handle', value: 'twitter', description: 'Use Twitter handle with chain type' },
					{ name: 'X Handle', value: 'x', description: 'Use X handle with chain type' },
					{ name: 'Me', value: 'me', description: 'Use "me" with chain type (client API key)' },
				],
				default: 'address',
				description: 'Type of recipient wallet locator to use',
			},
			{
				displayName: 'Recipient Wallet Address',
				name: 'recipientWalletAddress',
				type: 'string',
				displayOptions: { show: { resource: ['wallet'], operation: ['transferToken'], recipientLocatorType: ['address'] } },
				default: '',
				placeholder: '0x1234567890123456789012345678901234567890',
				required: true,
			},
			{
				displayName: 'Recipient Email',
				name: 'recipientWalletEmail',
				type: 'string',
				displayOptions: { show: { resource: ['wallet'], operation: ['transferToken'], recipientLocatorType: ['email'] } },
				default: '',
				placeholder: 'user@example.com',
				description: 'Email address of the recipient wallet owner',
				required: true,
			},
			{
				displayName: 'Recipient User ID',
				name: 'recipientWalletUserId',
				type: 'string',
				displayOptions: { show: { resource: ['wallet'], operation: ['transferToken'], recipientLocatorType: ['userId'] } },
				default: '',
				placeholder: 'user-123',
				description: 'User ID of the recipient wallet owner',
				required: true,
			},
			{
				displayName: 'Recipient Phone Number',
				name: 'recipientWalletPhoneNumber',
				type: 'string',
				displayOptions: { show: { resource: ['wallet'], operation: ['transferToken'], recipientLocatorType: ['phoneNumber'] } },
				default: '',
				placeholder: '+1234567890',
				description: 'Phone number of the recipient wallet owner (with country code)',
				required: true,
			},
			{
				displayName: 'Recipient Twitter Handle',
				name: 'recipientWalletTwitterHandle',
				type: 'string',
				displayOptions: { show: { resource: ['wallet'], operation: ['transferToken'], recipientLocatorType: ['twitter'] } },
				default: '',
				placeholder: 'username',
				description: 'Twitter handle of the recipient wallet owner (without @)',
				required: true,
			},
			{
				displayName: 'Recipient X Handle',
				name: 'recipientWalletXHandle',
				type: 'string',
				displayOptions: { show: { resource: ['wallet'], operation: ['transferToken'], recipientLocatorType: ['x'] } },
				default: '',
				placeholder: 'username',
				description: 'X handle of the recipient wallet owner (without @)',
				required: true,
			},
			{
				displayName: 'Recipient Chain',
				name: 'recipientWalletChainType',
				type: 'string',
				displayOptions: { show: { resource: ['wallet'], operation: ['transferToken'], recipientLocatorType: ['email', 'userId', 'phoneNumber', 'twitter', 'x', 'me'] } },
				default: 'ethereum',
				placeholder: 'ethereum, polygon, base, solana, etc.',
				description: 'Specific blockchain for the recipient wallet (e.g., ethereum, polygon, base, solana, ethereum-sepolia)',
				required: true,
			},
			{
				displayName: 'Token Chain',
				name: 'tokenChain',
				type: 'string',
				displayOptions: { show: { resource: ['wallet'], operation: ['transferToken'] } },
				default: '',
				placeholder: 'ethereum-sepolia',
				description: 'Blockchain network for the token',
				required: true,
			},
			{
				displayName: 'Token Name',
				name: 'tokenName',
				type: 'string',
				displayOptions: { show: { resource: ['wallet'], operation: ['transferToken'] } },
				default: '',
				placeholder: 'usdc',
				description: 'Token symbol or name',
				required: true,
			},
			{
				displayName: 'Amount',
				name: 'amount',
				type: 'string',
				displayOptions: { show: { resource: ['wallet'], operation: ['transferToken'] } },
				default: '',
				placeholder: '10.50',
				description: 'Amount of tokens to send (decimal format)',
				required: true,
			},

			// ---- Get balance fields
			{
				displayName: 'Locator Type',
				name: 'balanceLocatorType',
				type: 'options',
				displayOptions: { show: { resource: ['wallet'], operation: ['getBalance'] } },
				options: [
					{ name: 'Wallet Address', value: 'address', description: 'Use wallet address directly' },
					{ name: 'Email', value: 'email', description: 'Use email address with chain type' },
					{ name: 'User ID', value: 'userId', description: 'Use user ID with chain type' },
					{ name: 'Phone Number', value: 'phoneNumber', description: 'Use phone number with chain type' },
					{ name: 'Twitter Handle', value: 'twitter', description: 'Use Twitter handle with chain type' },
					{ name: 'X Handle', value: 'x', description: 'Use X handle with chain type' },
					{ name: 'Me', value: 'me', description: 'Use "me" with chain type (client API key)' },
				],
				default: 'address',
				description: 'Type of wallet locator to use',
			},
			{
				displayName: 'Wallet Address',
				name: 'balanceWalletAddress',
				type: 'string',
				displayOptions: { show: { resource: ['wallet'], operation: ['getBalance'], balanceLocatorType: ['address'] } },
				default: '',
				placeholder: '0x1234567890123456789012345678901234567890',
				required: true,
			},
			{
				displayName: 'Email',
				name: 'balanceWalletEmail',
				type: 'string',
				displayOptions: { show: { resource: ['wallet'], operation: ['getBalance'], balanceLocatorType: ['email'] } },
				default: '',
				placeholder: 'user@example.com',
				description: 'Email address of the wallet owner',
				required: true,
			},
			{
				displayName: 'User ID',
				name: 'balanceWalletUserId',
				type: 'string',
				displayOptions: { show: { resource: ['wallet'], operation: ['getBalance'], balanceLocatorType: ['userId'] } },
				default: '',
				placeholder: 'user-123',
				description: 'User ID of the wallet owner',
				required: true,
			},
			{
				displayName: 'Phone Number',
				name: 'balanceWalletPhoneNumber',
				type: 'string',
				displayOptions: { show: { resource: ['wallet'], operation: ['getBalance'], balanceLocatorType: ['phoneNumber'] } },
				default: '',
				placeholder: '+1234567890',
				description: 'Phone number of the wallet owner (with country code)',
				required: true,
			},
			{
				displayName: 'Twitter Handle',
				name: 'balanceWalletTwitterHandle',
				type: 'string',
				displayOptions: { show: { resource: ['wallet'], operation: ['getBalance'], balanceLocatorType: ['twitter'] } },
				default: '',
				placeholder: 'username',
				description: 'Twitter handle of the wallet owner (without @)',
				required: true,
			},
			{
				displayName: 'X Handle',
				name: 'balanceWalletXHandle',
				type: 'string',
				displayOptions: { show: { resource: ['wallet'], operation: ['getBalance'], balanceLocatorType: ['x'] } },
				default: '',
				placeholder: 'username',
				description: 'X handle of the wallet owner (without @)',
				required: true,
			},
			{
				displayName: 'Chain Type',
				name: 'balanceWalletChainType',
				type: 'options',
				displayOptions: { show: { resource: ['wallet'], operation: ['getBalance'], balanceLocatorType: ['email', 'userId', 'phoneNumber', 'twitter', 'x', 'me'] } },
				options: [
					{ name: 'EVM', value: 'evm', description: 'Ethereum Virtual Machine' },
					{ name: 'Solana', value: 'solana', description: 'Solana blockchain' },
				],
				default: 'evm',
				description: 'Blockchain type for the wallet locator',
				required: true,
			},
			{
				displayName: 'Chains',
				name: 'chains',
				type: 'string',
				displayOptions: { show: { resource: ['wallet'], operation: ['getBalance'] } },
				default: 'ethereum',
				placeholder: 'ethereum,polygon or ethereum-sepolia',
				description: 'Comma-separated list of blockchain chains to query',
				required: true,
			},
			{
				displayName: 'Tokens',
				name: 'tokens',
				type: 'string',
				typeOptions: { password: false },
				displayOptions: { show: { resource: ['wallet'], operation: ['getBalance'] } },
				default: 'eth,usdc',
				placeholder: 'eth,usdc,usdt',
				description: 'Comma-separated list of tokens to query',
				required: true,
			},

			{
				displayName: 'Chain Type',
				name: 'signerChainType',
				type: 'options',
				displayOptions: { show: { resource: ['wallet'], operation: ['createWalletWithSigner'] } },
				options: [
					{ name: 'EVM', value: 'evm', description: 'Ethereum Virtual Machine' },
					{ name: 'Solana', value: 'solana', description: 'Solana blockchain' },
				],
				default: 'evm',
				description: 'Blockchain type for the wallet',
			},

			{
				displayName: 'Transaction Data',
				name: 'transactionData',
				type: 'json',
				displayOptions: { show: { resource: ['wallet'], operation: ['signTransaction'] } },
				default: '{}',
				description: 'Transaction data to sign (JSON format)',
				required: true,
			},
			{
				displayName: 'Chain ID',
				name: 'chainId',
				type: 'number',
				displayOptions: { show: { resource: ['wallet'], operation: ['signTransaction'] } },
				default: 1,
				description: 'Chain ID for EVM transactions (1 for Ethereum mainnet)',
			},

			// =========================
			// CHECKOUT ACTIONS
			// =========================
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['checkout'] } },
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
					{ name: 'Arbitrum Sepolia', value: 'arbitrum-sepolia', description: 'Arbitrum testnet' },
					{ name: 'Base Sepolia', value: 'base-sepolia', description: 'Base testnet' },
					{ name: 'Ethereum Sepolia', value: 'ethereum-sepolia', description: 'Ethereum testnet' },
					{ name: 'Optimism Sepolia', value: 'optimism-sepolia', description: 'Optimism testnet' },
					{ name: 'Polygon Amoy', value: 'polygon-amoy', description: 'Polygon testnet' },
					{ name: 'World Chain Sepolia', value: 'world-chain-sepolia', description: 'World Chain testnet' },
					{ name: 'Arbitrum', value: 'arbitrum', description: 'Arbitrum network' },
					{ name: 'Base', value: 'base', description: 'Base network' },
					{ name: 'Ethereum', value: 'ethereum', description: 'Ethereum mainnet' },
					{ name: 'Optimism', value: 'optimism', description: 'Optimism network' },
					{ name: 'Polygon', value: 'polygon', description: 'Polygon network' },
				],
				default: 'arbitrum-sepolia',
				description: 'Payment method for completing the transaction',
				required: true,
			},
			{
				displayName: 'Payer Wallet Address',
				name: 'payerAddress',
				type: 'string',
				displayOptions: { show: { resource: ['checkout'], operation: ['purchaseProduct'] } },
				default: '',
				placeholder: '0x1234567890123456789012345678901234567890',
				description: 'Agent wallet address for crypto payments - must be a Crossmint managed wallet with USDC funds',
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
					{ name: 'Arbitrum Sepolia', value: 'arbitrum-sepolia', description: 'Arbitrum testnet' },
					{ name: 'Base Sepolia', value: 'base-sepolia', description: 'Base testnet' },
					{ name: 'Ethereum Sepolia', value: 'ethereum-sepolia', description: 'Ethereum testnet' },
					{ name: 'Optimism Sepolia', value: 'optimism-sepolia', description: 'Optimism testnet' },
					{ name: 'Polygon Amoy', value: 'polygon-amoy', description: 'Polygon testnet' },
					{ name: 'World Chain Sepolia', value: 'world-chain-sepolia', description: 'World Chain testnet' },
				],
				default: 'arbitrum-sepolia',
				description: 'Payment method for the purchase (Staging/Testnet)',
				required: true,
			},
			{
				displayName: 'Payment Chain',
				name: 'paymentMethod',
				type: 'options',
				displayOptions: { show: { resource: ['checkout'], operation: ['findProduct'], environment: ['production'] } },
				options: [
					{ name: 'Arbitrum', value: 'arbitrum', description: 'Arbitrum network' },
					{ name: 'Base', value: 'base', description: 'Base network' },
					{ name: 'Ethereum', value: 'ethereum', description: 'Ethereum mainnet' },
					{ name: 'Optimism', value: 'optimism', description: 'Optimism network' },
					{ name: 'Polygon', value: 'polygon', description: 'Polygon network' },
				],
				default: 'ethereum',
				description: 'Payment method for the purchase (Production/Mainnet)',
				required: true,
			},
			{
				displayName: 'Payment Currency',
				name: 'paymentCurrency',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['checkout'],
						operation: ['findProduct'],
						paymentMethod: ['ethereum-sepolia', 'polygon-amoy', 'base-sepolia', 'arbitrum-sepolia', 'optimism-sepolia', 'world-chain-sepolia', 'ethereum', 'polygon', 'base', 'arbitrum', 'optimism'],
					},
				},
				options: [
					{ name: 'USDC', value: 'usdc', description: 'USD Coin (Only supported currency)' },
				],
				default: 'usdc',
				description: 'Cryptocurrency to pay with (USDC only)',
				required: true,
			},
			{
				displayName: 'Payer Wallet Address',
				name: 'payerAddress',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['checkout'],
						operation: ['findProduct'],
						paymentMethod: ['ethereum-sepolia', 'polygon-amoy', 'base-sepolia', 'arbitrum-sepolia', 'optimism-sepolia', 'world-chain-sepolia', 'ethereum', 'polygon', 'base', 'arbitrum', 'optimism'],
					},
				},
				default: '',
				placeholder: '0x1234567890123456789012345678901234567890',
				description: 'Agent wallet address for crypto payments - must be a Crossmint managed wallet with USDC funds',
				required: true,
			},
		],
	};


	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const operation = this.getNodeParameter('operation', i) as string;
				let credentials: any;
				let responseData: any;

				if (operation === 'signTransaction') {
					credentials = await this.getCredentials('crossmintApi', i);
					const privateKeyCredentials = await this.getCredentials('crossmintPrivateKeyApi', i);

					responseData = await CrossmintNode.signTransactionMethod(this, privateKeyCredentials, i);
				} else {
					credentials = await this.getCredentials('crossmintApi', i);
					
					const environment = credentials.environment as string;
					const baseUrl =
						environment === 'Production'
							? 'https://www.crossmint.com/api'
							: 'https://staging.crossmint.com/api';

					switch (operation) {
						case 'createWallet':
							responseData = await CrossmintNode.createWalletMethod(this, baseUrl, credentials, i);
							break;
						case 'getWallet':
							responseData = await CrossmintNode.getWalletMethod(this, baseUrl, credentials, i);
							break;
						case 'transferToken':
							responseData = await CrossmintNode.transferToken(this, baseUrl, credentials, i);
							break;
						case 'getBalance':
							responseData = await CrossmintNode.getBalanceMethod(this, baseUrl, credentials, i);
							break;
						case 'findProduct':
							responseData = await CrossmintNode.findProductMethod(this, baseUrl, credentials, i);
							break;
						case 'purchaseProduct':
							responseData = await CrossmintNode.purchaseProductMethod(this, baseUrl, credentials, i);
							break;
						default:
							throw new NodeOperationError(this.getNode(), `Unsupported operation: ${operation}`);
					}
				}

				const executionData = this.helpers.constructExecutionMetaData(
					[{ json: responseData }],
					{ itemData: { item: i } },
				);

				returnData.push(...executionData);
			} catch (error: any) {
				// Handle errors according to n8n best practices
				if (this.continueOnFail()) {
					const executionErrorData = this.helpers.constructExecutionMetaData(
						[
							{
								json: {
									error: error.message,
								},
								pairedItem: { item: i },
							},
						],
						{ itemData: { item: i } },
					);
					returnData.push(...executionErrorData);
					continue;
				}

				// Re-throw the error with proper context for the specific item
				if (error instanceof NodeApiError || error instanceof NodeOperationError) {
					throw error;
				} else {
					throw new NodeOperationError(this.getNode(), error as Error, {
						description: error.description || 'An unexpected error occurred',
						itemIndex: i,
					});
				}
			}
		}

		return [returnData];
	}

	// ===== PRIVATE METHODS =====

	private static async createWalletMethod(
		context: IExecuteFunctions,
		baseUrl: string,
		credentials: any,
		itemIndex: number,
	): Promise<any> {
		const chainType = context.getNodeParameter('chainType', itemIndex) as string;
		const ownerType = context.getNodeParameter('ownerType', itemIndex) as string;
		
		// Handle external signer case
		if (ownerType === 'externalSigner') {
			const privateKeyCredentials = await context.getCredentials('crossmintPrivateKeyApi', itemIndex);
			const signerChainType = context.getNodeParameter('signerChainType', itemIndex) as string;
			return await CrossmintNode.createWalletWithSignerLogic(context, baseUrl, credentials, privateKeyCredentials, signerChainType, itemIndex);
		}
		
		// Build owner string based on type
		let owner: string | undefined;
		if (ownerType !== 'none') {
			switch (ownerType) {
				case 'email': {
					const ownerEmail = context.getNodeParameter('ownerEmail', itemIndex) as string;
					owner = `email:${ownerEmail}`;
					break;
				}
				case 'userId': {
					const ownerUserId = context.getNodeParameter('ownerUserId', itemIndex) as string;
					owner = `userId:${ownerUserId}`;
					break;
				}
				case 'phoneNumber': {
					const ownerPhoneNumber = context.getNodeParameter('ownerPhoneNumber', itemIndex) as string;
					owner = `phoneNumber:${ownerPhoneNumber}`;
					break;
				}
				case 'twitter': {
					const ownerTwitterHandle = context.getNodeParameter('ownerTwitterHandle', itemIndex) as string;
					owner = `twitter:${ownerTwitterHandle}`;
					break;
				}
				case 'x': {
					const ownerXHandle = context.getNodeParameter('ownerXHandle', itemIndex) as string;
					owner = `x:${ownerXHandle}`;
					break;
				}
			}
		}

		// Always use API key for admin signer
		const adminSigner = {
			type: 'api-key',
		};

		// Build request body according to API specification
		const requestBody: any = {
			type: 'smart',
			chainType: chainType,
			config: {
				adminSigner: adminSigner,
			},
		};

		// Add owner if provided
		if (owner) {
			requestBody.owner = owner;
		}

		// Build headers
		const headers: any = {
			'X-API-KEY': credentials.apiKey,
			'Content-Type': 'application/json',
		};

		const requestOptions: IHttpRequestOptions = {
			method: 'POST',
			url: `${baseUrl}/2025-06-09/wallets`,
			headers: headers,
			body: requestBody,
			json: true,
		};

		try {
			return await context.helpers.httpRequest(requestOptions);
		} catch (error: any) {
			// Pass through the original Crossmint API error exactly as received
			throw new NodeApiError(context.getNode(), error);
		}
	}

	private static async getWalletMethod(
		context: IExecuteFunctions,
		baseUrl: string,
		credentials: any,
		itemIndex: number,
	): Promise<any> {
		const locatorType = context.getNodeParameter('getWalletLocatorType', itemIndex) as string;
		
		// Build wallet locator based on type
		let walletLocator: string;
		
		switch (locatorType) {
			case 'address': {
				const address = context.getNodeParameter('getWalletAddress', itemIndex) as string;
				if (!address || address.trim() === '') {
					throw new NodeOperationError(context.getNode(), 'Wallet address is required', {
						description: 'Please specify the wallet address',
						itemIndex,
					});
				}
				walletLocator = address;
				break;
			}
			case 'email': {
				const email = context.getNodeParameter('getWalletEmail', itemIndex) as string;
				const chainType = context.getNodeParameter('getWalletChainType', itemIndex) as string;
				
				if (!email || email.trim() === '') {
					throw new NodeOperationError(context.getNode(), 'Email is required', {
						description: 'Please specify the email address',
						itemIndex,
					});
				}
				
				walletLocator = `email:${email}:${chainType}:smart`;
				break;
			}
			case 'userId': {
				const userId = context.getNodeParameter('getWalletUserId', itemIndex) as string;
				const chainType = context.getNodeParameter('getWalletChainType', itemIndex) as string;
				
				if (!userId || userId.trim() === '') {
					throw new NodeOperationError(context.getNode(), 'User ID is required', {
						description: 'Please specify the user ID',
						itemIndex,
					});
				}
				
				walletLocator = `userId:${userId}:${chainType}:smart`;
				break;
			}
			case 'phoneNumber': {
				const phoneNumber = context.getNodeParameter('getWalletPhoneNumber', itemIndex) as string;
				const chainType = context.getNodeParameter('getWalletChainType', itemIndex) as string;
				
				if (!phoneNumber || phoneNumber.trim() === '') {
					throw new NodeOperationError(context.getNode(), 'Phone number is required', {
						description: 'Please specify the phone number',
						itemIndex,
					});
				}
				
				walletLocator = `phoneNumber:${phoneNumber}:${chainType}:smart`;
				break;
			}
			case 'twitter': {
				const twitterHandle = context.getNodeParameter('getWalletTwitterHandle', itemIndex) as string;
				const chainType = context.getNodeParameter('getWalletChainType', itemIndex) as string;
				
				if (!twitterHandle || twitterHandle.trim() === '') {
					throw new NodeOperationError(context.getNode(), 'Twitter handle is required', {
						description: 'Please specify the Twitter handle',
						itemIndex,
					});
				}
				
				walletLocator = `twitter:${twitterHandle}:${chainType}:smart`;
				break;
			}
			case 'x': {
				const xHandle = context.getNodeParameter('getWalletXHandle', itemIndex) as string;
				const chainType = context.getNodeParameter('getWalletChainType', itemIndex) as string;
				
				if (!xHandle || xHandle.trim() === '') {
					throw new NodeOperationError(context.getNode(), 'X handle is required', {
						description: 'Please specify the X handle',
						itemIndex,
					});
				}
				
				walletLocator = `x:${xHandle}:${chainType}:smart`;
				break;
			}
			case 'me': {
				const chainType = context.getNodeParameter('getWalletChainType', itemIndex) as string;
				
				walletLocator = `me:${chainType}:smart`;
				break;
			}
			default:
				throw new NodeOperationError(context.getNode(), `Unsupported locator type: ${locatorType}`, {
					itemIndex,
				});
		}

		const requestOptions: IHttpRequestOptions = {
			method: 'GET',
			url: `${baseUrl}/2025-06-09/wallets/${encodeURIComponent(walletLocator)}`,
			headers: {
				'X-API-KEY': credentials.apiKey,
			},
			json: true,
		};

		try {
			return await context.helpers.httpRequest(requestOptions);
		} catch (error: any) {
			throw new NodeApiError(context.getNode(), error);
		}
	}

	
	private static async transferToken(
		context: IExecuteFunctions,
		baseUrl: string,
		credentials: any,
		itemIndex: number,
	): Promise<any> {
		const amount = context.getNodeParameter('amount', itemIndex) as string;
		const tokenChain = context.getNodeParameter('tokenChain', itemIndex) as string;
		const tokenName = context.getNodeParameter('tokenName', itemIndex) as string;

		// Input validation
		if (!amount || amount.trim() === '') {
			throw new NodeOperationError(context.getNode(), 'Amount is required', {
				description: 'Please specify the amount of tokens to transfer',
				itemIndex,
			});
		}

		if (!tokenChain || tokenChain.trim() === '') {
			throw new NodeOperationError(context.getNode(), 'Token chain is required', {
				description: 'Please specify the token chain (e.g., ethereum-sepolia)',
				itemIndex,
			});
		}

		if (!tokenName || tokenName.trim() === '') {
			throw new NodeOperationError(context.getNode(), 'Token name is required', {
				description: 'Please specify the token name (e.g., usdc)',
				itemIndex,
			});
		}

		// Build token locator from chain and name
		const tokenLocator = `${tokenChain}:${tokenName}`;

		// Validate amount is a valid number
		const numericAmount = parseFloat(amount);
		if (isNaN(numericAmount) || numericAmount <= 0) {
			throw new NodeOperationError(context.getNode(), 'Invalid amount', {
				description: `The amount '${amount}' is not a valid positive number`,
				itemIndex,
			});
		}

		// Build origin wallet locator
		const originLocatorType = context.getNodeParameter('originLocatorType', itemIndex) as string;
		let fromWalletLocator: string;
		
		switch (originLocatorType) {
			case 'address': {
				const address = context.getNodeParameter('originWalletAddress', itemIndex) as string;
				if (!address || address.trim() === '') {
					throw new NodeOperationError(context.getNode(), 'Origin wallet address is required', {
						description: 'Please specify the origin wallet address',
						itemIndex,
					});
				}
				fromWalletLocator = address;
				break;
			}
			case 'email': {
				const email = context.getNodeParameter('originWalletEmail', itemIndex) as string;
				const chainType = context.getNodeParameter('originWalletType', itemIndex) as string;
				
				if (!email || email.trim() === '') {
					throw new NodeOperationError(context.getNode(), 'Origin email is required', {
						description: 'Please specify the origin email address',
						itemIndex,
					});
				}
				
				fromWalletLocator = `email:${email}:${chainType}:smart`;
				break;
			}
			case 'userId': {
				const userId = context.getNodeParameter('originWalletUserId', itemIndex) as string;
				const chainType = context.getNodeParameter('originWalletType', itemIndex) as string;
				
				if (!userId || userId.trim() === '') {
					throw new NodeOperationError(context.getNode(), 'Origin user ID is required', {
						description: 'Please specify the origin user ID',
						itemIndex,
					});
				}
				
				fromWalletLocator = `userId:${userId}:${chainType}:smart`;
				break;
			}
			case 'phoneNumber': {
				const phoneNumber = context.getNodeParameter('originWalletPhoneNumber', itemIndex) as string;
				const chainType = context.getNodeParameter('originWalletType', itemIndex) as string;
				
				if (!phoneNumber || phoneNumber.trim() === '') {
					throw new NodeOperationError(context.getNode(), 'Origin phone number is required', {
						description: 'Please specify the origin phone number',
						itemIndex,
					});
				}
				
				fromWalletLocator = `phoneNumber:${phoneNumber}:${chainType}:smart`;
				break;
			}
			case 'twitter': {
				const twitterHandle = context.getNodeParameter('originWalletTwitterHandle', itemIndex) as string;
				const chainType = context.getNodeParameter('originWalletType', itemIndex) as string;
				
				if (!twitterHandle || twitterHandle.trim() === '') {
					throw new NodeOperationError(context.getNode(), 'Origin Twitter handle is required', {
						description: 'Please specify the origin Twitter handle',
						itemIndex,
					});
				}
				
				fromWalletLocator = `twitter:${twitterHandle}:${chainType}:smart`;
				break;
			}
			case 'x': {
				const xHandle = context.getNodeParameter('originWalletXHandle', itemIndex) as string;
				const chainType = context.getNodeParameter('originWalletType', itemIndex) as string;
				
				if (!xHandle || xHandle.trim() === '') {
					throw new NodeOperationError(context.getNode(), 'Origin X handle is required', {
						description: 'Please specify the origin X handle',
						itemIndex,
					});
					
				}
				
				fromWalletLocator = `x:${xHandle}:${chainType}:smart`;
				break;
			}
			case 'me': {
				const chainType = context.getNodeParameter('originWalletType', itemIndex) as string;
				
				fromWalletLocator = `me:${chainType}:smart`;
				break;
			}
			default:
				throw new NodeOperationError(context.getNode(), `Unsupported origin locator type: ${originLocatorType}`, {
					itemIndex,
				});
		}

		// Build recipient wallet locator
		const recipientLocatorType = context.getNodeParameter('recipientLocatorType', itemIndex) as string;
		let recipient: string;
		
		switch (recipientLocatorType) {
			case 'address': {
				const address = context.getNodeParameter('recipientWalletAddress', itemIndex) as string;
				if (!address || address.trim() === '') {
					throw new NodeOperationError(context.getNode(), 'Recipient wallet address is required', {
						description: 'Please specify the recipient wallet address',
						itemIndex,
					});
				}
				recipient = address;
				break;
			}
			case 'email': {
				const email = context.getNodeParameter('recipientWalletEmail', itemIndex) as string;
				const chainType = context.getNodeParameter('recipientWalletChainType', itemIndex) as string;
				
				if (!email || email.trim() === '') {
					throw new NodeOperationError(context.getNode(), 'Recipient email is required', {
						description: 'Please specify the recipient email address',
						itemIndex,
					});
				}
				
				recipient = `email:${email}:${chainType}`;
				break;
			}
			case 'userId': {
				const userId = context.getNodeParameter('recipientWalletUserId', itemIndex) as string;
				const chainType = context.getNodeParameter('recipientWalletChainType', itemIndex) as string;
				
				if (!userId || userId.trim() === '') {
					throw new NodeOperationError(context.getNode(), 'Recipient user ID is required', {
						description: 'Please specify the recipient user ID',
						itemIndex,
					});
				}
				
				recipient = `userId:${userId}:${chainType}`;
				break;
			}
			case 'phoneNumber': {
				const phoneNumber = context.getNodeParameter('recipientWalletPhoneNumber', itemIndex) as string;
				const chainType = context.getNodeParameter('recipientWalletChainType', itemIndex) as string;
				
				if (!phoneNumber || phoneNumber.trim() === '') {
					throw new NodeOperationError(context.getNode(), 'Recipient phone number is required', {
						description: 'Please specify the recipient phone number',
						itemIndex,
					});
				}
				
				recipient = `phoneNumber:${phoneNumber}:${chainType}`;
				break;
			}
			case 'twitter': {
				const twitterHandle = context.getNodeParameter('recipientWalletTwitterHandle', itemIndex) as string;
				const chainType = context.getNodeParameter('recipientWalletChainType', itemIndex) as string;
				
				if (!twitterHandle || twitterHandle.trim() === '') {
					throw new NodeOperationError(context.getNode(), 'Recipient Twitter handle is required', {
						description: 'Please specify the recipient Twitter handle',
						itemIndex,
					});
				}
				
				recipient = `twitter:${twitterHandle}:${chainType}`;
				break;
			}
			case 'x': {
				const xHandle = context.getNodeParameter('recipientWalletXHandle', itemIndex) as string;
				const chainType = context.getNodeParameter('recipientWalletChainType', itemIndex) as string;
				
				if (!xHandle || xHandle.trim() === '') {
					throw new NodeOperationError(context.getNode(), 'Recipient X handle is required', {
						description: 'Please specify the recipient X handle',
						itemIndex,
					});
				}
				
				recipient = `x:${xHandle}:${chainType}`;
				break;
			}
			case 'me': {
				const chainType = context.getNodeParameter('recipientWalletChainType', itemIndex) as string;
				
				recipient = `me:${chainType}`;
				break;
			}
			default:
				throw new NodeOperationError(context.getNode(), `Unsupported recipient locator type: ${recipientLocatorType}`, {
					itemIndex,
				});
		}

		// Use the new transfer API format
		const requestOptions: IHttpRequestOptions = {
			method: 'POST',
			url: `${baseUrl}/2025-06-09/wallets/${encodeURIComponent(fromWalletLocator)}/tokens/${encodeURIComponent(tokenLocator)}/transfers`,
			headers: {
				'X-API-KEY': credentials.apiKey,
				'Content-Type': 'application/json',
			},
			body: {
				recipient: recipient,
				amount: amount,
			},
			json: true,
		};

		try {
			return await context.helpers.httpRequest(requestOptions);
		} catch (error: any) {
			// Pass through the original Crossmint API error exactly as received
			throw new NodeApiError(context.getNode(), error);
		}
	}


	private static async getBalanceMethod(
		context: IExecuteFunctions,
		baseUrl: string,
		credentials: any,
		itemIndex: number,
	): Promise<any> {
		const locatorType = context.getNodeParameter('balanceLocatorType', itemIndex) as string;
		const chains = context.getNodeParameter('chains', itemIndex) as string;
		const tokens = context.getNodeParameter('tokens', itemIndex) as string;
		
		// Build wallet locator based on type
		let walletLocator: string;
		
		switch (locatorType) {
			case 'address': {
				const address = context.getNodeParameter('balanceWalletAddress', itemIndex) as string;
				if (!address || address.trim() === '') {
					throw new NodeOperationError(context.getNode(), 'Wallet address is required', {
						description: 'Please specify the wallet address',
						itemIndex,
					});
				}
				walletLocator = address;
				break;
			}
			case 'email': {
				const email = context.getNodeParameter('balanceWalletEmail', itemIndex) as string;
				const chainType = context.getNodeParameter('balanceWalletChainType', itemIndex) as string;
				
				if (!email || email.trim() === '') {
					throw new NodeOperationError(context.getNode(), 'Email is required', {
						description: 'Please specify the email address',
						itemIndex,
					});
				}
				
				walletLocator = `email:${email}:${chainType}:smart`;
				break;
			}
			case 'userId': {
				const userId = context.getNodeParameter('balanceWalletUserId', itemIndex) as string;
				const chainType = context.getNodeParameter('balanceWalletChainType', itemIndex) as string;
				
				if (!userId || userId.trim() === '') {
					throw new NodeOperationError(context.getNode(), 'User ID is required', {
						description: 'Please specify the user ID',
						itemIndex,
					});
				}
				
				walletLocator = `userId:${userId}:${chainType}:smart`;
				break;
			}
			case 'phoneNumber': {
				const phoneNumber = context.getNodeParameter('balanceWalletPhoneNumber', itemIndex) as string;
				const chainType = context.getNodeParameter('balanceWalletChainType', itemIndex) as string;
				
				if (!phoneNumber || phoneNumber.trim() === '') {
					throw new NodeOperationError(context.getNode(), 'Phone number is required', {
						description: 'Please specify the phone number',
						itemIndex,
					});
				}
				
				walletLocator = `phoneNumber:${phoneNumber}:${chainType}:smart`;
				break;
			}
			case 'twitter': {
				const twitterHandle = context.getNodeParameter('balanceWalletTwitterHandle', itemIndex) as string;
				const chainType = context.getNodeParameter('balanceWalletChainType', itemIndex) as string;
				
				if (!twitterHandle || twitterHandle.trim() === '') {
					throw new NodeOperationError(context.getNode(), 'Twitter handle is required', {
						description: 'Please specify the Twitter handle',
						itemIndex,
					});
				}
				
				walletLocator = `twitter:${twitterHandle}:${chainType}:smart`;
				break;
			}
			case 'x': {
				const xHandle = context.getNodeParameter('balanceWalletXHandle', itemIndex) as string;
				const chainType = context.getNodeParameter('balanceWalletChainType', itemIndex) as string;
				
				if (!xHandle || xHandle.trim() === '') {
					throw new NodeOperationError(context.getNode(), 'X handle is required', {
						description: 'Please specify the X handle',
						itemIndex,
					});
				}
				
				walletLocator = `x:${xHandle}:${chainType}:smart`;
				break;
			}
			case 'me': {
				const chainType = context.getNodeParameter('balanceWalletChainType', itemIndex) as string;
				
				walletLocator = `me:${chainType}:smart`;
				break;
			}
			default:
				throw new NodeOperationError(context.getNode(), `Unsupported locator type: ${locatorType}`, {
					itemIndex,
				});
		}

		// Build URL with query parameters
		const baseUrlWithParams = `${baseUrl}/2025-06-09/wallets/${encodeURIComponent(
			walletLocator,
		)}/balances?chains=${encodeURIComponent(chains)}&tokens=${encodeURIComponent(tokens)}`;

		const requestOptions: IHttpRequestOptions = {
			method: 'GET',
			url: baseUrlWithParams,
			headers: {
				'X-API-KEY': credentials.apiKey,
			},
			json: true,
		};

		try {
			return await context.helpers.httpRequest(requestOptions);
		} catch (error: any) {
			// Pass through the original Crossmint API error exactly as received
			throw new NodeApiError(context.getNode(), error);
		}
	}


	private static async findProductMethod(
		context: IExecuteFunctions,
		baseUrl: string,
		credentials: any,
		itemIndex: number,
	): Promise<any> {
		// This is Step 1 from the original purchase method: Create the order
		const platform = context.getNodeParameter('platform', itemIndex) as string;
		const productIdentifier = context.getNodeParameter('productIdentifier', itemIndex) as string;
		const recipientEmail = context.getNodeParameter('recipientEmail', itemIndex) as string;

		// Input validation
		if (!productIdentifier || productIdentifier.trim() === '') {
			throw new NodeOperationError(context.getNode(), 'Product identifier is required', {
				description: 'Please specify the product identifier (ASIN for Amazon or product handle for Shopify)',
				itemIndex,
			});
		}

		// Validate email format
		if (recipientEmail.indexOf('@') === -1) {
			throw new NodeOperationError(context.getNode(), 'Invalid email address', {
				description: `The email address '${recipientEmail}' is not valid`,
				itemIndex,
			});
		}
		
		// Build product locator according to API specification
		let productLocator: string;
		if (platform === 'amazon') {
			// Amazon: 'amazon:<url>' or 'amazon:<asin>'
			productLocator = `amazon:${productIdentifier}`;
		} else if (platform === 'shopify') {
			// Shopify: 'shopify:<url>:<variantId>' - for now use default variant
			// If productIdentifier is a full URL, use it; otherwise treat as product handle
			if (productIdentifier.startsWith('http')) {
				productLocator = `shopify:${productIdentifier}:default`;
			} else {
				productLocator = `shopify:${productIdentifier}:default`;
			}
		} else {
			// Fallback to generic URL format
			productLocator = `url:${productIdentifier}`;
		}
		const recipientName = context.getNodeParameter('recipientName', itemIndex) as string;
		const addressLine1 = context.getNodeParameter('addressLine1', itemIndex) as string;
		const addressLine2 = context.getNodeParameter('addressLine2', itemIndex) as string;
		const city = context.getNodeParameter('city', itemIndex) as string;
		const state = context.getNodeParameter('state', itemIndex) as string;
		const postalCode = context.getNodeParameter('postalCode', itemIndex) as string;
		const country = context.getNodeParameter('country', itemIndex) as string;

		// Validate required address fields
		if (!recipientName || recipientName.trim() === '') {
			throw new NodeOperationError(context.getNode(), 'Recipient name is required', {
				description: 'Please provide the full name of the person receiving the product',
				itemIndex,
			});
		}

		if (!addressLine1 || addressLine1.trim() === '') {
			throw new NodeOperationError(context.getNode(), 'Address line 1 is required', {
				description: 'Please provide the street address, P.O. box, or company name',
				itemIndex,
			});
		}

		if (!city || city.trim() === '') {
			throw new NodeOperationError(context.getNode(), 'City is required', {
				description: 'Please provide the city, district, suburb, town, or village',
				itemIndex,
			});
		}

		if (!postalCode || postalCode.trim() === '') {
			throw new NodeOperationError(context.getNode(), 'Postal code is required', {
				description: 'Please provide the ZIP or postal code',
				itemIndex,
			});
		}
		const paymentMethod = context.getNodeParameter('paymentMethod', itemIndex) as string;

		// Build physical address
		const physicalAddress: any = {
			name: recipientName,
			line1: addressLine1,
			city: city,
			postalCode: postalCode,
			country: country,
		};

		// Add optional fields
		if (addressLine2) {
			physicalAddress.line2 = addressLine2;
		}
		if (state) {
			physicalAddress.state = state;
		}

		// Build payment object based on method
		const payment: any = {
			receiptEmail: recipientEmail,
			method: paymentMethod,

		};

		// Add currency and payer address for crypto payment
		const paymentCurrency = context.getNodeParameter('paymentCurrency', itemIndex) as string;
		payment.currency = paymentCurrency;

		const payerAddress = context.getNodeParameter('payerAddress', itemIndex) as string;
		if (payerAddress) {
			payment.payerAddress = payerAddress;
		}

		// Build request body for order creation (matching API format)
		const requestBody: any = {
			recipient: {
				email: recipientEmail,
				physicalAddress: physicalAddress,
			},
			payment: payment,
			lineItems: [{
				productLocator: productLocator,
			}],
		};

		const requestOptions: IHttpRequestOptions = {
			method: 'POST',
			url: `${baseUrl}/2022-06-09/orders`,
			headers: {
				'X-API-KEY': credentials.apiKey,
				'Content-Type': 'application/json',
			},
			body: requestBody,
			json: true,
		};

		try {
			// Step 1: Create the order
			return await context.helpers.httpRequest(requestOptions);
		} catch (error: any) {
			throw new NodeApiError(context.getNode(), error);
		}
	}

	private static async purchaseProductMethod(
		context: IExecuteFunctions,
		baseUrl: string,
		credentials: any,
		itemIndex: number,
	): Promise<any> {
		// Step 2: Submit transaction for crypto payments
		// Get the serialized transaction from Find Product response
		const serializedTransaction = context.getNodeParameter('serializedTransaction', itemIndex) as string;
		const paymentMethod = context.getNodeParameter('paymentMethod', itemIndex) as string;
		const payerAddress = context.getNodeParameter('payerAddress', itemIndex) as string;

		// Validate required fields
		if (!serializedTransaction || serializedTransaction.trim() === '') {
			throw new NodeOperationError(context.getNode(), 'Serialized transaction is required', {
				description: 'Please provide the serialized transaction from Find Product response',
				itemIndex,
			});
		}

		if (!payerAddress || payerAddress.trim() === '') {
			throw new NodeOperationError(context.getNode(), 'Payer address is required', {
				description: 'Please provide the payer wallet address for crypto payments',
				itemIndex,
			});
		}

		// Step 2: Submit transaction for crypto payments
		if (serializedTransaction && payerAddress) {
			const transactionRequestOptions: IHttpRequestOptions = {
				method: 'POST',
				url: `${baseUrl}/2022-06-09/wallets/${encodeURIComponent(payerAddress)}/transactions`,
				headers: {
					'X-API-KEY': credentials.apiKey,
					'Content-Type': 'application/json',
				},
				body: {
					params: {
						calls: [{
							transaction: serializedTransaction
						}],
						chain: paymentMethod
					}
				},
				json: true,
			};

			try {
				const transactionResponse = await context.helpers.httpRequest(transactionRequestOptions);
				
				// Return the final transaction response (the completed purchase)
				return transactionResponse;
			} catch (transactionError: any) {
				// If transaction fails, return error info
				throw new NodeApiError(context.getNode(), transactionError);
			}
		} else {
			// Missing required data
			throw new NodeOperationError(context.getNode(), 'Missing required data for transaction', {
				description: 'Serialized transaction and payer address are required',
				itemIndex,
			});
		}
	}

	private static rlpEncode(input: any): Buffer {
		if (input === null || input === undefined) {
			return Buffer.from([0x80]);
		}
		
		if (typeof input === 'string') {
			if (input.startsWith('0x')) {
				let hex = input.slice(2);
				if (hex.length % 2 !== 0) {
					hex = '0' + hex;
				}
				const buffer = Buffer.from(hex, 'hex');
				return CrossmintNode.encodeLength(buffer.length, 0x80, buffer);
			}
			const buffer = Buffer.from(input, 'utf8');
			return CrossmintNode.encodeLength(buffer.length, 0x80, buffer);
		}
		
		if (typeof input === 'number') {
			if (input === 0) {
				return Buffer.from([0x80]);
			}
			const hex = input.toString(16);
			const buffer = Buffer.from(hex.length % 2 ? '0' + hex : hex, 'hex');
			return CrossmintNode.encodeLength(buffer.length, 0x80, buffer);
		}
		
		if (Buffer.isBuffer(input)) {
			return CrossmintNode.encodeLength(input.length, 0x80, input);
		}
		
		if (Array.isArray(input)) {
			const encodedItems = input.map(item => CrossmintNode.rlpEncode(item));
			const totalLength = encodedItems.reduce((sum, item) => sum + item.length, 0);
			const lengthEncoding = CrossmintNode.encodeLength(totalLength, 0xc0, Buffer.alloc(0));
			return Buffer.concat([lengthEncoding, ...encodedItems]);
		}
		
		throw new ApplicationError('Unsupported input type for RLP encoding');
	}

	private static encodeLength(length: number, offset: number, data: Buffer): Buffer {
		if (length < 56) {
			return Buffer.concat([Buffer.from([offset + length]), data]);
		}
		
		const lengthHex = length.toString(16);
		const lengthBuffer = Buffer.from(lengthHex.length % 2 ? '0' + lengthHex : lengthHex, 'hex');
		return Buffer.concat([Buffer.from([offset + 55 + lengthBuffer.length]), lengthBuffer, data]);
	}

	private static keccak256(data: Buffer): Buffer {
		return createHash('sha3-256').update(data).digest();
	}

	private static base58Decode(str: string): Buffer {
		const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
		let decoded = BigInt(0);
		let multi = BigInt(1);
		
		for (let i = str.length - 1; i >= 0; i--) {
			const char = str[i];
			const index = alphabet.indexOf(char);
			if (index === -1) {
				throw new ApplicationError('Invalid base58 character');
			}
			decoded += BigInt(index) * multi;
			multi *= BigInt(58);
		}
		
		let hex = decoded.toString(16);
		if (hex.length % 2) {
			hex = '0' + hex;
		}
		
		let leadingZeros = 0;
		for (let i = 0; i < str.length && str[i] === '1'; i++) {
			leadingZeros++;
		}
		
		return Buffer.concat([Buffer.alloc(leadingZeros), Buffer.from(hex, 'hex')]);
	}

	private static async createWalletWithSignerLogic(
		context: IExecuteFunctions,
		baseUrl: string,
		credentials: any,
		privateKeyCredentials: any,
		signerChainType: string,
		itemIndex: number,
	): Promise<any> {
		const chainType = signerChainType;
		const privateKeyStr = privateKeyCredentials.privateKey as string;
		
		let publicKey: string;
		let address: string;
		
		try {
			if (chainType === 'evm') {
				let privateKeyBuffer: Buffer;
				if (privateKeyStr.startsWith('0x')) {
					privateKeyBuffer = Buffer.from(privateKeyStr.slice(2), 'hex');
				} else {
					privateKeyBuffer = Buffer.from(privateKeyStr, 'hex');
				}
				
				if (privateKeyBuffer.length !== 32) {
					throw new NodeOperationError(context.getNode(), 'EVM private key must be 32 bytes');
				}
				
				const ecdh = createECDH('secp256k1');
				ecdh.setPrivateKey(privateKeyBuffer);
				const publicKeyBuffer = ecdh.getPublicKey();
				const uncompressedPubKey = publicKeyBuffer.slice(1);
				
				
				const addressHash = CrossmintNode.keccak256(uncompressedPubKey);
				address = '0x' + addressHash.slice(-20).toString('hex');
				publicKey = '0x' + uncompressedPubKey.toString('hex');
				
			} else if (chainType === 'solana') {
				let privateKeyBuffer: Buffer;
				if (privateKeyStr.length === 88) {
					privateKeyBuffer = CrossmintNode.base58Decode(privateKeyStr);
				} else {
					throw new NodeOperationError(context.getNode(), 'Solana private key must be base58 encoded');
				}
				
				if (privateKeyBuffer.length !== 64) {
					throw new NodeOperationError(context.getNode(), 'Solana private key must be 64 bytes when decoded');
				}
				
				const secretKey = privateKeyBuffer.slice(0, 32);
				const keyObject = createPrivateKey({
					key: Buffer.concat([
						Buffer.from('302e020100300506032b657004220420', 'hex'),
						secretKey
					]),
					format: 'der',
					type: 'pkcs8'
				});
				
				const pubKeyObject = createPublicKey(keyObject);
				const pubKeyBuffer = pubKeyObject.export({ format: 'der', type: 'spki' });
				address = pubKeyBuffer.slice(-32).toString('base64');
				publicKey = address;
				
			} else {
				throw new NodeOperationError(context.getNode(), `Unsupported chain type: ${chainType}`);
			}
		} catch (error: any) {
			throw new NodeOperationError(context.getNode(), `Failed to process private key: ${error.message}`, {
				itemIndex,
			});
		}
		
		const requestBody: any = {
			type: chainType === 'evm' ? 'evm-smart-wallet' : 'solana-custodial-wallet',
			config: {
				adminSigner: address,
			},
		};
		
		const requestOptions: IHttpRequestOptions = {
			method: 'POST',
			url: `${baseUrl}/2025-06-09/wallets`,
			headers: {
				'X-API-KEY': credentials.apiKey,
				'Content-Type': 'application/json',
			},
			body: requestBody,
			json: true,
		};
		
		try {
			const response = await context.helpers.httpRequest(requestOptions);
			return {
				...response,
				derivedAddress: address,
				derivedPublicKey: publicKey,
			};
		} catch (error: any) {
			throw new NodeApiError(context.getNode(), error);
		}
	}

	private static async signTransactionMethod(
		context: IExecuteFunctions,
		privateKeyCredentials: any,
		itemIndex: number,
	): Promise<any> {
		const transactionDataStr = context.getNodeParameter('transactionData', itemIndex) as string;
		const chainId = context.getNodeParameter('chainId', itemIndex) as number;
		const chainType = privateKeyCredentials.chainType as string;
		const privateKeyStr = privateKeyCredentials.privateKey as string;
		
		let transactionData: any;
		try {
			transactionData = JSON.parse(transactionDataStr);
		} catch (error) {
			throw new NodeOperationError(context.getNode(), 'Invalid transaction data JSON', {
				itemIndex,
			});
		}
		
		try {
			if (chainType === 'evm') {
				return await CrossmintNode.signEvmTransaction(context, transactionData, chainId, privateKeyStr, itemIndex);
			} else if (chainType === 'solana') {
				return await CrossmintNode.signSolanaTransaction(context, transactionData, privateKeyStr, itemIndex);
			} else {
				throw new NodeOperationError(context.getNode(), `Unsupported chain type: ${chainType}`);
			}
		} catch (error: any) {
			throw new NodeOperationError(context.getNode(), `Transaction signing failed: ${error.message}`, {
				itemIndex,
			});
		}
	}

	private static async signEvmTransaction(
		context: IExecuteFunctions,
		transactionData: any,
		chainId: number,
		privateKeyStr: string,
		itemIndex: number,
	): Promise<any> {
		const {
			nonce = 0,
			gasPrice = '0x0',
			gasLimit = '0x5208',
			to = '0x',
			value = '0x0',
			data = '0x',
		} = transactionData;
		
		let privateKeyBuffer: Buffer;
		if (privateKeyStr.startsWith('0x')) {
			privateKeyBuffer = Buffer.from(privateKeyStr.slice(2), 'hex');
		} else {
			privateKeyBuffer = Buffer.from(privateKeyStr, 'hex');
		}
		
		if (privateKeyBuffer.length !== 32) {
			throw new NodeOperationError(context.getNode(), 'EVM private key must be 32 bytes');
		}
		
		const ecdh = createECDH('secp256k1');
		ecdh.setPrivateKey(privateKeyBuffer);
		
		const txArray = [
			typeof nonce === 'number' ? (nonce === 0 ? '0x00' : '0x' + nonce.toString(16).padStart(2, '0')) : nonce,
			gasPrice,
			gasLimit,
			to,
			value,
			data,
			chainId === 1 ? '0x01' : '0x' + chainId.toString(16).padStart(2, '0'),
			'0x00',
			'0x00'
		];
		
		const rlpEncoded = CrossmintNode.rlpEncode(txArray);
		const txHash = CrossmintNode.keccak256(rlpEncoded);
		
		const signature = sign('sha256', txHash, {
			key: Buffer.concat([
				Buffer.from('302e0201010420', 'hex'),
				privateKeyBuffer,
				Buffer.from('a00706052b8104000a', 'hex')
			]),
			format: 'der',
			type: 'sec1',
			dsaEncoding: 'ieee-p1363'
		});
		
		const r = signature.slice(0, 32);
		const s = signature.slice(32, 64);
		
		let recoveryId = 0;
		const publicKeyBuffer = ecdh.getPublicKey();
		const uncompressedPubKey = publicKeyBuffer.slice(1);
		const expectedAddress = '0x' + CrossmintNode.keccak256(uncompressedPubKey).slice(-20).toString('hex');
		
		recoveryId = 0;
		
		const v = 35 + chainId * 2 + recoveryId;
		
		const signedTxArray = [
			txArray[0], txArray[1], txArray[2], txArray[3], txArray[4], txArray[5],
			'0x' + v.toString(16).padStart(2, '0'),
			'0x' + r.toString('hex'),
			'0x' + s.toString('hex')
		];
		
		const signedRlp = CrossmintNode.rlpEncode(signedTxArray);
		
		return {
			rawTransaction: '0x' + signedRlp.toString('hex'),
			transactionHash: '0x' + CrossmintNode.keccak256(signedRlp).toString('hex'),
			r: '0x' + r.toString('hex'),
			s: '0x' + s.toString('hex'),
			v: '0x' + v.toString(16),
			from: expectedAddress,
		};
	}

	private static async signSolanaTransaction(
		context: IExecuteFunctions,
		transactionData: any,
		privateKeyStr: string,
		itemIndex: number,
	): Promise<any> {
		let privateKeyBuffer: Buffer;
		try {
			privateKeyBuffer = CrossmintNode.base58Decode(privateKeyStr);
		} catch (error) {
			throw new NodeOperationError(context.getNode(), 'Solana private key must be base58 encoded');
		}
		
		if (privateKeyBuffer.length === 37) {
			privateKeyBuffer = privateKeyBuffer.slice(1, 33);
		} else if (privateKeyBuffer.length === 32) {
		} else if (privateKeyBuffer.length === 33) {
			privateKeyBuffer = privateKeyBuffer.slice(0, 32);
		} else {
			throw new NodeOperationError(context.getNode(), `Solana private key must be 32 bytes when decoded, got ${privateKeyBuffer.length} bytes`);
		}
		
		const secretKey = privateKeyBuffer;
		const keyObject = createPrivateKey({
			key: Buffer.concat([
				Buffer.from('302e020100300506032b657004220420', 'hex'),
				secretKey
			]),
			format: 'der',
			type: 'pkcs8'
		});
		
		let messageBuffer: Buffer;
		if (typeof transactionData.message === 'string') {
			if (transactionData.message.startsWith('0x')) {
				messageBuffer = Buffer.from(transactionData.message.slice(2), 'hex');
			} else {
				messageBuffer = Buffer.from(transactionData.message, 'base64');
			}
		} else if (Buffer.isBuffer(transactionData.message)) {
			messageBuffer = transactionData.message;
		} else {
			throw new NodeOperationError(context.getNode(), 'Transaction message must be a hex string, base64 string, or Buffer');
		}
		
		const signature = sign(null, messageBuffer, keyObject);
		
		const pubKeyObject = createPublicKey(keyObject);
		const pubKeyBuffer = pubKeyObject.export({ format: 'der', type: 'spki' });
		const publicKey = pubKeyBuffer.slice(-32);
		
		return {
			signature: signature.toString('base64'),
			publicKey: publicKey.toString('base64'),
			signedMessage: messageBuffer.toString('base64'),
		};
	}
}
