import { IChainProvider } from './IChainProvider';
import { SolanaProvider } from './solana/SolanaProvider';

/**
 * Chain Registry
 *
 * Central registry for all supported blockchain providers.
 * This is where new blockchain support is added.
 */
export class ChainRegistry {
	private static providers: Map<string, IChainProvider> = new Map();

	/**
	 * Initialize the registry with all supported chains
	 */
	static initialize(): void {
		// Register Solana
		this.register(new SolanaProvider());

		// Future chains can be added here:
		// this.register(new EVMProvider());
	}

	/**
	 * Register a chain provider
	 * @param provider - The chain provider to register
	 */
	static register(provider: IChainProvider): void {
		this.providers.set(provider.chainType, provider);
	}

	/**
	 * Get a chain provider by chain type
	 * @param chainType - The chain type (e.g., 'solana', 'evm', 'bitcoin')
	 * @returns The chain provider or undefined if not found
	 */
	static getProvider(chainType: string): IChainProvider | undefined {
		if (this.providers.size === 0) {
			this.initialize();
		}
		return this.providers.get(chainType);
	}

	/**
	 * Get all registered chain providers
	 * @returns Array of all registered providers
	 */
	static getAllProviders(): IChainProvider[] {
		if (this.providers.size === 0) {
			this.initialize();
		}
		return Array.from(this.providers.values());
	}

	/**
	 * Get all available chain types
	 * @returns Array of chain type identifiers
	 */
	static getChainTypes(): string[] {
		if (this.providers.size === 0) {
			this.initialize();
		}
		return Array.from(this.providers.keys());
	}

	/**
	 * Check if a chain type is supported
	 * @param chainType - The chain type to check
	 * @returns True if the chain is supported
	 */
	static isSupported(chainType: string): boolean {
		if (this.providers.size === 0) {
			this.initialize();
		}
		return this.providers.has(chainType);
	}

	/**
	 * Get chain options for n8n node properties
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
	 * @param chainType - The chain type
	 * @returns Array of network options or empty array if chain not found
	 */
	static getNetworkOptions(chainType: string): Array<{ name: string; value: string; description: string }> {
		const provider = this.getProvider(chainType);
		if (!provider) {
			return [];
		}

		return provider.getNetworks().map(network => ({
			name: network.name,
			value: network.id,
			description: network.isTestnet ? 'Testnet' : 'Mainnet',
		}));
	}
}

// Initialize on module load
ChainRegistry.initialize();