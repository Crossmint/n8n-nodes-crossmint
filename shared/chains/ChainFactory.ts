import { IChainProvider } from './IChainProvider';
import { SolanaProvider } from './solana/SolanaProvider';
import { EVMProvider } from './evm/EVMProvider';

/**
 * Chain Factory
 *
 * Factory for creating blockchain provider instances.
 * This is where new blockchain support is added.
 *
 * To add a new blockchain:
 * 1. Create a new provider class implementing IChainProvider
 * 2. Add a case in createProvider() method
 * 3. That's it! The new chain will automatically appear in all node properties
 */
export class ChainFactory {
	/**
	 * Creates a chain provider instance for the specified blockchain type
	 *
	 * @param chainType - The blockchain type (e.g., 'solana', 'evm', 'bitcoin')
	 * @returns The chain provider instance or undefined if not supported
	 */
	static createProvider(chainType: string): IChainProvider | undefined {
		switch (chainType.toLowerCase()) {
			case 'solana':
				return new SolanaProvider();
			case 'evm':
				return new EVMProvider();
			default:
				return undefined;
		}
	}

	/**
	 * Get all supported chain types
	 *
	 * @returns Array of supported chain type identifiers
	 */
	static getSupportedChainTypes(): string[] {
		return ['solana', 'evm'];
	}

	/**
	 * Get all available chain providers
	 *
	 * @returns Array of all chain provider instances
	 */
	static getAllProviders(): IChainProvider[] {
		return this.getSupportedChainTypes()
			.map(chainType => this.createProvider(chainType))
			.filter((provider): provider is IChainProvider => provider !== undefined);
	}

	/**
	 * Check if a chain type is supported
	 *
	 * @param chainType - The chain type to check
	 * @returns True if the chain is supported
	 */
	static isSupported(chainType: string): boolean {
		return this.getSupportedChainTypes().includes(chainType.toLowerCase());
	}

	/**
	 * Get chain options for n8n node properties
	 *
	 * @returns Array of options suitable for n8n node properties
	 */
	static getChainOptions(): Array<{ name: string; value: string; description: string }> {
		return this.getAllProviders().map(provider => ({
			name: provider.displayName,
			value: provider.chainType,
			description: `${provider.displayName} blockchain`,
		}));
	}

	/**
	 * Get network options for a specific chain
	 *
	 * @param chainType - The chain type
	 * @returns Array of network options or empty array if chain not found
	 */
	static getNetworkOptions(chainType: string): Array<{ name: string; value: string; description: string }> {
		const provider = this.createProvider(chainType);
		if (!provider) {
			return [];
		}

		return provider.getNetworks().map(network => ({
			name: network.name,
			value: network.id,
			description: network.isTestnet ? 'Testnet' : 'Mainnet',
		}));
	}

	/**
	 * Get the chainType from a network identifier
	 * e.g., "solana-devnet" -> "solana", "ethereum" -> "evm", "polygon" -> "evm"
	 *
	 * @param network - The network identifier (e.g., "solana", "solana-devnet", "ethereum")
	 * @returns The chainType or undefined if not found
	 */
	static getChainTypeFromNetwork(network: string): string | undefined {
		const normalizedNetwork = network.toLowerCase();

		for (const provider of this.getAllProviders()) {
			const networks = provider.getNetworks();
			if (networks.some(n => n.id.toLowerCase() === normalizedNetwork)) {
				return provider.chainType;
			}
		}

		// Fallback: check if network starts with a known chainType
		for (const chainType of this.getSupportedChainTypes()) {
			if (normalizedNetwork.startsWith(chainType)) {
				return chainType;
			}
		}

		return undefined;
	}

	/**
	 * Get testnet network options for a specific chain
	 *
	 * @param chainType - The chain type
	 * @returns Array of testnet network options
	 */
	static getTestnetNetworkOptions(chainType: string): Array<{ name: string; value: string; description: string }> {
		const provider = this.createProvider(chainType);
		if (!provider) {
			return [];
		}

		return provider.getNetworks()
			.filter(network => network.isTestnet)
			.map(network => ({
				name: network.name,
				value: network.id,
				description: 'Testnet',
			}));
	}

	/**
	 * Get mainnet network options for a specific chain
	 *
	 * @param chainType - The chain type
	 * @returns Array of mainnet network options
	 */
	static getMainnetNetworkOptions(chainType: string): Array<{ name: string; value: string; description: string }> {
		const provider = this.createProvider(chainType);
		if (!provider) {
			return [];
		}

		return provider.getNetworks()
			.filter(network => !network.isTestnet)
			.map(network => ({
				name: network.name,
				value: network.id,
				description: 'Mainnet',
			}));
	}

	// Convenience methods for specific chain + environment combinations

	/** Solana testnet networks (for staging credentials) */
	static getSolanaTestnetOptions(): Array<{ name: string; value: string; description: string }> {
		return this.getTestnetNetworkOptions('solana');
	}

	/** Solana mainnet networks (for production credentials) */
	static getSolanaMainnetOptions(): Array<{ name: string; value: string; description: string }> {
		return this.getMainnetNetworkOptions('solana');
	}

	/** EVM testnet networks (for staging credentials) */
	static getEvmTestnetOptions(): Array<{ name: string; value: string; description: string }> {
		return this.getTestnetNetworkOptions('evm');
	}

	/** EVM mainnet networks (for production credentials) */
	static getEvmMainnetOptions(): Array<{ name: string; value: string; description: string }> {
		return this.getMainnetNetworkOptions('evm');
	}
}
