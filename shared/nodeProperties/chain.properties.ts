import { INodeProperties } from 'n8n-workflow';
import { ChainRegistry } from '../chains/ChainRegistry';

/**
 * Creates a blockchain type selector property.
 * Dynamically populated from ChainRegistry.
 *
 * @param name - The parameter name
 * @param operations - Array of operations this applies to
 * @param description - Optional custom description
 * @param required - Whether this field is required (default: true)
 * @returns INodeProperties configuration for blockchain type selection
 */
export function createBlockchainTypeProperty(
	name: string,
	operations: string[],
	description: string = 'Blockchain type',
	required: boolean = true,
): INodeProperties {
	const options = ChainRegistry.getChainOptions();

	return {
		displayName: 'Blockchain Type',
		name,
		type: 'options',
		displayOptions: { show: { resource: ['wallet'], operation: operations } },
		options,
		default: options.length > 0 ? options[0].value : 'solana',
		description,
		required,
	} as INodeProperties;
}

/**
 * Creates a chain/network selector property for a specific blockchain.
 * This allows users to select mainnet vs testnet/devnet.
 *
 * @param name - The parameter name
 * @param operations - Array of operations this applies to
 * @param chainType - The blockchain type (e.g., 'solana', 'evm')
 * @param description - Optional custom description
 * @param required - Whether this field is required (default: true)
 * @returns INodeProperties configuration for chain/network selection
 */
export function createChainNetworkProperty(
	name: string,
	operations: string[],
	chainType: string = 'solana',
	description: string = 'Blockchain network',
	required: boolean = true,
): INodeProperties {
	const provider = ChainRegistry.getProvider(chainType);

	if (!provider) {
		// Fallback to string input if provider not found
		return {
			displayName: 'Chain',
			name,
			type: 'string',
			displayOptions: { show: { resource: ['wallet'], operation: operations } },
			default: '',
			placeholder: 'solana or solana-devnet',
			description,
			required,
		} as INodeProperties;
	}

	const networks = provider.getNetworks();

	// If provider has defined networks, use options selector
	if (networks.length > 0) {
		return {
			displayName: 'Network',
			name,
			type: 'options',
			displayOptions: { show: { resource: ['wallet'], operation: operations } },
			options: networks.map(network => ({
				name: network.name,
				value: network.id,
				description: network.isTestnet ? 'Testnet' : 'Mainnet',
			})),
			default: networks[0].id,
			description,
			required,
		} as INodeProperties;
	}

	// Fallback to string input
	return {
		displayName: 'Chain',
		name,
		type: 'string',
		displayOptions: { show: { resource: ['wallet'], operation: operations } },
		default: networks.length > 0 ? networks[0].id : '',
		placeholder: 'Enter network identifier',
		description,
		required,
	} as INodeProperties;
}
