import { NodeOperationError, INode } from 'n8n-workflow';
import { webcrypto } from 'node:crypto';
import * as base58 from './base58';
import { derivePublicKeyFromSecretKey, derivePublicKeyFromSeed } from './solana-key-derivation';

export interface KeyPairResult {
	address: string;
	publicKey: string;
	chainType: string;
}

export function deriveKeyPair(privateKeyStr: string, context: unknown, itemIndex: number): KeyPairResult {
	try {
		const decoded = base58.decode(privateKeyStr);
		if (decoded.length !== 64 && decoded.length !== 32) {
			throw new NodeOperationError((context as { getNode: () => INode }).getNode(), 'Invalid Solana private key length');
		}
	} catch {
		throw new NodeOperationError((context as { getNode: () => INode }).getNode(), 'Invalid private key format. Use base58 for Solana', {
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
			chainType: 'solana',
		};
	} catch (error: unknown) {
		throw new NodeOperationError((context as { getNode: () => INode }).getNode(), `Failed to process private key: ${(error as Error).message}`, {
			itemIndex,
		});
	}
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
