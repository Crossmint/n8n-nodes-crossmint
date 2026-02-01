import { ChainNetwork } from '../IChainProvider';

export const EVM_NETWORKS: ChainNetwork[] = [
	// Ethereum
	{ id: 'ethereum', name: 'Ethereum Mainnet', isTestnet: false },
	{ id: 'ethereum-sepolia', name: 'Ethereum Sepolia', isTestnet: true },

	// Base
	{ id: 'base', name: 'Base Mainnet', isTestnet: false },
	{ id: 'base-sepolia', name: 'Base Sepolia', isTestnet: true },

	// Polygon
	{ id: 'polygon', name: 'Polygon Mainnet', isTestnet: false },
	{ id: 'polygon-amoy', name: 'Polygon Amoy', isTestnet: true },

	// Arbitrum
	{ id: 'arbitrum', name: 'Arbitrum One', isTestnet: false },
	{ id: 'arbitrum-sepolia', name: 'Arbitrum Sepolia', isTestnet: true },

	// Optimism
	{ id: 'optimism', name: 'Optimism Mainnet', isTestnet: false },
	{ id: 'optimism-sepolia', name: 'Optimism Sepolia', isTestnet: true },
];
