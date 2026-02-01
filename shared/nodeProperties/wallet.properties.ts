import { INodeProperties } from 'n8n-workflow';
import { ChainFactory } from '../chains/ChainFactory';
import { createOwnerTypeFields } from './owner.properties';
import { createWalletLocatorProperty, createChainTypeSelectorProperty } from './locator.properties';

/**
 * Wallet Operation Properties
 *
 * High-level property builders for complete wallet operations.
 * These combine multiple property groups into operation-specific sets.
 */

/**
 * Creates all properties for the "Get or Create Wallet" operation.
 *
 * @returns Array of INodeProperties for wallet creation
 */
export function createGetOrCreateWalletFields(): INodeProperties[] {
	const chainOptions = ChainFactory.getChainOptions();

	return [
		{
			displayName: 'Chain Type',
			name: 'chainType',
			type: 'options',
			displayOptions: { show: { resource: ['wallet'], operation: ['getOrCreateWallet'] } },
			options: chainOptions,
			default: chainOptions.length > 0 ? chainOptions[0].value : 'solana',
			description: 'Blockchain type',
		},
		...createOwnerTypeFields('getOrCreateWallet', false),
		{
			displayName: 'Admin Signer',
			name: 'externalSignerDetails',
			type: 'string',
			typeOptions: { password: true },
			displayOptions: { show: { resource: ['wallet'], operation: ['getOrCreateWallet'] } },
			default: '',
			placeholder: 'Enter private key',
			description: 'Private key that authorizes all transactions from this wallet. Use this link to generate them: https://www.val.town/x/Crossmint/crypto-address-generator.',
			required: true,
		},
	];
}

/**
 * Creates all properties for the "Get Wallet" operation.
 *
 * @returns Array of INodeProperties for wallet retrieval
 */
export function createGetWalletFields(): INodeProperties[] {
	return [
		createWalletLocatorProperty('getWalletLocator', 'getWallet', 'Select the wallet to retrieve'),
		createChainTypeSelectorProperty('getWalletChainType', 'getWallet'),
	];
}

/**
 * Creates all properties for the "Create Transfer" operation.
 *
 * @returns Array of INodeProperties for token transfers
 */
export function createTransferFields(): INodeProperties[] {
	const chainOptions = ChainFactory.getChainOptions();

	return [
		{
			displayName: 'Blockchain Type',
			name: 'blockchainType',
			type: 'options',
			displayOptions: { show: { resource: ['wallet'], operation: ['createTransfer'] } },
			options: chainOptions,
			default: chainOptions.length > 0 ? chainOptions[0].value : 'solana',
			description: 'Blockchain type for both origin and recipient wallets',
			required: true,
		},
		// Solana network selector - shown when blockchainType is 'solana'
		{
			displayName: 'Network',
			name: 'transferNetworkSolana',
			type: 'options',
			displayOptions: {
				show: {
					resource: ['wallet'],
					operation: ['createTransfer'],
					blockchainType: ['solana'],
				},
			},
			typeOptions: {
				loadOptionsMethod: 'getSolanaNetworkOptions',
			},
			default: '',
			description: 'Solana network (filtered by credential environment)',
			required: true,
		},
		// EVM network selector - shown when blockchainType is 'evm'
		{
			displayName: 'Network',
			name: 'transferNetworkEvm',
			type: 'options',
			displayOptions: {
				show: {
					resource: ['wallet'],
					operation: ['createTransfer'],
					blockchainType: ['evm'],
				},
			},
			typeOptions: {
				loadOptionsMethod: 'getEvmNetworkOptions',
			},
			default: '',
			description: 'EVM network (filtered by credential environment)',
			required: true,
		},
		createWalletLocatorProperty('originWallet', 'createTransfer', 'Select the origin wallet for the transfer'),
		createWalletLocatorProperty('recipientWallet', 'createTransfer', 'Select the recipient wallet for the transfer'),
	];
}

/**
 * Creates all properties for the "Get Balance" operation.
 *
 * @returns Array of INodeProperties for balance queries
 */
export function createGetBalanceFields(): INodeProperties[] {
	const chainOptions = ChainFactory.getChainOptions();

	return [
		{
			displayName: 'Blockchain Type',
			name: 'balanceBlockchainType',
			type: 'options',
			displayOptions: { show: { resource: ['wallet'], operation: ['getBalance'] } },
			options: chainOptions,
			default: chainOptions.length > 0 ? chainOptions[0].value : 'solana',
			description: 'Blockchain type for the wallet',
			required: true,
		},
		// Solana network selector - shown when balanceBlockchainType is 'solana'
		{
			displayName: 'Network',
			name: 'balanceNetworkSolana',
			type: 'options',
			displayOptions: {
				show: {
					resource: ['wallet'],
					operation: ['getBalance'],
					balanceBlockchainType: ['solana'],
				},
			},
			typeOptions: {
				loadOptionsMethod: 'getSolanaNetworkOptions',
			},
			default: '',
			description: 'Solana network (filtered by credential environment)',
			required: true,
		},
		// EVM network selector - shown when balanceBlockchainType is 'evm'
		{
			displayName: 'Network',
			name: 'balanceNetworkEvm',
			type: 'options',
			displayOptions: {
				show: {
					resource: ['wallet'],
					operation: ['getBalance'],
					balanceBlockchainType: ['evm'],
				},
			},
			typeOptions: {
				loadOptionsMethod: 'getEvmNetworkOptions',
			},
			default: '',
			description: 'EVM network (filtered by credential environment)',
			required: true,
		},
		createWalletLocatorProperty('walletLocator', 'getBalance', 'Select the wallet to get balance for'),
	];
}
