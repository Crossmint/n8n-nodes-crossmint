import { NodeOperationError } from 'n8n-workflow';
import { ethers } from 'ethers';
import { Keypair } from '@solana/web3.js';
import * as bs58 from 'bs58';

export interface KeyPairResult {
	address: string;
	publicKey: string;
	chainType: string;
}

export function deriveKeyPair(privateKeyStr: string, context: any, itemIndex: number): KeyPairResult {
	let signerChainType: string;

	if (privateKeyStr.startsWith('0x') || (privateKeyStr.length === 64 && /^[a-fA-F0-9]+$/.test(privateKeyStr))) {
		signerChainType = 'evm';
	} else {
		try {
			const decoded = bs58.decode(privateKeyStr);
			if (decoded.length === 64 || decoded.length === 32) {
				signerChainType = 'solana';
			} else {
				throw new NodeOperationError(context.getNode(), 'Invalid key length');
			}
		} catch {
			throw new NodeOperationError(context.getNode(), 'Invalid private key format. Use 32-byte hex for EVM or base58 for Solana', {
				itemIndex,
			});
		}
	}

	try {
		if (signerChainType === 'evm') {
			let privateKeyBuffer: Buffer;
			if (privateKeyStr.startsWith('0x')) {
				privateKeyBuffer = Buffer.from(privateKeyStr.slice(2), 'hex');
			} else {
				privateKeyBuffer = Buffer.from(privateKeyStr, 'hex');
			}

			if (privateKeyBuffer.length !== 32) {
				throw new NodeOperationError(context.getNode(), 'EVM private key must be 32 bytes');
			}

			const normalizedPrivateKey = privateKeyStr.startsWith('0x') ? privateKeyStr : '0x' + privateKeyStr;
			const wallet = new ethers.Wallet(normalizedPrivateKey);
			
			return {
				address: wallet.address,
				publicKey: wallet.signingKey.publicKey,
				chainType: signerChainType,
			};

		} else if (signerChainType === 'solana') {
			const secretKeyBytes = bs58.decode(privateKeyStr);

			let fullSecretKey: Uint8Array;
			if (secretKeyBytes.length === 32) {
				fullSecretKey = new Uint8Array(64);
				fullSecretKey.set(secretKeyBytes);
				fullSecretKey.set(secretKeyBytes, 32);
			} else if (secretKeyBytes.length === 64) {
				fullSecretKey = secretKeyBytes;
			} else {
				throw new NodeOperationError(context.getNode(), `Invalid Solana private key: decoded to ${secretKeyBytes.length} bytes, expected 32 or 64`);
			}

			const keypair = Keypair.fromSecretKey(fullSecretKey);
			const address = keypair.publicKey.toBase58();
			
			return {
				address,
				publicKey: address,
				chainType: signerChainType,
			};
		} else {
			throw new NodeOperationError(context.getNode(), `Unsupported chain type: ${signerChainType}`, {
				itemIndex,
			});
		}
	} catch (error: any) {
		throw new NodeOperationError(context.getNode(), `Failed to process private key: ${error.message}`, {
			itemIndex,
		});
	}
}

export async function signMessage(
	message: string,
	privateKey: string,
	chainType: string,
	context: any,
	itemIndex: number
): Promise<string> {
	try {
		if (chainType === 'evm') {
			const normalizedPrivateKey = privateKey.startsWith('0x') ? privateKey : '0x' + privateKey;
			const wallet = new ethers.Wallet(normalizedPrivateKey);
			const messageBytes = ethers.getBytes(message);
			return await wallet.signMessage(messageBytes);

		} else if (chainType === 'solana') {
			const secretKeyBytes = bs58.decode(privateKey);
			if (secretKeyBytes.length !== 64) {
				throw new NodeOperationError(context.getNode(), 'Invalid Solana private key: must decode to 64 bytes');
			}

			let messageBytes: Uint8Array;
			try {
				messageBytes = bs58.decode(message);
			} catch {
				messageBytes = new TextEncoder().encode(message);
			}

			const nacl = await import('tweetnacl');
			const signatureBytes = nacl.sign.detached(messageBytes, secretKeyBytes);
			return bs58.encode(signatureBytes);
		} else {
			throw new NodeOperationError(context.getNode(), `Unsupported chain type: ${chainType}`, {
				itemIndex,
			});
		}
	} catch (error: any) {
		throw new NodeOperationError(context.getNode(), `Failed to sign message: ${error.message}`, {
			itemIndex,
		});
	}
}
