export const API_ENDPOINTS = {
	PRODUCTION: 'https://www.crossmint.com/api',
	STAGING: 'https://staging.crossmint.com/api',
} as const;

export const API_VERSIONS = {
	WALLETS: '2025-06-09',
	ORDERS: '2022-06-09',
	COLLECTIONS: '2022-06-09',
} as const;

export const CHAIN_TYPES = {
	SOLANA: 'solana',
} as const;

export const VALIDATION_PATTERNS = {
	EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
	SOLANA_ADDRESS: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
	PHONE: /^\+?[\d\s\-()]+$/,
} as const;

export const PAGINATION = {
	DEFAULT_PER_PAGE: 50,
	MAX_ATTEMPTS: 60,
	POLL_INTERVAL: 5000,
} as const;
