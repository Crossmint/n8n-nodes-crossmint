import { ethers, Wallet, getAddress, isAddress } from 'ethers';
import {
	BaseChainProvider,
	ChainNetwork,
	TransactionData,
	SignatureResult,
	ValidationResult,
} from '../IChainProvider';
import { EVM_NETWORKS } from './EVMNetworks';

export class EVMProvider extends BaseChainProvider {
	readonly chainType = 'evm';
	readonly displayName = 'EVM';

	private networks: ChainNetwork[] = EVM_NETWORKS;

	getNetworks(): ChainNetwork[] {
		return this.networks;
	}

	getNetwork(networkId: string): ChainNetwork | undefined {
		return this.networks.find((n) => n.id === networkId);
	}

	validateAddress(address: string): ValidationResult {
		const regex = new RegExp(this.getAddressValidationRegex());
		if (!regex.test(address)) {
			return this.createValidationResult(false, 'Invalid EVM address format');
		}

		if (!isAddress(address)) {
			return this.createValidationResult(false, 'Invalid EVM address');
		}

		return this.createValidationResult(true);
	}

	validatePrivateKey(privateKey: string): ValidationResult {
		try {
			const normalizedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;

			if (normalizedKey.length !== 66) {
				return this.createValidationResult(
					false,
					'EVM private key must be 32 bytes (64 hex characters)',
				);
			}

			if (!/^0x[0-9a-fA-F]{64}$/.test(normalizedKey)) {
				return this.createValidationResult(false, 'EVM private key must be valid hexadecimal');
			}

			new Wallet(normalizedKey);
			return this.createValidationResult(true);
		} catch (error) {
			return this.createValidationResult(
				false,
				`Invalid EVM private key: ${(error as Error).message}`,
			);
		}
	}

	formatAddress(address: string): string {
		try {
			return getAddress(address);
		} catch {
			return address.toLowerCase();
		}
	}

	getAddressFromPrivateKey(privateKey: string): string {
		const validation = this.validatePrivateKey(privateKey);
		if (!validation.valid) {
			throw new Error(validation.error || 'Invalid private key');
		}

		const normalizedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
		const wallet = new Wallet(normalizedKey);
		return wallet.address;
	}

	async signTransaction(data: TransactionData, privateKey: string): Promise<SignatureResult> {
		const validation = this.validatePrivateKey(privateKey);
		if (!validation.valid) {
			throw new Error(validation.error || 'Invalid private key');
		}

		try {
			const normalizedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
			const wallet = new Wallet(normalizedKey);

			let messageBytes: Uint8Array;

			if (data.message.startsWith('0x')) {
				messageBytes = ethers.getBytes(data.message);
			} else {
				messageBytes = ethers.toUtf8Bytes(data.message);
			}

			const signature = await wallet.signMessage(messageBytes);

			return {
				signature,
				signerAddress: wallet.address,
				metadata: {
					chainType: this.chainType,
					transactionId: data.transactionId,
				},
			};
		} catch (error) {
			throw new Error(`Failed to sign EVM transaction: ${(error as Error).message}`);
		}
	}

	getAddressValidationRegex(): string {
		return '^0x[0-9a-fA-F]{40}$';
	}

	getAddressValidationError(): string {
		return 'Please enter a valid EVM wallet address (0x followed by 40 hex characters)';
	}

	getExampleAddress(): string {
		return '0x742d35Cc6634C0532925a3b844Bc9e7595f4E120';
	}
}
