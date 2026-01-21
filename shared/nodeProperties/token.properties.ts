import { ChainRegistry } from '../chains/ChainRegistry';
import { INodeProperties } from 'n8n-workflow';

/**
 * Token and Amount Properties
 *
 * Reusable property builders for token-related fields (chain, token symbol, amount).
 * Used in transfer and balance operations.
 */

/**
 * Creates a token chain/network selector property.
 * Uses ChainRegistry to generate dynamic placeholder based on available networks.
 *
 * @param name - The parameter name
 * @param operation - The operation this applies to
 * @param chainType - The blockchain type (default: 'solana')
 * @param description - Optional custom description
 * @returns INodeProperties for chain/network selection
 */
export function createTokenChainProperty(
	name: string,
	operation: string,
	chainType: string = 'solana',
	description: string = 'Blockchain network for the token',
): INodeProperties {
	const provider = ChainRegistry.getProvider(chainType);
	const networks = provider?.getNetworks() || [];

	// Generate placeholder from actual networks
	const placeholder = networks.length > 0
		? networks.map(n => n.id).join(' or ')
		: 'Enter network identifier';

	return {
		displayName: 'Chain',
		name,
		type: 'string',
		displayOptions: { show: { resource: ['wallet'], operation: [operation] } },
		default: networks[0]?.id || '',
		placeholder,
		description,
		required: true,
	} as INodeProperties;
}

/**
 * Creates a token symbol/name input property.
 *
 * @param name - The parameter name
 * @param operation - The operation this applies to
 * @param description - Optional custom description
 * @param placeholder - Optional custom placeholder
 * @returns INodeProperties for token symbol input
 */
export function createTokenSymbolProperty(
	name: string,
	operation: string,
	description: string = 'Token symbol or name',
	placeholder: string = 'sol or usdc',
): INodeProperties {
	return {
		displayName: 'Token Name (Locator ID)',
		name,
		type: 'string',
		displayOptions: { show: { resource: ['wallet'], operation: [operation] } },
		default: '',
		placeholder,
		description,
		required: true,
	} as INodeProperties;
}

/**
 * Creates an amount input property for token transfers.
 *
 * @param name - The parameter name (default: 'amount')
 * @param operation - The operation this applies to
 * @param description - Optional custom description
 * @returns INodeProperties for amount input
 */
export function createAmountProperty(
	name: string = 'amount',
	operation: string = 'createTransfer',
	description: string = 'Amount of tokens to send (decimal format)',
): INodeProperties {
	return {
		displayName: 'Amount',
		name,
		type: 'string',
		displayOptions: { show: { resource: ['wallet'], operation: [operation] } },
		default: '',
		placeholder: '10.50',
		description,
		required: true,
	} as INodeProperties;
}

/**
 * Creates properties for querying token balances.
 * Returns chain and token list fields with dynamic placeholders.
 *
 * @param operation - The operation this applies to
 * @param chainType - The blockchain type (default: 'solana')
 * @returns Array of INodeProperties for balance queries
 */
export function createBalanceQueryFields(operation: string, chainType: string = 'solana'): INodeProperties[] {
	const provider = ChainRegistry.getProvider(chainType);
	const networks = provider?.getNetworks() || [];

	// Generate placeholder from actual networks
	const chainPlaceholder = networks.length > 0
		? networks.map(n => n.id).join(' or ')
		: 'Enter network identifier';

	return [
		{
			displayName: 'Chains',
			name: 'chains',
			type: 'string',
			displayOptions: { show: { resource: ['wallet'], operation: [operation] } },
			default: networks[0]?.id || 'solana',
			placeholder: chainPlaceholder,
			description: 'Comma-separated list of blockchain chains to query',
			required: true,
		},
		{
			displayName: 'Tokens',
			name: 'tkn',
			type: 'string',
			displayOptions: { show: { resource: ['wallet'], operation: [operation] } },
			default: 'sol,usdc',
			placeholder: 'sol,usdc,usdt',
			description: 'Comma-separated list of tokens to query',
			required: true,
		},
	] as INodeProperties[];
}

/**
 * Creates all token transfer fields (chain, token, amount).
 * Convenience function that combines all transfer-related token properties.
 *
 * @param operation - The operation this applies to
 * @param chainType - The blockchain type (default: 'solana')
 * @returns Array of INodeProperties for token transfers
 */
export function createTokenTransferFields(operation: string, chainType: string = 'solana'): INodeProperties[] {
	return [
		createTokenChainProperty('tknChain', operation, chainType),
		createTokenSymbolProperty('tknName', operation),
		createAmountProperty('amount', operation),
	];
}