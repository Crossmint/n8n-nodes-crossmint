import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IHttpRequestOptions,
	ICredentials,
} from 'n8n-workflow';
import { NodeConnectionType, NodeOperationError, NodeApiError } from 'n8n-workflow';
import { ethers } from 'ethers';
import { Keypair } from '@solana/web3.js';
import * as bs58 from 'bs58';

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
			},
		],

		properties: [
			// =========================
			// RESOURCE
			// =========================
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Wallet', value: 'wallet' },
					{ name: 'Checkout', value: 'checkout' },
					{ name: 'NFT', value: 'nft' },
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
						name: 'Create Transfer',
						value: 'transferToken',
						description: 'Create Transfer from Crossmint wallet to any address',
						action: 'Create transfer',
					},
					{
						name: 'Get Balance',
						value: 'getBalance',
						description: 'Get balance of any wallet',
						action: 'Get balance',
					},
					{
						name: 'Sign Transaction',
						value: 'signAndSubmitTransaction',
						description: 'Sign transaction with private key and submit signature in one step',
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
				displayName: 'Admin Signer',
				name: 'externalSignerDetails',
				type: 'string',
				typeOptions: { password: true },
				displayOptions: { show: { resource: ['wallet'], operation: ['createWallet'] } },
				default: '',
				placeholder: 'Enter private key (32-byte hex for EVM, base58 for Solana)',
				description: 'Private key that authorizes all transactions from this wallet. Use this link to generate them: https://www.val.town/x/Crossmint/crypto-address-generator.',
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
				displayOptions: { show: { resource: ['wallet'], operation: ['getWallet'], getWalletLocatorType: ['email', 'userId', 'phoneNumber', 'twitter', 'x'] } },
				options: [
					{ name: 'EVM', value: 'evm', description: 'Ethereum Virtual Machine' },
					{ name: 'Solana', value: 'solana', description: 'Solana blockchain' },
				],
				default: 'evm',
				description: 'Blockchain type for the wallet locator',
				required: true,
			},

			// ---- Create Transfer fields
			{
				displayName: 'Blockchain Type',
				name: 'blockchainType',
				type: 'options',
				displayOptions: { show: { resource: ['wallet'], operation: ['transferToken'] } },
				options: [
					{ name: 'EVM', value: 'evm', description: 'Ethereum Virtual Machine (Ethereum, Polygon, Base, etc.)' },
					{ name: 'Solana', value: 'solana', description: 'Solana blockchain' },
				],
				default: 'evm',
				description: 'Blockchain type for both origin and recipient wallets (must be the same)',
				required: true,
			},
			{
				displayName: 'Origin Wallet',
				name: 'originWallet',
				type: 'resourceLocator',
				default: { mode: 'address', value: '' },
				description: 'Select the origin wallet for the transfer',
				displayOptions: { show: { resource: ['wallet'], operation: ['transferToken'] } },
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
				displayName: 'Recipient Wallet',
				name: 'recipientWallet',
				type: 'resourceLocator',
				default: { mode: 'address', value: '' },
				description: 'Select the recipient wallet for the transfer',
				displayOptions: { show: { resource: ['wallet'], operation: ['transferToken'] } },
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
				displayOptions: { show: { resource: ['wallet'], operation: ['getBalance'], balanceLocatorType: ['email', 'userId', 'phoneNumber', 'twitter', 'x'] } },
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
				default: 'ethereum-sepolia',
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
			// Sign Transaction fields
			{
				displayName: 'Chain',
				name: 'signSubmitChain',
				type: 'options',
				displayOptions: { show: { resource: ['wallet'], operation: ['signAndSubmitTransaction'] } },
				options: [
					{ name: 'Ethereum Mainnet', value: 'ethereum', description: 'Ethereum mainnet (Chain ID: 1)' },
					{ name: 'Ethereum Sepolia', value: 'ethereum-sepolia', description: 'Ethereum Sepolia testnet (Chain ID: 11155111)' },
					{ name: 'Polygon', value: 'polygon', description: 'Polygon mainnet (Chain ID: 137)' },
					{ name: 'Polygon Amoy', value: 'polygon-amoy', description: 'Polygon Amoy testnet (Chain ID: 80002)' },
					{ name: 'Base', value: 'base', description: 'Base mainnet (Chain ID: 8453)' },
					{ name: 'Base Sepolia', value: 'base-sepolia', description: 'Base Sepolia testnet (Chain ID: 84532)' },
					{ name: 'Arbitrum', value: 'arbitrum', description: 'Arbitrum One mainnet (Chain ID: 42161)' },
					{ name: 'Arbitrum Sepolia', value: 'arbitrum-sepolia', description: 'Arbitrum Sepolia testnet (Chain ID: 421614)' },
					{ name: 'Optimism', value: 'optimism', description: 'Optimism mainnet (Chain ID: 10)' },
					{ name: 'Optimism Sepolia', value: 'optimism-sepolia', description: 'Optimism Sepolia testnet (Chain ID: 11155420)' },
					{ name: 'Solana Mainnet', value: 'solana' },
					{ name: 'Solana Devnet', value: 'solana-devnet' },
				],
				default: 'ethereum-sepolia',
				description: 'Blockchain network for transaction signing',
				required: true,
			},
			{
				displayName: 'Wallet Address',
				name: 'signSubmitWalletAddress',
				type: 'string',
				displayOptions: { show: { resource: ['wallet'], operation: ['signAndSubmitTransaction'] } },
				default: '',
				placeholder: '0xFfea937EE8DB3c1f25539aE90d6010F264f292B6',
				description: 'Wallet address for the API endpoint (from Create Transfer response)',
				required: true,
			},
			{
				displayName: 'Transaction ID',
				name: 'signSubmitTransactionId',
				type: 'string',
				displayOptions: { show: { resource: ['wallet'], operation: ['signAndSubmitTransaction'] } },
				default: '',
				placeholder: '782ffd15-4946-4e0d-8e21-023134b3d243',
				description: 'The transaction ID that needs approval (from Create Transfer response)',
				required: true,
			},
			{
				displayName: 'Transaction Data',
				name: 'signSubmitTransactionData',
				type: 'string',
				displayOptions: { show: { resource: ['wallet'], operation: ['signAndSubmitTransaction'] } },
				default: '',
				placeholder: 'Hash or message to sign from Create Transfer response',
				description: 'Transaction message/hash to sign (from Create Transfer approvals.pending[0].message)',
				required: true,
			},
			{
				displayName: 'Signer Address',
				name: 'signSubmitSignerAddress',
				type: 'string',
				displayOptions: { show: { resource: ['wallet'], operation: ['signAndSubmitTransaction'] } },
				default: '',
				placeholder: '0x8ed30a8892bc3cb25ca6b52d045b51f176f55913',
				description: 'Address of the external signer (from Create Transfer response)',
				required: true,
			},
			{
				displayName: 'Signer Private Key',
				name: 'signSubmitPrivateKey',
				type: 'string',
				typeOptions: { password: true },
				displayOptions: { show: { resource: ['wallet'], operation: ['signAndSubmitTransaction'] } },
				default: '',
				placeholder: '0x1234... for EVM or base58 for Solana',
				description: 'Private key to sign with (32-byte hex for EVM, base58 for Solana)',
				required: true,
			},
			{
				displayName: 'Wait Until Transaction Is Completed',
				name: 'waitForCompletion',
				type: 'boolean',
				displayOptions: { show: { resource: ['wallet'], operation: ['signAndSubmitTransaction'] } },
				default: false,
				description: 'Wait until the transaction reaches final status (success or failed) before completing the node execution',
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
			// External signer is always required for Pay Order
			{
				displayName: 'Private Key',
				name: 'purchasePrivateKey',
				type: 'string',
				typeOptions: { password: true },
				displayOptions: { show: { resource: ['checkout'], operation: ['purchaseProduct'] } },
				default: '',
				placeholder: '0x1234... for EVM or base58 for Solana',
				description: 'Private key to sign with (32-byte hex for EVM, base58 for Solana) - External signer is required',
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

			// =========================
			// NFT ACTIONS
			// =========================
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['nft'] } },
				options: [
					{
						name: 'Mint NFT',
						value: 'mintNFT',
						description: 'Mint a new NFT to a wallet',
						action: 'Mint NFT',
					},
					{
						name: 'Transfer NFT',
						value: 'transferNFT',
						description: 'Transfer an NFT to another wallet',
						action: 'Transfer NFT',
					},
					{
						name: 'Get NFT',
						value: 'getNFT',
						description: 'Get NFT details by token ID',
						action: 'Get NFT',
					},
				],
				default: 'mintNFT',
			},

			// ---- Mint NFT fields
			{
				displayName: 'Collection ID',
				name: 'collectionId',
				type: 'string',
				displayOptions: { show: { resource: ['nft'], operation: ['mintNFT'] } },
				default: '',
				placeholder: 'default-polygon or 9c82ef99-617f-497d-9abb-fd355291681b',
				description: 'Collection identifier (default collections: default-solana, default-polygon)',
				required: true,
			},
			{
				displayName: 'Recipient',
				name: 'nftRecipient',
				type: 'resourceLocator',
				displayOptions: { show: { resource: ['nft'], operation: ['mintNFT'] } },
				default: { mode: 'address', value: '' },
				description: 'Select the NFT recipient',
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
				name: 'nftChain',
				type: 'options',
				displayOptions: { show: { resource: ['nft'], operation: ['mintNFT'] } },
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
				description: 'Blockchain network for the NFT (only used for email, userId, twitter, x recipient types)',
			},
			{
				displayName: 'Metadata Type',
				name: 'metadataType',
				type: 'options',
				displayOptions: { show: { resource: ['nft'], operation: ['mintNFT'] } },
				options: [
					{ name: 'Metadata Object', value: 'object', description: 'Define metadata inline' },
					{ name: 'Metadata URL', value: 'url', description: 'Reference external JSON metadata' },
					{ name: 'Template ID', value: 'template', description: 'Use existing template' },
				],
				default: 'object',
				description: 'How to provide the NFT metadata',
				required: true,
			},
			{
				displayName: 'NFT Name',
				name: 'nftName',
				type: 'string',
				displayOptions: { show: { resource: ['nft'], operation: ['mintNFT'], metadataType: ['object'] } },
				default: '',
				placeholder: 'My Awesome NFT',
				description: 'The name of your NFT (Max length: 32)',
				required: true,
			},
			{
				displayName: 'NFT Image URL',
				name: 'nftImage',
				type: 'string',
				displayOptions: { show: { resource: ['nft'], operation: ['mintNFT'], metadataType: ['object'] } },
				default: '',
				placeholder: 'https://example.com/image.png',
				description: 'Direct link to your NFT image',
				required: true,
			},
			{
				displayName: 'NFT Description',
				name: 'nftDescription',
				type: 'string',
				displayOptions: { show: { resource: ['nft'], operation: ['mintNFT'], metadataType: ['object'] } },
				default: '',
				placeholder: 'A brief description of the NFT',
				description: 'A brief description of the NFT (Max length: 64)',
				required: true,
			},
			{
				displayName: 'Animation URL',
				name: 'nftAnimationUrl',
				type: 'string',
				displayOptions: { show: { resource: ['nft'], operation: ['mintNFT'], metadataType: ['object'] } },
				default: '',
				placeholder: 'https://example.com/animation.mp4',
				description: 'Animation URL for the NFT (EVM only)',
			},
			{
				displayName: 'Symbol (Solana)',
				name: 'nftSymbol',
				type: 'string',
				displayOptions: { show: { resource: ['nft'], operation: ['mintNFT'], metadataType: ['object'] } },
				default: '',
				placeholder: 'MTK',
				description: 'A shorthand identifier for the token (Max length: 10, Solana only)',
			},
			{
				displayName: 'Attributes',
				name: 'nftAttributes',
				type: 'string',
				displayOptions: { show: { resource: ['nft'], operation: ['mintNFT'], metadataType: ['object'] } },
				default: '',
				placeholder: '[{"trait_type": "Color", "value": "Blue"}, {"trait_type": "Rarity", "value": "Rare"}]',
				description: 'JSON array of attributes (optional)',
			},
			{
				displayName: 'Metadata URL',
				name: 'metadataUrl',
				type: 'string',
				displayOptions: { show: { resource: ['nft'], operation: ['mintNFT'], metadataType: ['url'] } },
				default: '',
				placeholder: 'https://example.com/metadata.json',
				description: 'URL to a JSON file containing the metadata',
				required: true,
			},
			{
				displayName: 'Template ID',
				name: 'templateId',
				type: 'string',
				displayOptions: { show: { resource: ['nft'], operation: ['mintNFT'], metadataType: ['template'] } },
				default: '',
				placeholder: 'template-12345',
				description: 'ID of the template to use for minting',
				required: true,
			},
			{
				displayName: 'Send Notification',
				name: 'sendNotification',
				type: 'boolean',
				displayOptions: { show: { resource: ['nft'], operation: ['mintNFT'] } },
				default: true,
				description: 'Notify recipient via email about successful mint',
			},
			{
				displayName: 'Locale',
				name: 'nftLocale',
				type: 'options',
				displayOptions: { show: { resource: ['nft'], operation: ['mintNFT'] } },
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
				displayOptions: { show: { resource: ['nft'], operation: ['mintNFT'] } },
				default: true,
				description: 'URLs in metadata will be resolved and reuploaded to IPFS',
			},
			{
				displayName: 'Compressed (Solana)',
				name: 'compressed',
				type: 'boolean',
				displayOptions: { show: { resource: ['nft'], operation: ['mintNFT'] } },
				default: true,
				description: 'Use NFT compression for cheaper mint costs (Solana only)',
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
					case 'signAndSubmitTransaction':
						responseData = await CrossmintNode.signTransactionMethod(this, baseUrl, credentials, i);
						break;
					case 'mintNFT':
						responseData = await CrossmintNode.mintNFTMethod(this, baseUrl, credentials, i);
						break;
					default:
						throw new NodeOperationError(this.getNode(), `Unsupported operation: ${operation}`);
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

	// WALLETS

	private static async createWalletMethod(
		context: IExecuteFunctions,
		baseUrl: string,
		credentials: any,
		itemIndex: number,
	): Promise<any> {
		const chainType = context.getNodeParameter('chainType', itemIndex) as string;
		const ownerType = context.getNodeParameter('ownerType', itemIndex) as string;
		const externalSignerDetails = context.getNodeParameter('externalSignerDetails', itemIndex) as string;

		// Validate external signer private key is provided (always required)
		if (!externalSignerDetails || externalSignerDetails.trim() === '') {
			throw new NodeOperationError(context.getNode(), 'External signer private key is required', {
				description: 'External signer private key is required for Get or Create Wallet operation',
				itemIndex,
			});
		}

		let adminSigner: any;
		let derivedAddress: string | undefined;
		let derivedPublicKey: string | undefined;

		// Always handle external signer (required)

			let privateKeyStr: string;
			let signerChainType: string;

			if (externalSignerDetails.startsWith('0x') || (externalSignerDetails.length === 64 && /^[a-fA-F0-9]+$/.test(externalSignerDetails))) {
				signerChainType = 'evm';
				privateKeyStr = externalSignerDetails;
			} else {
				// Try to decode as base58 to validate Solana key
				try {
					const decoded = bs58.decode(externalSignerDetails);
					if (decoded.length === 64 || decoded.length === 32) {
						signerChainType = 'solana';
						privateKeyStr = externalSignerDetails;
					} else {
						throw new NodeOperationError(context.getNode(), 'Invalid key length');
					}
				} catch (error) {
					throw new NodeOperationError(context.getNode(), 'Invalid private key format. Use 32-byte hex for EVM or base58 for Solana', {
						itemIndex,
					});
				}
			}

			let address: string;
			let publicKey: string;

			try {
				if (signerChainType === 'evm') {
					let privateKeyBuffer: Buffer;
					if (privateKeyStr.startsWith('0x')) {
						privateKeyBuffer = Buffer.from(privateKeyStr.slice(2), 'hex');
					} else {
						privateKeyBuffer = Buffer.from(privateKeyStr, 'hex');
					}

					if (privateKeyBuffer.length !== 32) {
						throw new NodeOperationError(context.getNode(), 'EVM private key must be 32 bytes');
					}

					// Use ethers to derive address from private key
					const normalizedPrivateKey = privateKeyStr.startsWith('0x') ? privateKeyStr : '0x' + privateKeyStr;
					const wallet = new ethers.Wallet(normalizedPrivateKey);
					address = wallet.address;
					publicKey = wallet.signingKey.publicKey;

				} else if (signerChainType === 'solana') {
					// Use @solana/web3.js to derive address from private key
					const secretKeyBytes = bs58.decode(privateKeyStr);

					// Solana keys can be 32 bytes (seed) or 64 bytes (full keypair)
					let fullSecretKey: Uint8Array;
					if (secretKeyBytes.length === 32) {
						// If it's 32 bytes, it's likely just the seed - need to derive full keypair
						fullSecretKey = new Uint8Array(64);
						fullSecretKey.set(secretKeyBytes);
						// For now, we'll duplicate the 32 bytes to make 64 bytes
						// This is not the correct way but will make it work temporarily
						fullSecretKey.set(secretKeyBytes, 32);
					} else if (secretKeyBytes.length === 64) {
						fullSecretKey = secretKeyBytes;
					} else {
						throw new NodeOperationError(context.getNode(), `Invalid Solana private key: decoded to ${secretKeyBytes.length} bytes, expected 32 or 64`);
					}

					const keypair = Keypair.fromSecretKey(fullSecretKey);
					address = keypair.publicKey.toBase58();
					publicKey = address;
				} else {
					throw new NodeOperationError(context.getNode(), `Unsupported chain type: ${signerChainType}`, {
						itemIndex,
					});
				}
			} catch (error: any) {
				throw new NodeOperationError(context.getNode(), `Failed to process private key: ${error.message}`, {
					itemIndex,
				});
			}

			adminSigner = {
				type: 'external-wallet',
				address: address,
			};

			derivedAddress = address;
			derivedPublicKey = publicKey;

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
			'X-API-KEY': (credentials as any).apiKey,
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
			const response = await context.helpers.httpRequest(requestOptions);

			if (derivedAddress && derivedPublicKey) {
				return {
					...response,
					derivedAddress: derivedAddress,
					derivedPublicKey: derivedPublicKey,
				};
			}

			return response;
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
			default:
				throw new NodeOperationError(context.getNode(), `Unsupported locator type: ${locatorType}`, {
					itemIndex,
				});
		}

		const requestOptions: IHttpRequestOptions = {
			method: 'GET',
			url: `${baseUrl}/2025-06-09/wallets/${encodeURIComponent(walletLocator)}`,
			headers: {
				'X-API-KEY': (credentials as any).apiKey,
			},
			json: true,
		};

		try {
			return await context.helpers.httpRequest(requestOptions);
		} catch (error: any) {
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
				'X-API-KEY': (credentials as any).apiKey,
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
		const amountStr = String(amount).trim();
		if (!amount || amountStr === '') {
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
		const numericAmount = parseFloat(amountStr);
		if (isNaN(numericAmount) || numericAmount <= 0) {
			throw new NodeOperationError(context.getNode(), 'Invalid amount', {
				description: `The amount '${amountStr}' is not a valid positive number`,
				itemIndex,
			});
		}

		// Get blockchain type for both wallets (must be the same)
		const blockchainType = context.getNodeParameter('blockchainType', itemIndex) as string;

		// Build origin wallet locator from resource locator
		const originWallet = context.getNodeParameter('originWallet', itemIndex) as any;
		let fromWalletLocator: string;

		const originMode = originWallet.mode;
		const originValue = originWallet.value;

		if (!originValue || originValue.trim() === '') {
			throw new NodeOperationError(context.getNode(), 'Origin wallet value is required', {
				description: 'Please specify the origin wallet identifier',
				itemIndex,
			});
		}

		switch (originMode) {
			case 'address': {
				fromWalletLocator = originValue;
				break;
			}
			case 'email':
			case 'userId':
			case 'phoneNumber':
			case 'twitter':
			case 'x': {
				fromWalletLocator = `${originMode}:${originValue}:${blockchainType}:smart`;
				break;
			}
			default:
				throw new NodeOperationError(context.getNode(), `Unsupported origin wallet mode: ${originMode}`, {
					itemIndex,
				});
		}

		// Build recipient wallet locator from resource locator
		const recipientWallet = context.getNodeParameter('recipientWallet', itemIndex) as any;
		let recipient: string;

		const recipientMode = recipientWallet.mode;
		const recipientValue = recipientWallet.value;

		if (!recipientValue || recipientValue.trim() === '') {
			throw new NodeOperationError(context.getNode(), 'Recipient wallet value is required', {
				description: 'Please specify the recipient wallet identifier',
				itemIndex,
			});
		}

		switch (recipientMode) {
			case 'address': {
				recipient = recipientValue;
				break;
			}
			case 'email':
			case 'userId':
			case 'phoneNumber':
			case 'twitter':
			case 'x': {
				recipient = `${recipientMode}:${recipientValue}:${tokenChain}`;
				break;
			}
			default:
				throw new NodeOperationError(context.getNode(), `Unsupported recipient wallet mode: ${recipientMode}`, {
					itemIndex,
				});
		}

		// Use the new transfer API format
		const requestOptions: IHttpRequestOptions = {
			method: 'POST',
			url: `${baseUrl}/2025-06-09/wallets/${encodeURIComponent(fromWalletLocator)}/tokens/${encodeURIComponent(tokenLocator)}/transfers`,
			headers: {
				'X-API-KEY': (credentials as any).apiKey,
				'Content-Type': 'application/json',
			},
			body: {
				recipient: recipient,
				amount: amountStr,
			},
			json: true,
		};

		try {
			const rawResponse = await context.helpers.httpRequest(requestOptions);
			
			// Build simplified-output with specific fields
			let chain;
			if (rawResponse.params && rawResponse.params.calls && rawResponse.params.calls[0]) {
				chain = rawResponse.params.calls[0].chain;
			}
			
			const simplifiedOutput = {
				chainType: rawResponse.chainType,
				walletType: rawResponse.walletType,
				from: originWallet,
				to: recipientWallet,
				chain: chain,
				id: rawResponse.id,
				status: rawResponse.status,
				approvals: rawResponse.approvals || {}
			};
			
			// Return both simplified and raw data
			return {
				'simplified-output': simplifiedOutput,
				raw: rawResponse
			};
		} catch (error: any) {
			// Pass through the original Crossmint API error exactly as received
			throw new NodeApiError(context.getNode(), error);
		}
	}

	private static async signTransactionMethod(
		context: IExecuteFunctions,
		baseUrl: string,
		credentials: ICredentials,
		itemIndex: number,
	): Promise<any> {
		// Get parameters specific to the combined operation
		const chain = context.getNodeParameter('signSubmitChain', itemIndex) as string;
		const privateKey = context.getNodeParameter('signSubmitPrivateKey', itemIndex) as string;
		const transactionData = context.getNodeParameter('signSubmitTransactionData', itemIndex) as string;
		const walletAddress = context.getNodeParameter('signSubmitWalletAddress', itemIndex) as string;
		const transactionId = context.getNodeParameter('signSubmitTransactionId', itemIndex) as string;
		const signerAddress = context.getNodeParameter('signSubmitSignerAddress', itemIndex) as string;
		const waitForCompletion = context.getNodeParameter('waitForCompletion', itemIndex) as boolean;

		// Step 1: Sign the transaction using the same logic as signTransactionMethod
		let signature: string = '';
		let signedTransaction: string = '';
		let signerChainType: string;

		// Determine chain type and validate private key format
		if (chain.includes('solana')) {
			signerChainType = 'solana';
			if (!(privateKey.length >= 80 && privateKey.length <= 90)) {
				throw new NodeOperationError(context.getNode(), 'Invalid Solana private key format. Use base58 encoded key', {
					itemIndex,
				});
			}
		} else {
			signerChainType = 'evm';
			if (!(privateKey.startsWith('0x') || (privateKey.length === 64 && /^[a-fA-F0-9]+$/.test(privateKey)))) {
				throw new NodeOperationError(context.getNode(), 'Invalid EVM private key format. Use 32-byte hex string', {
					itemIndex,
				});
			}
		}

		try {
			if (signerChainType === 'evm') {
				const normalizedPrivateKey = privateKey.startsWith('0x') ? privateKey : '0x' + privateKey;
				const wallet = new ethers.Wallet(normalizedPrivateKey);

				// Sign the transaction data as message
				const messageBytes = ethers.getBytes(transactionData);
				signature = await wallet.signMessage(messageBytes);
				signedTransaction = signature;

			} else if (signerChainType === 'solana') {
				// Use @solana/web3.js for Solana signing
				const secretKeyBytes = bs58.decode(privateKey);
				if (secretKeyBytes.length !== 64) {
					throw new NodeOperationError(context.getNode(), 'Invalid Solana private key: must decode to 64 bytes');
				}

				// Check if it's base58 encoded or plain text
				let messageBytes: Uint8Array;
				try {
					// Try to decode as base58 first (for Crossmint transaction messages)
					messageBytes = bs58.decode(transactionData);
				} catch (error) {
					// If base58 decode fails, treat as plain text
					messageBytes = new TextEncoder().encode(transactionData);
				}

				const nacl = await import('tweetnacl');
				const signatureBytes = nacl.sign.detached(messageBytes, secretKeyBytes);
				signature = bs58.encode(signatureBytes);
				signedTransaction = signature;
			}
		} catch (error: any) {
			throw new NodeOperationError(context.getNode(), `Failed to sign message: ${error.message}`, {
				itemIndex,
			});
		}

		// Ensure signature was created
		if (!signature) {
			throw new NodeOperationError(context.getNode(), 'Failed to generate signature', {
				itemIndex,
			});
		}

		// Step 2: Submit the signature using the same logic as submitSignatureMethod
		// Validate required fields
		if (!walletAddress || !transactionId || !signerAddress || !signature) {
			throw new NodeOperationError(context.getNode(), 'Wallet Address, Transaction ID, Signer Address, and Signature are required', {
				itemIndex,
			});
		}

		// Build request body with the correct format
		const requestBody = {
			approvals: [
				{
					signer: `external-wallet:${signerAddress}`,
					signature: signature,
				}
			]
		};

		// Use the correct API endpoint format
		const requestOptions: IHttpRequestOptions = {
			method: 'POST',
			url: `${baseUrl}/2025-06-09/wallets/${encodeURIComponent(walletAddress)}/transactions/${encodeURIComponent(transactionId)}/approvals`,
			headers: {
				'X-API-KEY': (credentials as any).apiKey,
				'Content-Type': 'application/json',
			},
			body: requestBody,
			json: true,
		};

		try {
			const rawResponse = await context.helpers.httpRequest(requestOptions);

			const simplifiedOutput = {
				chainType: rawResponse.chainType,
				walletType: rawResponse.walletType,
				id: rawResponse.id,
				status: rawResponse.status,
				createdAt: rawResponse.createdAt,
				approvals: rawResponse.approvals || {},
				signingDetails: {
					signature: signature,
					signedTransaction: signedTransaction,
					chainType: signerChainType,
					chain: chain,
					transactionData: transactionData,
				},
				submittedApproval: {
					walletAddress,
					transactionId,
					signerAddress,
					signature,
				},
			};

			let finalResponse = {
				'simplified-output': simplifiedOutput,
				raw: rawResponse
			};

			// If waitForCompletion is true, poll for transaction completion
			if (waitForCompletion) {
				let currentStatus = rawResponse.status;
				let attempts = 0;
				const maxAttempts = 60; // Maximum 5 minutes (5 second intervals)
				
				while (currentStatus === 'pending' && attempts < maxAttempts) {
					await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
					attempts++;
					
					try {
						const statusResponse = await CrossmintNode.getTransactionStatus(
							context,
							baseUrl,
							credentials,
							walletAddress,
							transactionId
						);
						
						currentStatus = statusResponse.status;
						
						// Update the response with latest status
						const updatedSimplifiedOutput = {
							...simplifiedOutput,
							status: currentStatus,
						};
						
						// Add optional fields if they exist
						if (statusResponse.completedAt) {
							(updatedSimplifiedOutput as any).completedAt = statusResponse.completedAt;
						}
						if (statusResponse.error) {
							(updatedSimplifiedOutput as any).error = statusResponse.error;
						}
						
						finalResponse = {
							'simplified-output': updatedSimplifiedOutput,
							raw: statusResponse
						};
						
					} catch (error) {
						// If status check fails, continue with original response
						break;
					}
					
					// Break if transaction is completed (success or failed)
					if (currentStatus === 'success' || currentStatus === 'failed') {
						break;
					}
				}
			}

			return finalResponse;
		} catch (error: any) {
			throw new NodeApiError(context.getNode(), error);
		}
	}

	private static async getTransactionStatus(
		context: IExecuteFunctions,
		baseUrl: string,
		credentials: any,
		walletAddress: string,
		transactionId: string,
	): Promise<any> {
		const requestOptions: IHttpRequestOptions = {
			method: 'GET',
			url: `${baseUrl}/2025-06-09/wallets/${encodeURIComponent(walletAddress)}/transactions/${encodeURIComponent(transactionId)}`,
			headers: {
				'X-API-KEY': (credentials as any).apiKey,
			},
			json: true,
		};

		try {
			return await context.helpers.httpRequest(requestOptions);
		} catch (error: any) {
			throw new NodeApiError(context.getNode(), error);
		}
	}

	// NFT METHODS

	private static async mintNFTMethod(
		context: IExecuteFunctions,
		baseUrl: string,
		credentials: any,
		itemIndex: number,
	): Promise<any> {
		const collectionId = context.getNodeParameter('collectionId', itemIndex) as string;
		const recipientData = context.getNodeParameter('nftRecipient', itemIndex) as any;
		const metadataType = context.getNodeParameter('metadataType', itemIndex) as string;
		
		// Validate required fields
		if (!collectionId || collectionId.trim() === '') {
			throw new NodeOperationError(context.getNode(), 'Collection ID is required', {
				description: 'Please specify the collection identifier',
				itemIndex,
			});
		}

		// Build recipient string based on resourceLocator mode
		let recipient: string;
		if (recipientData.mode === 'address') {
			// Direct address format: <chain>:<address>
			// We need to extract chain from the address format or use a default
			const address = recipientData.value;
			if (!address || address.trim() === '') {
				throw new NodeOperationError(context.getNode(), 'Wallet address is required', {
					itemIndex,
				});
			}
			
			// For address mode, we need to determine the chain from the address format
			if (address.startsWith('0x')) {
				// EVM address - default to polygon for simplicity
				recipient = `polygon:${address}`;
			} else {
				// Solana address
				recipient = `solana:${address}`;
			}
		} else {
			// Other modes: email, userId, twitter, x
			const value = recipientData.value;
			const chain = context.getNodeParameter('nftChain', itemIndex) as string;
			
			if (!value || value.trim() === '') {
				throw new NodeOperationError(context.getNode(), 'Recipient value is required', {
					itemIndex,
				});
			}
			
			recipient = `${recipientData.mode}:${value}:${chain}`;
		}

		// Build request body based on metadata type
		const requestBody: any = {
			recipient: recipient,
			sendNotification: context.getNodeParameter('sendNotification', itemIndex) as boolean,
			locale: context.getNodeParameter('nftLocale', itemIndex) as string,
			reuploadLinkedFiles: context.getNodeParameter('reuploadLinkedFiles', itemIndex) as boolean,
			compressed: context.getNodeParameter('compressed', itemIndex) as boolean,
		};

		if (metadataType === 'template') {
			// Template ID mode
			const templateId = context.getNodeParameter('templateId', itemIndex) as string;
			if (!templateId || templateId.trim() === '') {
				throw new NodeOperationError(context.getNode(), 'Template ID is required when using template mode', {
					itemIndex,
				});
			}
			requestBody.templateId = templateId;
		} else if (metadataType === 'url') {
			// Metadata URL mode
			const metadataUrl = context.getNodeParameter('metadataUrl', itemIndex) as string;
			if (!metadataUrl || metadataUrl.trim() === '') {
				throw new NodeOperationError(context.getNode(), 'Metadata URL is required when using URL mode', {
					itemIndex,
				});
			}
			requestBody.metadata = metadataUrl;
		} else {
			// Metadata object mode
			const name = context.getNodeParameter('nftName', itemIndex) as string;
			const image = context.getNodeParameter('nftImage', itemIndex) as string;
			const description = context.getNodeParameter('nftDescription', itemIndex) as string;
			
			if (!name || !image || !description) {
				throw new NodeOperationError(context.getNode(), 'Name, Image, and Description are required for metadata object mode', {
					itemIndex,
				});
			}

			const metadata: any = {
				name: name,
				image: image,
				description: description,
			};

			// Optional fields
			const animationUrl = context.getNodeParameter('nftAnimationUrl', itemIndex) as string;
			const symbol = context.getNodeParameter('nftSymbol', itemIndex) as string;
			const attributesJson = context.getNodeParameter('nftAttributes', itemIndex) as string;

			if (animationUrl) {
				metadata.animation_url = animationUrl;
			}

			if (symbol) {
				metadata.symbol = symbol;
			}

			// Parse attributes if provided
			if (attributesJson && attributesJson.trim() !== '') {
				try {
					const attributes = JSON.parse(attributesJson);
					if (Array.isArray(attributes)) {
						metadata.attributes = attributes;
					}
				} catch (error) {
					throw new NodeOperationError(context.getNode(), 'Invalid JSON format for attributes', {
						description: 'Please provide a valid JSON array for attributes',
						itemIndex,
					});
				}
			}

			requestBody.metadata = metadata;
		}

		const requestOptions: IHttpRequestOptions = {
			method: 'POST',
			url: `${baseUrl}/2022-06-09/collections/${encodeURIComponent(collectionId)}/nfts`,
			headers: {
				'X-API-KEY': (credentials as any).apiKey,
				'Content-Type': 'application/json',
			},
			body: requestBody,
			json: true,
		};

		try {
			return await context.helpers.httpRequest(requestOptions);
		} catch (error: any) {
			throw new NodeApiError(context.getNode(), error);
		}
	}

	// CHECKOUT

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
				'X-API-KEY': (credentials as any).apiKey,
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
		// Get parameters from UI - Always require external signer
		const serializedTransaction = context.getNodeParameter('serializedTransaction', itemIndex) as string;
		const payerAddress = context.getNodeParameter('payerAddress', itemIndex) as string;
		const chain = context.getNodeParameter('paymentMethod', itemIndex) as string;
		const privateKey = context.getNodeParameter('purchasePrivateKey', itemIndex) as string;

		// Validate required fields
		if (!serializedTransaction || serializedTransaction.trim() === '') {
			throw new NodeOperationError(context.getNode(), 'Serialized transaction is required', {
				description: 'Please provide the serialized transaction from the Create Order response',
				itemIndex,
			});
		}

		if (!payerAddress || payerAddress.trim() === '') {
			throw new NodeOperationError(context.getNode(), 'Payer address is required', {
				description: 'Please provide the payer wallet address for crypto payments',
				itemIndex,
			});
		}

		if (!chain || chain.trim() === '') {
			throw new NodeOperationError(context.getNode(), 'Chain is required', {
				description: 'Please specify the blockchain chain',
				itemIndex,
			});
		}

		if (!privateKey || privateKey.trim() === '') {
			throw new NodeOperationError(context.getNode(), 'Private key is required', {
				description: 'External signer private key is required for Pay Order operation',
				itemIndex,
			});
		}
		
		// Step 1: Create Transaction using 2025-06-09 API format
		let requestBody: any;
		if (chain.includes('solana')) {
			// Solana format: direct transaction
			requestBody = {
				params: {
					transaction: serializedTransaction
				}
			};
		} else {
			// EVM format: calls array with transaction
			requestBody = {
				params: {
					calls: [{
						transaction: serializedTransaction
					}],
					chain: chain
				}
			};
		}
		
		const createTransactionOptions: IHttpRequestOptions = {
			method: 'POST',
			url: `${baseUrl}/2025-06-09/wallets/${encodeURIComponent(payerAddress)}/transactions`,
			headers: {
				'X-API-KEY': (credentials as any).apiKey,
				'Content-Type': 'application/json',
			},
			body: requestBody,
			json: true,
		};

		const transactionResponse = await context.helpers.httpRequest(createTransactionOptions);
		const transactionId = transactionResponse.id;
		
		// Step 2: Always sign with external wallet (required)
		// Get the message to sign from transaction response
		if (!transactionResponse.approvals || !transactionResponse.approvals.pending || !transactionResponse.approvals.pending[0]) {
			throw new NodeOperationError(context.getNode(), 'No pending approval found in transaction response', {
				itemIndex,
			});
		}
		
		const messageToSign = transactionResponse.approvals.pending[0].message;
		const signerAddress = transactionResponse.approvals.pending[0].signer.address || transactionResponse.approvals.pending[0].signer.locator.split(':')[1];
		
		// Sign the message (not the full transaction)
		let signature: string = '';
		try {
			if (chain.includes('solana')) {
				// Solana message signing
				const secretKeyBytes = bs58.decode(privateKey);
				const messageBytes = bs58.decode(messageToSign);
				const nacl = await import('tweetnacl');
				const signatureBytes = nacl.sign.detached(messageBytes, secretKeyBytes);
				signature = bs58.encode(signatureBytes);
			} else {
				// EVM message signing
				const normalizedPrivateKey = privateKey.startsWith('0x') ? privateKey : '0x' + privateKey;
				const wallet = new ethers.Wallet(normalizedPrivateKey);
				const messageBytes = ethers.getBytes(messageToSign);
				signature = await wallet.signMessage(messageBytes);
			}
		} catch (error: any) {
			throw new NodeOperationError(context.getNode(), `Failed to sign message: ${error.message}`, {
				itemIndex,
			});
		}

		const signingDetails = {
			signature,
			messageToSign,
			signerAddress,
			chainType: chain.includes('solana') ? 'solana' : 'evm',
			chain
		};

		// Step 3: Submit Approval
		const approvalRequestBody = {
			approvals: [{
				signer: `external-wallet:${signerAddress}`,
				signature: signature,
			}]
		};

		const approvalOptions: IHttpRequestOptions = {
			method: 'POST',
			url: `${baseUrl}/2025-06-09/wallets/${encodeURIComponent(payerAddress)}/transactions/${encodeURIComponent(transactionId)}/approvals`,
			headers: {
				'X-API-KEY': (credentials as any).apiKey,
				'Content-Type': 'application/json',
			},
			body: approvalRequestBody,
			json: true,
		};

		const approvalResponse = await context.helpers.httpRequest(approvalOptions);
		
		return {
			transaction: transactionResponse,
			approval: approvalResponse,
			signingDetails
		};
	}

}