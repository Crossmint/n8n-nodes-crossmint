export const CHAIN_FAMILIES = {
	SOLANA: 'solana',
	EVM: 'evm',
} as const;

export type ChainFamily = (typeof CHAIN_FAMILIES)[keyof typeof CHAIN_FAMILIES];

export const CHAIN_ENVIRONMENTS = {
	MAINNET: 'mainnet',
	TESTNET: 'testnet',
} as const;

export type ChainEnvironment = (typeof CHAIN_ENVIRONMENTS)[keyof typeof CHAIN_ENVIRONMENTS];

export interface ChainDefinition {
	id: string;
	label: string;
	family: ChainFamily;
	environment: ChainEnvironment;
	description?: string;
	aliases?: readonly string[];
	isDefault?: boolean;
}

export const SOLANA_CHAIN_IDS = {
	MAINNET: 'solana',
	DEVNET: 'solana-devnet',
} as const;

export type SolanaChainId = (typeof SOLANA_CHAIN_IDS)[keyof typeof SOLANA_CHAIN_IDS];

export const SOLANA_CHAINS: readonly ChainDefinition[] = [
	{
		id: SOLANA_CHAIN_IDS.MAINNET,
		label: 'Solana',
		family: CHAIN_FAMILIES.SOLANA,
		environment: CHAIN_ENVIRONMENTS.MAINNET,
		description: 'Solana mainnet',
		aliases: ['sol'],
		isDefault: true,
	},
	{
		id: SOLANA_CHAIN_IDS.DEVNET,
		label: 'Solana Devnet',
		family: CHAIN_FAMILIES.SOLANA,
		environment: CHAIN_ENVIRONMENTS.TESTNET,
		description: 'Solana development network',
		aliases: ['sol-devnet'],
	},
] as const;

export const EVM_CHAIN_IDS = {
	POLYGON: 'polygon',
	POLYGON_AMOY: 'polygon-amoy',
	BASE: 'base',
	BASE_SEPOLIA: 'base-sepolia',
} as const;

export type EvmChainId = (typeof EVM_CHAIN_IDS)[keyof typeof EVM_CHAIN_IDS];

export const EVM_CHAINS: readonly ChainDefinition[] = [
	{
		id: EVM_CHAIN_IDS.POLYGON,
		label: 'Polygon',
		family: CHAIN_FAMILIES.EVM,
		environment: CHAIN_ENVIRONMENTS.MAINNET,
		description: 'Polygon (PoS) mainnet',
		aliases: ['polygon-mainnet', 'matic'],
	},
	{
		id: EVM_CHAIN_IDS.POLYGON_AMOY,
		label: 'Polygon Amoy',
		family: CHAIN_FAMILIES.EVM,
		environment: CHAIN_ENVIRONMENTS.TESTNET,
		description: 'Polygon Amoy test network',
		aliases: ['polygon-amoy-testnet', 'amoy'],
	},
	{
		id: EVM_CHAIN_IDS.BASE,
		label: 'Base',
		family: CHAIN_FAMILIES.EVM,
		environment: CHAIN_ENVIRONMENTS.MAINNET,
		description: 'Base mainnet',
		aliases: ['base-mainnet'],
	},
	{
		id: EVM_CHAIN_IDS.BASE_SEPOLIA,
		label: 'Base Sepolia',
		family: CHAIN_FAMILIES.EVM,
		environment: CHAIN_ENVIRONMENTS.TESTNET,
		description: 'Base Sepolia test network',
		aliases: ['base-sepolia-testnet'],
	},
] as const;

export const ALL_CHAINS: readonly ChainDefinition[] = [...SOLANA_CHAINS, ...EVM_CHAINS];

export type ChainId = SolanaChainId | EvmChainId;

export function getChainsByFamily(family: ChainFamily): ChainDefinition[] {
	return ALL_CHAINS.filter((chain) => chain.family === family);
}

export interface ChainOption {
	name: string;
	value: ChainId;
	description: string;
}

export function toChainOptions(chains: readonly ChainDefinition[]): ChainOption[] {
	return chains.map((chain) => ({
		name: chain.environment === CHAIN_ENVIRONMENTS.TESTNET ? `${chain.label} (Testnet)` : chain.label,
		value: chain.id as ChainId,
		description: chain.description ?? `${chain.label} ${chain.environment === CHAIN_ENVIRONMENTS.MAINNET ? 'mainnet' : 'testnet'}`,
	}));
}

export function getChainOptionsByFamily(family: ChainFamily): ChainOption[] {
	return toChainOptions(getChainsByFamily(family));
}

export interface ChainFamilyOption {
	name: string;
	value: ChainFamily;
	description: string;
}

export function getChainFamilyOptions(): ChainFamilyOption[] {
	return [
		{
			name: 'Solana',
			value: CHAIN_FAMILIES.SOLANA,
			description: 'Solana program runtime wallets',
		},
		{
			name: 'EVM',
			value: CHAIN_FAMILIES.EVM,
			description: 'EVM-compatible blockchains (Ethereum, Polygon, Base, etc.)',
		},
	];
}

export function findChainById(chainId: string): ChainDefinition | undefined {
	return ALL_CHAINS.find((chain) => chain.id === chainId || chain.aliases?.includes(chainId));
}

export const DEFAULT_SOLANA_CHAIN_ID: SolanaChainId = SOLANA_CHAIN_IDS.MAINNET;
export const DEFAULT_EVM_CHAIN_ID: EvmChainId = EVM_CHAIN_IDS.POLYGON;

export function getAllChainOptions(): ChainOption[] {
	return toChainOptions(ALL_CHAINS);
}

export function getMainnetChainOptions(): ChainOption[] {
	return toChainOptions(ALL_CHAINS.filter((chain) => chain.environment === CHAIN_ENVIRONMENTS.MAINNET));
}

export function getTestnetChainOptions(): ChainOption[] {
	return toChainOptions(ALL_CHAINS.filter((chain) => chain.environment === CHAIN_ENVIRONMENTS.TESTNET));
}

export function getChainOptionsForEnvironment(environment: 'production' | 'staging'): ChainOption[] {
	if (environment === 'production') {
		return getMainnetChainOptions();
	}
	return getAllChainOptions();
}

// Currency support mapping
export interface CurrencyOption {
	name: string;
	value: string;
	description: string;
	supportedChains?: ChainId[];
}

export const CURRENCY_OPTIONS: CurrencyOption[] = [
	{
		name: 'USDC',
		value: 'usdc',
		description: 'USD Coin (supported on all chains)',
	},
	{
		name: 'SOL',
		value: 'sol',
		description: 'Solana native token',
		supportedChains: [SOLANA_CHAIN_IDS.MAINNET, SOLANA_CHAIN_IDS.DEVNET],
	},
	{
		name: 'MATIC',
		value: 'matic',
		description: 'Polygon native token',
		supportedChains: [EVM_CHAIN_IDS.POLYGON, EVM_CHAIN_IDS.POLYGON_AMOY],
	},
	{
		name: 'ETH',
		value: 'eth',
		description: 'Ethereum native token',
		supportedChains: [EVM_CHAIN_IDS.BASE, EVM_CHAIN_IDS.BASE_SEPOLIA],
	},
];

export function getCurrencyOptions(): CurrencyOption[] {
	return CURRENCY_OPTIONS;
}
