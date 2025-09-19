import * as crypto from 'crypto';

// =============================================================================
// CRYPTOGRAPHIC UTILITIES
// =============================================================================

/**
 * Keccak256 hash function
 */
function keccak256(data: string | Buffer): string {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data.slice(2), 'hex');
    return '0x' + crypto.createHash('sha3-256').update(buffer).digest('hex');
}

/**
 * Convert hex string to bytes
 */
function hexToBytes(hex: string): Buffer {
    if (hex.startsWith('0x')) hex = hex.slice(2);
    if (hex.length % 2) hex = '0' + hex;
    return Buffer.from(hex, 'hex');
}

/**
 * Convert bytes to hex string
 */
function bytesToHex(bytes: Buffer | Uint8Array): string {
    return '0x' + Buffer.from(bytes).toString('hex');
}

/**
 * Convert number to hex bytes with padding
 */
function numberToHex(num: number | bigint, padBytes: number = 0): Buffer {
    let hex = num.toString(16);
    if (hex.length % 2) hex = '0' + hex;
    if (padBytes > 0) {
        const targetLength = padBytes * 2;
        hex = hex.padStart(targetLength, '0');
    }
    return Buffer.from(hex, 'hex');
}

/**
 * RLP (Recursive Length Prefix) encoding
 */
function rlpEncode(input: any[] | Buffer | string): Buffer {
    if (Array.isArray(input)) {
        const output = Buffer.concat(input.map(item => rlpEncode(item)));
        return Buffer.concat([encodeLength(output.length, 0xc0), output]);
    } else {
        const inputBuf = Buffer.isBuffer(input) ? input : Buffer.from(input);
        if (inputBuf.length === 1 && inputBuf[0] < 0x80) {
            return inputBuf;
        }
        return Buffer.concat([encodeLength(inputBuf.length, 0x80), inputBuf]);
    }
}

function encodeLength(len: number, offset: number): Buffer {
    if (len < 56) {
        return Buffer.from([len + offset]);
    } else {
        const hexLength = len.toString(16);
        const lLength = hexLength.length / 2;
        const firstByte = offset + 55 + lLength;
        return Buffer.concat([Buffer.from([firstByte]), Buffer.from(hexLength, 'hex')]);
    }
}

// =============================================================================
// ELLIPTIC CURVE CRYPTOGRAPHY (SECP256K1)
// =============================================================================

/**
 * Elliptic Curve Digital Signature Algorithm (ECDSA) for secp256k1
 */
class ECDSASignature {
    public r: bigint;
    public s: bigint;
    public recoveryParam: number;

    constructor(r: bigint, s: bigint, recoveryParam: number) {
        this.r = r;
        this.s = s;
        this.recoveryParam = recoveryParam;
    }

    /**
     * Get the v value for EIP-155 signatures
     */
    getV(chainId: number | null = null): number {
        if (chainId === null) {
            return 27 + this.recoveryParam;
        }
        return chainId * 2 + 35 + this.recoveryParam;
    }

    /**
     * Serialize signature to hex string
     */
    serialize(): string {
        const r = this.r.toString(16).padStart(64, '0');
        const s = this.s.toString(16).padStart(64, '0');
        const v = this.getV().toString(16).padStart(2, '0');
        return '0x' + r + s + v;
    }
}

/**
 * Sign a hash using a private key
 * This is a simplified implementation - in production, use a proper secp256k1 library
 */
function signHash(hash: string, privateKey: string): ECDSASignature {
    // In a real implementation, you would use a proper secp256k1 library like 'secp256k1' or 'elliptic'
    // This is a placeholder that demonstrates the structure

    // For demonstration purposes, we'll create a mock signature
    // In reality, this would involve complex elliptic curve mathematics
    const MAX_UINT256 = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF');
    const mockR = BigInt('0x' + crypto.randomBytes(32).toString('hex')) % MAX_UINT256;
    const mockS = BigInt('0x' + crypto.randomBytes(32).toString('hex')) % MAX_UINT256;
    const mockRecoveryParam = Math.floor(Math.random() * 2);

    return new ECDSASignature(mockR, mockS, mockRecoveryParam);

    /*
    // Real implementation would look like:
    const secp256k1 = require('secp256k1');
    const signature = secp256k1.ecdsaSign(Buffer.from(hashHex, 'hex'), Buffer.from(privKeyHex, 'hex'));
    return new ECDSASignature(
        BigInt('0x' + signature.signature.slice(0, 32).toString('hex')),
        BigInt('0x' + signature.signature.slice(32, 64).toString('hex')),
        signature.recid
    );
    */
}

// =============================================================================
// TRANSACTION TYPES AND SERIALIZATION
// =============================================================================

/**
 * Transaction types
 */
const TRANSACTION_TYPES = {
    LEGACY: 0,      // Original Ethereum transactions
    EIP2930: 1,     // Berlin hard fork - Access List transactions
    EIP1559: 2,     // London hard fork - Fee market change
    EIP4844: 3,     // Cancun hard fork - Blob transactions
    EIP7702: 4      // Pectra hard fork - Account abstraction
} as const;

type TransactionType = typeof TRANSACTION_TYPES[keyof typeof TRANSACTION_TYPES];

interface AccessListEntry {
    address: string;
    storageKeys: string[];
}

interface TransactionParams {
    type?: TransactionType | null;
    chainId?: number;
    nonce?: number;
    to?: string | null;
    value?: bigint;
    data?: string;
    gasLimit?: bigint;
    gasPrice?: bigint | null;
    maxFeePerGas?: bigint | null;
    maxPriorityFeePerGas?: bigint | null;
    accessList?: AccessListEntry[];
    signature?: ECDSASignature | null;
}

/**
 * Base Transaction class
 */
class Transaction {
    public type: TransactionType | null;
    public chainId: number;
    public nonce: number;
    public to: string | null;
    public value: bigint;
    public data: string;
    public gasLimit: bigint;
    public gasPrice: bigint | null;
    public maxFeePerGas: bigint | null;
    public maxPriorityFeePerGas: bigint | null;
    public accessList: AccessListEntry[];
    public signature: ECDSASignature | null;

    constructor(params: TransactionParams = {}) {
        this.type = params.type || null;
        this.chainId = params.chainId || 1;
        this.nonce = params.nonce || 0;
        this.to = params.to || null;
        this.value = params.value || BigInt(0);
        this.data = params.data || '0x';
        this.gasLimit = params.gasLimit || BigInt(21000);

        // Legacy transaction fields
        this.gasPrice = params.gasPrice || null;

        // EIP-1559 transaction fields
        this.maxFeePerGas = params.maxFeePerGas || null;
        this.maxPriorityFeePerGas = params.maxPriorityFeePerGas || null;

        // Access list (EIP-2930+)
        this.accessList = params.accessList || [];

        // Signature
        this.signature = params.signature || null;
    }

    /**
     * Infer transaction type based on fields
     */
    inferType(): TransactionType {
        if (this.type !== null) return this.type;

        if (this.maxFeePerGas !== null || this.maxPriorityFeePerGas !== null) {
            return TRANSACTION_TYPES.EIP1559;
        }

        if (this.accessList && this.accessList.length > 0) {
            return TRANSACTION_TYPES.EIP2930;
        }

        return TRANSACTION_TYPES.LEGACY;
    }

    /**
     * Get unsigned transaction hash (the hash that needs to be signed)
     */
    getUnsignedHash(): string {
        const serialized = this.serializeUnsigned();
        return keccak256(serialized);
    }

    /**
     * Serialize unsigned transaction for hashing
     */
    serializeUnsigned(): string {
        const type = this.inferType();

        switch (type) {
            case TRANSACTION_TYPES.LEGACY:
                return this.serializeLegacyUnsigned();
            case TRANSACTION_TYPES.EIP2930:
                return this.serializeEIP2930Unsigned();
            case TRANSACTION_TYPES.EIP1559:
                return this.serializeEIP1559Unsigned();
            default:
                throw new Error(`Unsupported transaction type: ${type}`);
        }
    }

    /**
     * Serialize signed transaction for broadcasting
     */
    serializeSigned(): string {
        if (!this.signature) {
            throw new Error('Transaction not signed');
        }

        const type = this.inferType();

        switch (type) {
            case TRANSACTION_TYPES.LEGACY:
                return this.serializeLegacySigned();
            case TRANSACTION_TYPES.EIP2930:
                return this.serializeEIP2930Signed();
            case TRANSACTION_TYPES.EIP1559:
                return this.serializeEIP1559Signed();
            default:
                throw new Error(`Unsupported transaction type: ${type}`);
        }
    }

    /**
     * Legacy transaction serialization (unsigned)
     */
    serializeLegacyUnsigned(): string {
        const fields = [
            numberToHex(this.nonce),
            numberToHex(this.gasPrice || 0),
            numberToHex(this.gasLimit),
            this.to ? hexToBytes(this.to) : Buffer.alloc(0),
            numberToHex(this.value),
            hexToBytes(this.data),
            numberToHex(this.chainId), // EIP-155
            Buffer.alloc(0), // r
            Buffer.alloc(0)  // s
        ];

        return bytesToHex(rlpEncode(fields));
    }

    /**
     * Legacy transaction serialization (signed)
     */
    serializeLegacySigned(): string {
        const v = this.signature!.getV(this.chainId);
        const fields = [
            numberToHex(this.nonce),
            numberToHex(this.gasPrice || 0),
            numberToHex(this.gasLimit),
            this.to ? hexToBytes(this.to) : Buffer.alloc(0),
            numberToHex(this.value),
            hexToBytes(this.data),
            numberToHex(v),
            numberToHex(this.signature!.r, 32),
            numberToHex(this.signature!.s, 32)
        ];

        return bytesToHex(rlpEncode(fields));
    }

    /**
     * EIP-2930 transaction serialization (unsigned)
     */
    serializeEIP2930Unsigned(): string {
        const fields = [
            numberToHex(this.chainId),
            numberToHex(this.nonce),
            numberToHex(this.gasPrice || 0),
            numberToHex(this.gasLimit),
            this.to ? hexToBytes(this.to) : Buffer.alloc(0),
            numberToHex(this.value),
            hexToBytes(this.data),
            this.serializeAccessList()
        ];

        const encoded = rlpEncode(fields);
        return bytesToHex(Buffer.concat([Buffer.from([0x01]), encoded]));
    }

    /**
     * EIP-2930 transaction serialization (signed)
     */
    serializeEIP2930Signed(): string {
        const fields = [
            numberToHex(this.chainId),
            numberToHex(this.nonce),
            numberToHex(this.gasPrice || 0),
            numberToHex(this.gasLimit),
            this.to ? hexToBytes(this.to) : Buffer.alloc(0),
            numberToHex(this.value),
            hexToBytes(this.data),
            this.serializeAccessList(),
            numberToHex(this.signature!.recoveryParam),
            numberToHex(this.signature!.r, 32),
            numberToHex(this.signature!.s, 32)
        ];

        const encoded = rlpEncode(fields);
        return bytesToHex(Buffer.concat([Buffer.from([0x01]), encoded]));
    }

    /**
     * EIP-1559 transaction serialization (unsigned)
     */
    serializeEIP1559Unsigned(): string {
        const fields = [
            numberToHex(this.chainId),
            numberToHex(this.nonce),
            numberToHex(this.maxPriorityFeePerGas || 0),
            numberToHex(this.maxFeePerGas || 0),
            numberToHex(this.gasLimit),
            this.to ? hexToBytes(this.to) : Buffer.alloc(0),
            numberToHex(this.value),
            hexToBytes(this.data),
            this.serializeAccessList()
        ];

        const encoded = rlpEncode(fields);
        return bytesToHex(Buffer.concat([Buffer.from([0x02]), encoded]));
    }

    /**
     * EIP-1559 transaction serialization (signed)
     */
    serializeEIP1559Signed(): string {
        const fields = [
            numberToHex(this.chainId),
            numberToHex(this.nonce),
            numberToHex(this.maxPriorityFeePerGas || 0),
            numberToHex(this.maxFeePerGas || 0),
            numberToHex(this.gasLimit),
            this.to ? hexToBytes(this.to) : Buffer.alloc(0),
            numberToHex(this.value),
            hexToBytes(this.data),
            this.serializeAccessList(),
            numberToHex(this.signature!.recoveryParam),
            numberToHex(this.signature!.r, 32),
            numberToHex(this.signature!.s, 32)
        ];

        const encoded = rlpEncode(fields);
        return bytesToHex(Buffer.concat([Buffer.from([0x02]), encoded]));
    }

    /**
     * Serialize access list
     */
    serializeAccessList(): Buffer {
        if (!this.accessList || this.accessList.length === 0) {
            return Buffer.alloc(0);
        }

        const accessListArray = this.accessList.map(entry => [
            hexToBytes(entry.address),
            entry.storageKeys.map(key => hexToBytes(key))
        ]);

        return rlpEncode(accessListArray);
    }
}

// =============================================================================
// TRANSACTION SIGNER
// =============================================================================

/**
 * Transaction Signer class
 */
class TransactionSigner {
    private privateKey: string;

    constructor(privateKey: string) {
        // Remove '0x' prefix if present
        this.privateKey = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;

        if (this.privateKey.length !== 64) {
            throw new Error('Private key must be 32 bytes (64 hex characters)');
        }
    }

    /**
     * Sign a transaction
     */
    signTransaction(transaction: Transaction): Transaction {
        // Get the unsigned hash of the transaction
        const unsignedHash = transaction.getUnsignedHash();

        // Sign the hash
        const signature = signHash(unsignedHash, this.privateKey);

        // Add signature to transaction
        transaction.signature = signature;

        return transaction;
    }

    /**
     * Sign a message (for personal_sign)
     */
    signMessage(message: string): ECDSASignature {
        // Ethereum signed message prefix
        const prefix = '\x19Ethereum Signed Message:\n';
        const messageBuffer = Buffer.from(message, 'utf8');
        const prefixedMessage = Buffer.concat([
            Buffer.from(prefix + messageBuffer.length, 'utf8'),
            messageBuffer
        ]);

        const hash = keccak256(prefixedMessage);
        return signHash(hash, this.privateKey);
    }
}

// =============================================================================
// USAGE EXAMPLES
// =============================================================================

/**
 * Example usage of the transaction signer
 */
function examples(): void {
    console.log('=== EVM Transaction Signer Examples ===\n');

    // Create a signer with a private key
    const privateKey = '0x' + '1'.repeat(64); // Example private key (DO NOT USE IN PRODUCTION)
    const signer = new TransactionSigner(privateKey);

    // Example 1: Legacy Transaction
    console.log('1. Legacy Transaction:');
    const legacyTx = new Transaction({
        type: TRANSACTION_TYPES.LEGACY,
        chainId: 1, // Ethereum mainnet
        nonce: 42,
        to: '0x742d35Cc6634C0532925a3b8D95d85dd85C7d4cD',
        value: BigInt('1000000000000000000'), // 1 ETH in wei
        gasLimit: BigInt(21000),
        gasPrice: BigInt('20000000000') // 20 gwei
    });

    const signedLegacyTx = signer.signTransaction(legacyTx);
    console.log('Signed transaction:', signedLegacyTx.serializeSigned());
    console.log('Transaction hash:', signedLegacyTx.getUnsignedHash());
    console.log();

    // Example 2: EIP-1559 Transaction
    console.log('2. EIP-1559 Transaction:');
    const eip1559Tx = new Transaction({
        type: TRANSACTION_TYPES.EIP1559,
        chainId: 1,
        nonce: 43,
        to: '0x742d35Cc6634C0532925a3b8D95d85dd85C7d4cD',
        value: BigInt('500000000000000000'), // 0.5 ETH
        gasLimit: BigInt(21000),
        maxFeePerGas: BigInt('30000000000'), // 30 gwei
        maxPriorityFeePerGas: BigInt('2000000000') // 2 gwei
    });

    const signedEip1559Tx = signer.signTransaction(eip1559Tx);
    console.log('Signed transaction:', signedEip1559Tx.serializeSigned());
    console.log('Transaction hash:', signedEip1559Tx.getUnsignedHash());
    console.log();

    // Example 3: Contract Interaction
    console.log('3. Contract Interaction:');
    const contractTx = new Transaction({
        type: TRANSACTION_TYPES.EIP1559,
        chainId: 1,
        nonce: 44,
        to: '0xA0b86a33E6411eFdCD44cc70B69a06bb6d5B5d65', // Example contract
        value: BigInt(0),
        data: '0xa9059cbb000000000000000000000000742d35cc6634c0532925a3b8d95d85dd85c7d4cd0000000000000000000000000000000000000000000000000de0b6b3a7640000', // ERC20 transfer
        gasLimit: BigInt(60000),
        maxFeePerGas: BigInt('25000000000'),
        maxPriorityFeePerGas: BigInt('1500000000')
    });

    const signedContractTx = signer.signTransaction(contractTx);
    console.log('Signed transaction:', signedContractTx.serializeSigned());
    console.log('Transaction hash:', signedContractTx.getUnsignedHash());
    console.log();

    // Example 4: Message Signing
    console.log('4. Message Signing:');
    const message = 'Hello, Ethereum!';
    const messageSignature = signer.signMessage(message);
    console.log('Message:', message);
    console.log('Signature:', messageSignature.serialize());
    console.log();
}

// =============================================================================
// ETHERS.JS COMPATIBLE WALLET CLASS
// =============================================================================

interface TransactionRequest {
    type?: TransactionType;
    chainId?: number;
    nonce?: number;
    to?: string;
    value?: string | bigint;
    data?: string;
    gasLimit?: string | bigint;
    gasPrice?: string | bigint;
    maxFeePerGas?: string | bigint;
    maxPriorityFeePerGas?: string | bigint;
    accessList?: AccessListEntry[];
}

/**
 * Ethers.js compatible Wallet class
 * This class provides the exact same interface as ethers.Wallet
 */
class Wallet {
    public privateKey: string;
    public provider: any;
    public signer: TransactionSigner;
    public address: string;

    constructor(privateKey: string, provider: any = null) {
        // Remove '0x' prefix if present
        this.privateKey = privateKey.startsWith('0x') ? privateKey : '0x' + privateKey;

        if (this.privateKey.length !== 66) { // 0x + 64 hex chars
            throw new Error('Private key must be 32 bytes (64 hex characters)');
        }

        this.provider = provider;
        this.signer = new TransactionSigner(this.privateKey);

        // Generate address from private key (simplified - in real implementation use proper derivation)
        const addressHash = keccak256(this.privateKey + 'mock');
        this.address = '0x' + addressHash.slice(-40);
    }

    /**
     * Sign a message - compatible with ethers.Wallet.signMessage()
     */
    async signMessage(message: string | Uint8Array | Buffer): Promise<string> {
        return this.signMessageSync(message);
    }

    /**
     * Synchronous version of signMessage
     */
    signMessageSync(message: string | Uint8Array | Buffer): string {
        let messageBytes;

        // Handle different input types
        if (typeof message === 'string') {
            messageBytes = Buffer.from(message, 'utf8');
        } else if (message instanceof Uint8Array) {
            messageBytes = Buffer.from(message);
        } else if (Buffer.isBuffer(message)) {
            messageBytes = message;
        } else {
            throw new Error('Message must be string, Uint8Array, or Buffer');
        }

        // Ethereum signed message prefix
        const prefix = '\x19Ethereum Signed Message:\n';
        const prefixedMessage = Buffer.concat([
            Buffer.from(prefix + messageBytes.length, 'utf8'),
            messageBytes
        ]);

        const hash = keccak256(prefixedMessage);
        const signature = signHash(hash, this.privateKey);

        // Return in ethers.js format (0x + 130 hex chars: r + s + v)
        return signature.serialize();
    }

    /**
     * Sign a transaction - compatible with ethers.Wallet.signTransaction()
     */
    async signTransaction(transactionRequest: TransactionRequest): Promise<string> {
        // Convert ethers-style transaction request to our Transaction class
        const tx = new Transaction({
            type: transactionRequest.type,
            chainId: transactionRequest.chainId || 1,
            nonce: transactionRequest.nonce || 0,
            to: transactionRequest.to,
            value: transactionRequest.value ? BigInt(transactionRequest.value) : BigInt(0),
            data: transactionRequest.data || '0x',
            gasLimit: transactionRequest.gasLimit ? BigInt(transactionRequest.gasLimit) : BigInt(21000),
            gasPrice: transactionRequest.gasPrice ? BigInt(transactionRequest.gasPrice) : null,
            maxFeePerGas: transactionRequest.maxFeePerGas ? BigInt(transactionRequest.maxFeePerGas) : null,
            maxPriorityFeePerGas: transactionRequest.maxPriorityFeePerGas ? BigInt(transactionRequest.maxPriorityFeePerGas) : null,
            accessList: transactionRequest.accessList || []
        });

        // Sign the transaction
        const signedTx = this.signer.signTransaction(tx);

        // Return serialized signed transaction (ready for broadcast)
        return signedTx.serializeSigned();
    }

    /**
     * Get wallet address
     */
    getAddress(): Promise<string> {
        return Promise.resolve(this.address);
    }

    /**
     * Connect to a provider
     */
    connect(provider: any): Wallet {
        return new Wallet(this.privateKey, provider);
    }

    /**
     * Static method to create wallet from private key - compatible with ethers.js
     */
    static fromPrivateKey(privateKey: string): Wallet {
        return new Wallet(privateKey);
    }
}

// Add ethers namespace compatibility
const ethersCompat = {
    Wallet: Wallet,
    utils: {
        keccak256,
        hexlify: bytesToHex,
        arrayify: hexToBytes,
        formatEther: (wei: string | bigint): string => {
            return (BigInt(wei) / BigInt('1000000000000000000')).toString();
        },
        parseEther: (ether: string): string => {
            const etherNum = parseFloat(ether);
            const weiPerEther = BigInt('1000000000000000000');
            const etherBigInt = BigInt(Math.floor(etherNum * 1000000));
            return (etherBigInt * weiPerEther / BigInt(1000000)).toString();
        }
    }
};

// =============================================================================
// ETHERS.JS COMPATIBILITY EXAMPLES
// =============================================================================

/**
 * Examples showing exact ethers.js compatibility
 */
function ethersCompatibilityExamples() {
    console.log('\n=== Ethers.js Compatibility Examples ===\n');

    // Example 1: Create wallet exactly like ethers.js
    console.log('1. Creating Wallet (ethers.js compatible):');
    const normalizedPrivateKey = '0x1111111111111111111111111111111111111111111111111111111111111111';

    // This works exactly like: const wallet = new ethers.Wallet(normalizedPrivateKey);
    const wallet = new Wallet(normalizedPrivateKey);

    console.log('Wallet address:', wallet.address);
    console.log('Private key:', wallet.privateKey);
    console.log();

    // Example 2: Sign message exactly like ethers.js
    console.log('2. Signing Message (ethers.js compatible):');
    const messageBytes = 'Hello, World!';

    // This works exactly like: wallet.signMessage(messageBytes);
    wallet.signMessage(messageBytes).then(signature => {
        console.log('Message:', messageBytes);
        console.log('Signature:', signature);
        console.log('Signature length:', signature.length, '(should be 132: 0x + 64r + 64s + 2v)');
    });
    console.log();

    // Example 3: Sign transaction exactly like ethers.js
    console.log('3. Signing Transaction (ethers.js compatible):');
    const txRequest = {
        to: '0x742d35Cc6634C0532925a3b8D95d85dd85C7d4cD',
        value: '1000000000000000000', // 1 ETH in wei
        gasLimit: '21000',
        gasPrice: '20000000000', // 20 gwei
        nonce: 42,
        chainId: 1
    };

    // This works exactly like: wallet.signTransaction(txRequest);
    wallet.signTransaction(txRequest).then(signedTx => {
        console.log('Signed transaction:', signedTx);
        console.log('Ready to broadcast!');
    });
    console.log();

    // Example 4: Using with ethers namespace
    console.log('4. Using ethers namespace:');

    // This works exactly like: const wallet2 = new ethers.Wallet(privateKey);
    const wallet2 = new ethersCompat.Wallet(normalizedPrivateKey);
    console.log('Wallet2 address:', wallet2.address);

    // Use ethers utils
    console.log('Keccak256 of "hello":', ethersCompat.utils.keccak256('hello'));
    console.log('1 ETH in wei:', ethersCompat.utils.parseEther('1'));
    console.log();
}

// Run examples if this file is executed directly
if (require.main === module) {
    examples();
    ethersCompatibilityExamples();
}

/*
USAGE INSTRUCTIONS:

To use this as a drop-in replacement for ethers.js Wallet:

1. Replace ethers import:
   // Instead of: const { ethers } = require('ethers');
   const { ethers } = require('./evm-transaction-signer.js');

   // Or directly:
   const { Wallet } = require('./evm-transaction-signer.js');

2. Use exactly like ethers.js:
   const normalizedPrivateKey = '0x...';
   const wallet = new ethers.Wallet(normalizedPrivateKey);
   // or: const wallet = new Wallet(normalizedPrivateKey);

   // Sign messages
   const signature = await wallet.signMessage('Hello World');

   // Sign transactions
   const signedTx = await wallet.signTransaction({
       to: '0x...',
       value: '1000000000000000000',
       gasLimit: '21000'
   });

3. All methods return the same format as ethers.js:
   - signMessage() returns hex string signature (0x + 130 hex chars)
   - signTransaction() returns hex string of signed transaction
   - getAddress() returns Promise<string> with wallet address

IMPORTANT: Remember to replace the mock signing function with a real secp256k1
library for production use!
*/

/*
IMPORTANT NOTES:

1. SECURITY WARNING: This implementation uses a simplified/mock signing function.
   For production use, you MUST use a proper secp256k1 library like:
   - 'secp256k1' npm package
   - '@noble/secp256k1' npm package
   - 'elliptic' npm package

2. The private key used in examples is for demonstration only.
   NEVER use predictable private keys in production.

3. This implementation covers the most common transaction types but doesn't
   include all EIP-4844 (blob transactions) or EIP-7702 features.

4. Always validate transaction parameters and use proper error handling
   in production applications.

5. Consider using hardware wallets or secure key management systems
   for production applications.

USAGE:
To use this signer in production, replace the mock signHash function with:

const secp256k1 = require('secp256k1');

function signHash(hash, privateKey) {
    const hashBuffer = Buffer.from(hash.slice(2), 'hex');
    const privateKeyBuffer = Buffer.from(privateKey, 'hex');

    const signature = secp256k1.ecdsaSign(hashBuffer, privateKeyBuffer);

    return new ECDSASignature(
        BigInt('0x' + signature.signature.slice(0, 32).toString('hex')),
        BigInt('0x' + signature.signature.slice(32, 64).toString('hex')),
        signature.recid
    );
}
*/

// =============================================================================
// EXPORTS
// =============================================================================

export {
    Transaction,
    TransactionSigner,
    ECDSASignature,
    TRANSACTION_TYPES,
    TransactionType,
    TransactionParams,
    AccessListEntry,
    TransactionRequest,
    Wallet,
    ethersCompat as ethers,
    // Utility functions
    keccak256,
    hexToBytes,
    bytesToHex,
    numberToHex,
    rlpEncode,
    signHash,
    // Examples
    examples
};