/**
 * Blockchain Provider Interface
 *
 * This interface defines the contract for all blockchain implementations.
 * Each blockchain (Solana, EVM, Bitcoin, etc.) must implement this interface
 * to provide chain-specific functionality.
 */

/**
 * Network configuration for a blockchain
 */
export interface ChainNetwork {
	/** Network identifier (e.g., 'solana', 'solana-devnet', 'ethereum', 'base') */
	id: string;
	/** Display name for the network */
	name: string;
	/** Whether this is a testnet/devnet */
	isTestnet: boolean;
	/** Optional RPC endpoint */
	rpcEndpoint?: string;
}

/**
 * Transaction data structure for signing
 */
export interface TransactionData {
	/** The message/hash to sign */
	message: string;
	/** Optional transaction ID from the API */
	transactionId?: string;
	/** Additional chain-specific data */
	metadata?: Record<string, unknown>;
}

/**
 * Signature result from transaction signing
 */
export interface SignatureResult {
	/** The signature as a string */
	signature: string;
	/** The signer's address */
	signerAddress: string;
	/** Additional metadata about the signature */
	metadata?: Record<string, unknown>;
}

/**
 * Validation result
 */
export interface ValidationResult {
	valid: boolean;
	error?: string;
}

/**
 * Chain Provider Interface
 *
 * Implement this interface to add support for a new blockchain.
 */
export interface IChainProvider {
	/**
	 * Unique identifier for this chain type (e.g., 'solana', 'evm', 'bitcoin')
	 */
	readonly chainType: string;

	/**
	 * Display name for the chain (e.g., 'Solana', 'Ethereum Virtual Machine')
	 */
	readonly displayName: string;

	/**
	 * Get all available networks for this chain
	 * @returns Array of available networks
	 */
	getNetworks(): ChainNetwork[];

	/**
	 * Get a specific network by its ID
	 * @param networkId - The network identifier
	 * @returns Network configuration or undefined if not found
	 */
	getNetwork(networkId: string): ChainNetwork | undefined;

	/**
	 * Validate a wallet address for this chain
	 * @param address - The wallet address to validate
	 * @returns Validation result with optional error message
	 */
	validateAddress(address: string): ValidationResult;

	/**
	 * Validate a private key for this chain
	 * @param privateKey - The private key to validate
	 * @returns Validation result with optional error message
	 */
	validatePrivateKey(privateKey: string): ValidationResult;

	/**
	 * Format an address according to chain conventions
	 * (e.g., lowercase for EVM, as-is for Solana)
	 * @param address - The address to format
	 * @returns Formatted address
	 */
	formatAddress(address: string): string;

	/**
	 * Derive the public address from a private key
	 * @param privateKey - The private key
	 * @returns The public address
	 * @throws Error if private key is invalid
	 */
	getAddressFromPrivateKey(privateKey: string): string;

	/**
	 * Sign a transaction with a private key
	 * @param data - Transaction data to sign
	 * @param privateKey - The private key to sign with
	 * @returns Signature result
	 * @throws Error if signing fails
	 */
	signTransaction(data: TransactionData, privateKey: string): Promise<SignatureResult>;

	/**
	 * Get the regex pattern for address validation
	 * Used for UI validation in n8n node properties
	 * @returns Regex pattern as string
	 */
	getAddressValidationRegex(): string;

	/**
	 * Get the validation error message for addresses
	 * @returns Error message shown to users
	 */
	getAddressValidationError(): string;

	/**
	 * Get example address for placeholder text
	 * @returns Example address string
	 */
	getExampleAddress(): string;
}

/**
 * Base class for chain providers with common functionality
 */
export abstract class BaseChainProvider implements IChainProvider {
	abstract readonly chainType: string;
	abstract readonly displayName: string;

	abstract getNetworks(): ChainNetwork[];
	abstract getNetwork(networkId: string): ChainNetwork | undefined;
	abstract validateAddress(address: string): ValidationResult;
	abstract validatePrivateKey(privateKey: string): ValidationResult;
	abstract formatAddress(address: string): string;
	abstract getAddressFromPrivateKey(privateKey: string): string;
	abstract signTransaction(data: TransactionData, privateKey: string): Promise<SignatureResult>;
	abstract getAddressValidationRegex(): string;
	abstract getAddressValidationError(): string;
	abstract getExampleAddress(): string;

	/**
	 * Helper method to create a validation result
	 */
	protected createValidationResult(valid: boolean, error?: string): ValidationResult {
		return { valid, error };
	}
}
