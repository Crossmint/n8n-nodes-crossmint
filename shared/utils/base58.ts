/**
 * Custom Base58 encoding/decoding implementation
 * Uses the Bitcoin alphabet to maintain compatibility with Solana addresses
 * This eliminates the need for external bs58 dependency
 * Compatible with older JavaScript targets (no BigInt dependency)
 */

// Bitcoin Base58 alphabet (excludes 0, O, I, l to avoid confusion)
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BASE58_MAP = new Array(128).fill(-1);

// Build reverse lookup map for decoding
for (let i = 0; i < BASE58_ALPHABET.length; i++) {
	BASE58_MAP[BASE58_ALPHABET.charCodeAt(i)] = i;
}

/**
 * Encodes a Uint8Array to Base58 string using multi-precision arithmetic
 * @param buffer - The bytes to encode
 * @returns Base58 encoded string
 */
export function encode(buffer: Uint8Array): string {
	if (buffer.length === 0) return '';

	// Convert bytes to a big number represented as array of digits
	const digits = [0];
	for (let i = 0; i < buffer.length; i++) {
		let carry = buffer[i];
		for (let j = 0; j < digits.length; j++) {
			carry += digits[j] << 8;
			digits[j] = carry % 58;
			carry = Math.floor(carry / 58);
		}
		while (carry > 0) {
			digits.push(carry % 58);
			carry = Math.floor(carry / 58);
		}
	}

	// Convert digits to base58 string (skip leading zeros in digits)
	let result = '';
	for (let i = digits.length - 1; i >= 0; i--) {
		if (digits[i] === 0 && result === '') {
			// Skip leading zero digits
		} else {
			result += BASE58_ALPHABET[digits[i]];
		}
	}

	// Handle leading zeros in input (they become '1' in base58)
	let leadingZeros = 0;
	for (let i = 0; i < buffer.length && buffer[i] === 0; i++) {
		leadingZeros++;
	}

	// Add the correct number of '1's for leading zeros
	for (let i = 0; i < leadingZeros; i++) {
		result = '1' + result;
	}

	return result || '1'; // Return '1' for all-zero input
}

/**
 * Decodes a Base58 string to Uint8Array using multi-precision arithmetic
 * @param str - The Base58 string to decode
 * @returns Decoded bytes
 * @throws Error if invalid Base58 character is encountered
 */
export function decode(str: string): Uint8Array {
	if (str.length === 0) return new Uint8Array(0);

	// Count leading '1's (they represent leading zero bytes)
	let leadingZeros = 0;
	for (let i = 0; i < str.length && str[i] === '1'; i++) {
		leadingZeros++;
	}

	// Convert base58 string to big number represented as array of digits
	const digits = [0];
	for (let i = leadingZeros; i < str.length; i++) {
		const char = str.charCodeAt(i);
		const value = BASE58_MAP[char];
		if (value === -1) {
			throw new Error(`Invalid Base58 character: ${str[i]}`);
		}

		let carry = value;
		for (let j = 0; j < digits.length; j++) {
			carry += digits[j] * 58;
			digits[j] = carry & 0xff;
			carry >>= 8;
		}
		while (carry > 0) {
			digits.push(carry & 0xff);
			carry >>= 8;
		}
	}

	// Convert digits to bytes (reverse order, skip leading zeros)
	const bytes = [];
	for (let i = digits.length - 1; i >= 0; i--) {
		if (digits[i] !== 0 || bytes.length > 0) {
			bytes.push(digits[i]);
		}
	}

	// Add leading zero bytes for leading '1's in input
	for (let i = 0; i < leadingZeros; i++) {
		bytes.unshift(0);
	}

	return new Uint8Array(bytes.length > 0 ? bytes : [0]);
}

/**
 * Checks if a string is valid Base58
 * @param str - String to validate
 * @returns True if valid Base58
 */
export function isValid(str: string): boolean {
	try {
		decode(str);
		return true;
	} catch {
		return false;
	}
}

// Default export for compatibility
export default {
	encode,
	decode,
	isValid,
};