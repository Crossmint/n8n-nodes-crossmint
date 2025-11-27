import { isValid as isValidBase58 } from '../../base58';
import { VALIDATION_PATTERNS } from '../../constants';

const CHAINALYSIS_API_BASE = 'https://public.chainalysis.com/api/v1/address';

export async function isSolanaAddressSanctioned(
	address: string,
	apiKey?: string,
): Promise<boolean> {
	console.log('[sanctionChecks] MOCK MODE: Checking address:', address);
	
	// Validate it's a Solana address format (base58, 32-44 characters)
	if (!address || typeof address !== 'string') {
		console.log('[sanctionChecks] ❌ Invalid address: not a string');
		throw new Error('Invalid address: address must be a non-empty string');
	}

	// Check if it matches Solana address pattern (base58, 32-44 chars)
	if (!VALIDATION_PATTERNS.SOLANA_ADDRESS.test(address)) {
		console.log('[sanctionChecks] ❌ Invalid Solana address format');
		throw new Error(`Invalid Solana address format: ${address}. Expected base58 string with 32-44 characters.`);
	}

	// Validate it's valid base58
	if (!isValidBase58(address)) {
		console.log('[sanctionChecks] ❌ Invalid base58 encoding');
		throw new Error(`Invalid Solana address: ${address} is not valid base58.`);
	}

	console.log('[sanctionChecks] ✅ Address format valid');
	console.log('[sanctionChecks] 🚫 MOCK MODE: Skipping Chainalysis API call, returning false (not sanctioned)');

	// MOCK: Always return false (not sanctioned) for testing
	return false; // true = sanctioned, false = not sanctioned
}

