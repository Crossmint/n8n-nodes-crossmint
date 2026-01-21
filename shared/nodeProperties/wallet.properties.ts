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
 * @param chainType - The blockchain type (default: 'solana')
 * @returns Array of INodeProperties for wallet creation
 */
export function createGetOrCreateWalletFields(chainType: string = 'solana'): INodeProperties[] {
	const provider = ChainFactory.createProvider(chainType);
	const networks = provider?.getNetworks() || [];

	return [
		{
			displayName: 'Chain Type',
			name: 'chainType',
			type: 'options',
			displayOptions: { show: { resource: ['wallet'], operation: ['getOrCreateWallet'] } },
			options: networks.length > 0
				? [{ name: provider?.displayName || 'Solana', value: chainType, description: `${provider?.displayName || 'Solana'} blockchain` }]
				: [{ name: 'Solana', value: 'solana', description: 'Solana blockchain' }],
			default: chainType,
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
			placeholder: chainType === 'solana' ? 'Enter private key (base58 for Solana)' : 'Enter private key',
			description: 'Private key that authorizes all transactions from this wallet. Use this link to generate them: https://www.val.town/x/Crossmint/crypto-address-generator.',
			required: true,
		},
	];
}

/**
 * Creates all properties for the "Get Wallet" operation.
 *
 * @param chainType - The blockchain type (default: 'solana')
 * @returns Array of INodeProperties for wallet retrieval
 */
export function createGetWalletFields(chainType: string = 'solana'): INodeProperties[] {
	return [
		createWalletLocatorProperty('getWalletLocator', 'getWallet', 'Select the wallet to retrieve', chainType),
		createChainTypeSelectorProperty('getWalletChainType', 'getWallet'),
	];
}

/**
 * Creates all properties for the "Create Transfer" operation.
 *
 * @param chainType - The blockchain type (default: 'solana')
 * @returns Array of INodeProperties for token transfers
 */
export function createTransferFields(chainType: string = 'solana'): INodeProperties[] {
	const provider = ChainFactory.createProvider(chainType);

	return [
		{
			displayName: 'Blockchain Type',
			name: 'blockchainType',
			type: 'options',
			displayOptions: { show: { resource: ['wallet'], operation: ['createTransfer'] } },
			options: [
				{ name: provider?.displayName || 'Solana', value: chainType, description: `${provider?.displayName || 'Solana'} blockchain` },
			],
			default: chainType,
			description: 'Blockchain type for both origin and recipient wallets',
			required: true,
		},
		createWalletLocatorProperty('originWallet', 'createTransfer', 'Select the origin wallet for the transfer', chainType),
		createWalletLocatorProperty('recipientWallet', 'createTransfer', 'Select the recipient wallet for the transfer', chainType),
	];
}

/**
 * Creates all properties for the "Get Balance" operation.
 *
 * @param chainType - The blockchain type (default: 'solana')
 * @returns Array of INodeProperties for balance queries
 */
export function createGetBalanceFields(chainType: string = 'solana'): INodeProperties[] {
	return [
		createWalletLocatorProperty('walletLocator', 'getBalance', 'Select the wallet to get balance for', chainType),
		createChainTypeSelectorProperty('balanceWalletChainType', 'getBalance'),
	];
}
