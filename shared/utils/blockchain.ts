import { NodeOperationError, INode } from 'n8n-workflow';
import { webcrypto } from 'node:crypto';
import * as base58 from './base58';
import { derivePublicKeyFromSecretKey, derivePublicKeyFromSeed } from './solana-key-derivation';
import { CHAIN_FAMILIES } from '../types/chains';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { getPublicKey } from '@noble/secp256k1';

export interface KeyPairResult {
	address?: string;
	publicKey: string;
	chainType: string;
	privateKey?: string; // Only for local storage, never sent to API
}

export async function deriveKeyPair(privateKeyStr: string, context: unknown, itemIndex: number): Promise<KeyPairResult> {
	const trimmedKey = privateKeyStr.trim();
	
	// Check if it's a P-256 private key (PKCS#8 base64 or JWK format)
	if (trimmedKey.startsWith('{') || trimmedKey.includes('"kty"')) {
		// JWK format for P-256
		return await deriveEvmP256KeyPairFromJWK(trimmedKey, context, itemIndex);
	} else if (trimmedKey.length > 100 && !trimmedKey.match(/^[0-9a-fA-F]+$/)) {
		// PKCS#8 base64 format for P-256
		return await deriveEvmP256KeyPairFromPKCS8(trimmedKey, context, itemIndex);
	}
	
	// Try to detect if it's a hex key (secp256k1 - legacy) or base58 key (Solana)
	const isHexKey = /^(0x)?[0-9a-fA-F]{64}$/.test(trimmedKey);
	
	if (isHexKey) {
		// Legacy: secp256k1 private key (not used for admin signer, but kept for compatibility)
		return deriveEvmSecp256k1KeyPair(trimmedKey, context, itemIndex);
	} else {
		// Solana private key (base58 format)
		return deriveSolanaKeyPair(trimmedKey, context, itemIndex);
	}
}

// Generate or import EVM P-256 keypair for admin signer
export async function generateOrImportEvmP256KeyPair(
	privateKeyInput: string | undefined,
	context: unknown,
	itemIndex: number
): Promise<KeyPairResult> {
	if (privateKeyInput && privateKeyInput.trim()) {
		// Import existing private key
		return await deriveKeyPair(privateKeyInput, context, itemIndex);
	} else {
		// Generate new P-256 keypair
		return await generateEvmP256KeyPair(context, itemIndex);
	}
}

// Generate a new P-256 (secp256r1) keypair using WebCrypto
async function generateEvmP256KeyPair(context: unknown, itemIndex: number): Promise<KeyPairResult> {
	try {
		const subtle = webcrypto.subtle;
		
		// Generate P-256 keypair
		const keyPair = await subtle.generateKey(
			{
				name: 'ECDSA',
				namedCurve: 'P-256',
			},
			true, // extractable
			['sign', 'verify']
		);
		
		// Export public key as raw uncompressed format (65 bytes: 0x04||X||Y)
		const publicKeyRaw = await subtle.exportKey('raw', keyPair.publicKey);
		const publicKeyBytes = new Uint8Array(publicKeyRaw);
		
		if (publicKeyBytes.length !== 65) {
			throw new NodeOperationError(
				(context as { getNode: () => INode }).getNode(),
				`Invalid P-256 public key length: ${publicKeyBytes.length} bytes, expected 65`,
				{ itemIndex }
			);
		}
		
		// Export private key as PKCS#8 for storage
		const privateKeyPKCS8 = await subtle.exportKey('pkcs8', keyPair.privateKey);
		const privateKeyBase64 = Buffer.from(privateKeyPKCS8).toString('base64');
		
		// Public key as base64
		const publicKeyBase64 = Buffer.from(publicKeyBytes).toString('base64');
		
		return {
			publicKey: publicKeyBase64,
			chainType: CHAIN_FAMILIES.EVM,
			privateKey: privateKeyBase64, // For user to store locally
		};
	} catch (error: unknown) {
		throw new NodeOperationError(
			(context as { getNode: () => INode }).getNode(),
			`Failed to generate P-256 keypair: ${(error as Error).message}`,
			{ itemIndex }
		);
	}
}

// Import P-256 keypair from PKCS#8 base64
async function deriveEvmP256KeyPairFromPKCS8(
	pkcs8Base64: string,
	context: unknown,
	itemIndex: number
): Promise<KeyPairResult> {
	try {
		const subtle = webcrypto.subtle;
		
		// Decode PKCS#8
		const pkcs8Buffer = Buffer.from(pkcs8Base64, 'base64');
		
		// Import private key
		const privateKey = await subtle.importKey(
			'pkcs8',
			pkcs8Buffer,
			{
				name: 'ECDSA',
				namedCurve: 'P-256',
			},
			true,
			['sign']
		);
		
		// Derive public key from private key
		const jwk = await subtle.exportKey('jwk', privateKey);
		const publicKey = await subtle.importKey(
			'jwk',
			{
				kty: jwk.kty,
				crv: jwk.crv,
				x: jwk.x,
				y: jwk.y,
			},
			{
				name: 'ECDSA',
				namedCurve: 'P-256',
			},
			true,
			['verify']
		);
		
		// Export public key as raw (65 bytes)
		const publicKeyRaw = await subtle.exportKey('raw', publicKey);
		const publicKeyBytes = new Uint8Array(publicKeyRaw);
		
		if (publicKeyBytes.length !== 65) {
			throw new NodeOperationError(
				(context as { getNode: () => INode }).getNode(),
				`Invalid P-256 public key length: ${publicKeyBytes.length} bytes, expected 65`,
				{ itemIndex }
			);
		}
		
		const publicKeyBase64 = Buffer.from(publicKeyBytes).toString('base64');
		
		return {
			publicKey: publicKeyBase64,
			chainType: CHAIN_FAMILIES.EVM,
			privateKey: pkcs8Base64, // Return for storage
		};
	} catch (error: unknown) {
		throw new NodeOperationError(
			(context as { getNode: () => INode }).getNode(),
			`Failed to import P-256 private key from PKCS#8: ${(error as Error).message}`,
			{ itemIndex }
		);
	}
}

// Import P-256 keypair from JWK
async function deriveEvmP256KeyPairFromJWK(
	jwkString: string,
	context: unknown,
	itemIndex: number
): Promise<KeyPairResult> {
	try {
		const subtle = webcrypto.subtle;
		const jwk = JSON.parse(jwkString);
		
		// Import private key
		const privateKey = await subtle.importKey(
			'jwk',
			jwk,
			{
				name: 'ECDSA',
				namedCurve: 'P-256',
			},
			true,
			['sign']
		);
		
		// Export as PKCS#8 for consistent storage
		const pkcs8Buffer = await subtle.exportKey('pkcs8', privateKey);
		const privateKeyBase64 = Buffer.from(pkcs8Buffer).toString('base64');
		
		// Derive public key
		const publicKey = await subtle.importKey(
			'jwk',
			{
				kty: jwk.kty,
				crv: jwk.crv,
				x: jwk.x,
				y: jwk.y,
			},
			{
				name: 'ECDSA',
				namedCurve: 'P-256',
			},
			true,
			['verify']
		);
		
		// Export public key as raw (65 bytes)
		const publicKeyRaw = await subtle.exportKey('raw', publicKey);
		const publicKeyBytes = new Uint8Array(publicKeyRaw);
		
		if (publicKeyBytes.length !== 65) {
			throw new NodeOperationError(
				(context as { getNode: () => INode }).getNode(),
				`Invalid P-256 public key length: ${publicKeyBytes.length} bytes, expected 65`,
				{ itemIndex }
			);
		}
		
		const publicKeyBase64 = Buffer.from(publicKeyBytes).toString('base64');
		
		return {
			publicKey: publicKeyBase64,
			chainType: CHAIN_FAMILIES.EVM,
			privateKey: privateKeyBase64,
		};
	} catch (error: unknown) {
		throw new NodeOperationError(
			(context as { getNode: () => INode }).getNode(),
			`Failed to import P-256 private key from JWK: ${(error as Error).message}`,
			{ itemIndex }
		);
	}
}

function deriveEvmSecp256k1KeyPair(privateKeyStr: string, context: unknown, itemIndex: number): KeyPairResult {
	try {
		// Remove 0x prefix if present
		const hexKey = privateKeyStr.startsWith('0x') ? privateKeyStr.slice(2) : privateKeyStr;
		
		// Validate hex format
		if (!/^[0-9a-fA-F]{64}$/.test(hexKey)) {
			throw new NodeOperationError((context as { getNode: () => INode }).getNode(), 'Invalid EVM private key: must be 64 hex characters (32 bytes)', {
				itemIndex,
			});
		}
		
		// Convert hex to bytes
		const privateKeyBytes = new Uint8Array(hexKey.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
		
		// Derive Ethereum address using keccak256
		const publicKey = deriveEvmPublicKey(privateKeyBytes);
		const address = deriveEvmAddress(publicKey);
		
		return {
			address,
			publicKey: '0x' + Buffer.from(publicKey).toString('hex'),
			chainType: CHAIN_FAMILIES.EVM,
		};
	} catch (error: unknown) {
		throw new NodeOperationError((context as { getNode: () => INode }).getNode(), `Failed to process EVM private key: ${(error as Error).message}`, {
			itemIndex,
		});
	}
}

function deriveSolanaKeyPair(privateKeyStr: string, context: unknown, itemIndex: number): KeyPairResult {
	try {
		const decoded = base58.decode(privateKeyStr);
		if (decoded.length !== 64 && decoded.length !== 32) {
			throw new NodeOperationError((context as { getNode: () => INode }).getNode(), 'Invalid Solana private key length');
		}
	} catch {
		throw new NodeOperationError((context as { getNode: () => INode }).getNode(), 'Invalid private key format. Use base58 for Solana or hex for EVM', {
			itemIndex,
		});
	}

	try {
		const secretKeyBytes = base58.decode(privateKeyStr);

		let keyPair;
		if (secretKeyBytes.length === 32) {
			// 32-byte seed - use derivePublicKeyFromSeed
			keyPair = derivePublicKeyFromSeed(secretKeyBytes);
		} else if (secretKeyBytes.length === 64) {
			// 64-byte secret key - use derivePublicKeyFromSecretKey
			keyPair = derivePublicKeyFromSecretKey(secretKeyBytes);
		} else {
			throw new NodeOperationError((context as { getNode: () => INode }).getNode(), `Invalid Solana private key: decoded to ${secretKeyBytes.length} bytes, expected 32 or 64`);
		}

		const address = base58.encode(keyPair.publicKey);

		return {
			address,
			publicKey: address,
			chainType: CHAIN_FAMILIES.SOLANA,
		};
	} catch (error: unknown) {
		throw new NodeOperationError((context as { getNode: () => INode }).getNode(), `Failed to process Solana private key: ${(error as Error).message}`, {
			itemIndex,
		});
	}
}

// Derive EVM public key from private key using secp256k1
function deriveEvmPublicKey(privateKey: Uint8Array): Uint8Array {
	// Get uncompressed public key (65 bytes: 0x04 + 64 bytes)
	const publicKey = getPublicKey(privateKey, false);
	// Remove the 0x04 prefix (uncompressed public key marker)
	return publicKey.slice(1);
}

// Derive EVM address from public key using keccak256
function deriveEvmAddress(publicKey: Uint8Array): string {
	// Keccak256 hash of the public key (64 bytes)
	const hash = keccak_256(publicKey);
	// Take last 20 bytes and add 0x prefix
	const address = '0x' + Buffer.from(hash.slice(-20)).toString('hex');
	return address;
}

// Helper: build PKCS#8 DER for Ed25519 from a 32-byte seed.
// RFC 8410 specifies Ed25519 OID 1.3.101.112 and PKCS#8 layout.
// DER = 0x302e020100300506032b657004220420 || seed(32)
function ed25519Pkcs8FromSeed(seed32: Uint8Array): ArrayBuffer {
	const prefix = Uint8Array.from([
		0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70,
		0x04, 0x22, 0x04, 0x20
	]);
	const der = new Uint8Array(prefix.length + seed32.length);
	der.set(prefix, 0);
	der.set(seed32, prefix.length);
	return der.buffer;
}

export async function signMessage(
	message: string,
	privateKey: string,   // base58, 64 bytes when decoded (seed || pub)
	context: unknown,
	itemIndex: number
): Promise<string> {
	try {
		// 1) Decode Solana secret key (NaCl layout: [32-byte seed || 32-byte public])
		const secretKeyBytes = base58.decode(privateKey);
		if (secretKeyBytes.length !== 64) {
			throw new NodeOperationError(
				(context as { getNode: () => INode }).getNode(),
				'Invalid Solana private key: must decode to 64 bytes'
			);
		}
		const seed32 = secretKeyBytes.subarray(0, 32); // first 32 bytes are the seed

		// 2) Prepare the message bytes (accept base58 or plain text)
		let messageBytes: Uint8Array;
		try {
			messageBytes = base58.decode(message);
		} catch {
			messageBytes = new TextEncoder().encode(message);
		}

		// 3) Import Ed25519 private key via PKCS#8, then sign with SubtleCrypto
		const subtle = webcrypto.subtle;
		const pkcs8 = ed25519Pkcs8FromSeed(seed32); // per RFC 8410 PKCS#8 for Ed25519
		const privateCryptoKey = await subtle.importKey(
			'pkcs8',
			pkcs8,
			{ name: 'Ed25519' },
			false,
			['sign']
		);

		const sigBuf = await subtle.sign({ name: 'Ed25519' }, privateCryptoKey, messageBytes);
		const signature = new Uint8Array(sigBuf); // Signature is 64 bytes (Ed25519)

		return base58.encode(signature);
	} catch (error: unknown) {
		// Helpful hint if the runtime lacks Ed25519 support
		if (String((error as { message?: string })?.message || '').toLowerCase().includes('algorithm') ||
			String((error as { name?: string })?.name || '').includes('NotSupportedError')) {
			throw new NodeOperationError(
				(context as { getNode: () => INode }).getNode(),
				'Ed25519 Web Crypto is not supported in this runtime. Try a newer Node version (Web Crypto) or enable a runtime that supports Ed25519 in SubtleCrypto.',
				{ itemIndex }
			);
		}
		throw new NodeOperationError(
			(context as { getNode: () => INode }).getNode(),
			`Failed to sign message: ${(error as Error).message}`,
			{ itemIndex }
		);
	}
}
