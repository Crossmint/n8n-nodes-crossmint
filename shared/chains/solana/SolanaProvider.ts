import { BaseChainProvider, ChainNetwork, TransactionData, SignatureResult, ValidationResult } from '../IChainProvider';
import * as base58 from '../../utils/base58';
import { signMessage } from '../../utils/blockchain';
import { derivePublicKeyFromSeed } from '../../utils/solana-key-derivation';

/**
 * Solana Blockchain Provider
 *
 * Implements blockchain-specific functionality for Solana.
 */
export class SolanaProvider extends BaseChainProvider {
	readonly chainType = 'solana';
	readonly displayName = 'Solana';

	private networks: ChainNetwork[] = [
		{
			id: 'solana',
			name: 'Solana Mainnet',
			isTestnet: false,
			rpcEndpoint: 'https://api.mainnet-beta.solana.com',
		},
		{
			id: 'solana-devnet',
			name: 'Solana Devnet',
			isTestnet: true,
			rpcEndpoint: 'https://api.devnet.solana.com',
		},
	];

	getNetworks(): ChainNetwork[] {
		return this.networks;
	}

	getNetwork(networkId: string): ChainNetwork | undefined {
		return this.networks.find(n => n.id === networkId);
	}

	validateAddress(address: string): ValidationResult {
		// Solana addresses are base58 encoded and typically 32-44 characters
		const regex = new RegExp(this.getAddressValidationRegex());

		if (!regex.test(address)) {
			return this.createValidationResult(false, 'Invalid Solana address format');
		}

		try {
			// Additional validation: try to decode as base58
			const decoded = base58.decode(address);
			if (decoded.length !== 32) {
				return this.createValidationResult(false, 'Solana address must decode to 32 bytes');
			}
			return this.createValidationResult(true);
		} catch {
			return this.createValidationResult(false, 'Invalid base58 encoding');
		}
	}

	validatePrivateKey(privateKey: string): ValidationResult {
		try {
			const decoded = base58.decode(privateKey);

			// Solana private keys can be 32 bytes (seed) or 64 bytes (full keypair)
			if (decoded.length !== 32 && decoded.length !== 64) {
				return this.createValidationResult(
					false,
					'Solana private key must be 32 or 64 bytes when base58 decoded'
				);
			}

			return this.createValidationResult(true);
		} catch {
			return this.createValidationResult(false, 'Invalid base58 encoded private key');
		}
	}

	formatAddress(address: string): string {
		// Solana addresses are case-sensitive, return as-is
		return address;
	}

	getAddressFromPrivateKey(privateKey: string): string {
		const validation = this.validatePrivateKey(privateKey);
		if (!validation.valid) {
			throw new Error(validation.error || 'Invalid private key');
		}

		// Use existing blockchain utility
		// Note: We'll need to refactor this to not depend on n8n context
		// For now, we'll decode and derive manually
		const secretKeyBytes = base58.decode(privateKey);

		let publicKeyBytes: Uint8Array;

		if (secretKeyBytes.length === 64) {
			// Full keypair: public key is the last 32 bytes
			publicKeyBytes = secretKeyBytes.subarray(32, 64);
		} else if (secretKeyBytes.length === 32) {
			// 32-byte seed: derive public key using Ed25519
			const keyPair = derivePublicKeyFromSeed(secretKeyBytes);
			publicKeyBytes = keyPair.publicKey;
		} else {
			throw new Error('Invalid private key length');
		}

		return base58.encode(publicKeyBytes);
	}

	async signTransaction(data: TransactionData, privateKey: string): Promise<SignatureResult> {
		const validation = this.validatePrivateKey(privateKey);
		if (!validation.valid) {
			throw new Error(validation.error || 'Invalid private key');
		}

		// Create a mock context for the existing signMessage function
		// TODO: Refactor signMessage to not require n8n context
		const mockContext = {
			getNode: () => ({ name: 'SolanaProvider' }),
		};

		try {
			const signature = await signMessage(data.message, privateKey, mockContext, 0);
			const signerAddress = this.getAddressFromPrivateKey(privateKey);

			return {
				signature,
				signerAddress,
				metadata: {
					chainType: this.chainType,
					transactionId: data.transactionId,
				},
			};
		} catch (error) {
			throw new Error(`Failed to sign Solana transaction: ${(error as Error).message}`);
		}
	}

	getAddressValidationRegex(): string {
		return '^[1-9A-HJ-NP-Za-km-z]{32,44}$';
	}

	getAddressValidationError(): string {
		return 'Please enter a valid Solana wallet address';
	}

	getExampleAddress(): string {
		return '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
	}
}
