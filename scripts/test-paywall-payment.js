"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeX402Request = makeX402Request;
exports.createSolanaPaymentTransaction = createSolanaPaymentTransaction;
const web3_js_1 = require("@solana/web3.js");
const spl_token_1 = require("@solana/spl-token");
const dotenv = __importStar(require("dotenv"));
const bs58_1 = __importDefault(require("bs58"));
dotenv.config();
/**
 * Create a partially-signed Solana transaction for x402 payment
 * The transaction will be signed by the client, but the fee payer (facilitator) signature is missing
 */
async function createSolanaPaymentTransaction(keypair, paymentConfig) {
    // Get facilitator fee payer from extra (should be provided by facilitator /accepts endpoint)
    const feePayer = paymentConfig.extra?.feePayer;
    if (!feePayer) {
        throw new Error('feePayer not found in payment requirements. Client should call facilitator /accepts endpoint first.');
    }
    const recentBlockhash = paymentConfig.extra?.recentBlockhash;
    if (!recentBlockhash) {
        throw new Error('recentBlockhash not found in payment requirements. Client should call facilitator /accepts endpoint first.');
    }
    const decimals = paymentConfig.extra?.decimals ?? 6; // Default to 6 for USDC
    // Parse addresses
    const fromPubkey = keypair.publicKey;
    const toPubkey = new web3_js_1.PublicKey(paymentConfig.payTo);
    const mintPubkey = new web3_js_1.PublicKey(paymentConfig.asset);
    const feePayerPubkey = new web3_js_1.PublicKey(feePayer);
    // Get associated token addresses (synchronous function)
    // Use allowOwnerOffCurve: true to be safe (some addresses might be PDAs)
    const fromTokenAccount = (0, spl_token_1.getAssociatedTokenAddressSync)(mintPubkey, fromPubkey, true, // allowOwnerOffCurve - allow for safety
    spl_token_1.TOKEN_PROGRAM_ID);
    const toTokenAccount = (0, spl_token_1.getAssociatedTokenAddressSync)(mintPubkey, toPubkey, true, // allowOwnerOffCurve - payTo might be a PDA or off-curve address
    spl_token_1.TOKEN_PROGRAM_ID);
    // Parse amount (should already be in atomic units)
    const amount = BigInt(paymentConfig.maxAmountRequired);
    // Create transaction
    const transaction = new web3_js_1.Transaction();
    // Set fee payer (facilitator will sign this)
    transaction.feePayer = feePayerPubkey;
    // Set recent blockhash
    transaction.recentBlockhash = recentBlockhash;
    // Add compute budget instructions (required by facilitator validation)
    // 1. Set Compute Unit Limit
    transaction.add(web3_js_1.ComputeBudgetProgram.setComputeUnitLimit({
        units: 200000, // Reasonable limit
    }));
    // 2. Set Compute Unit Price (priority fee)
    // Max 5 lamports per CU as per facilitator validation
    transaction.add(web3_js_1.ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 5000, // 5 lamports per CU = 5000 micro-lamports
    }));
    // 3. Add SPL Token TransferChecked instruction
    transaction.add((0, spl_token_1.createTransferCheckedInstruction)(fromTokenAccount, // source
    mintPubkey, // mint
    toTokenAccount, // destination
    fromPubkey, // authority (client)
    amount, // amount
    decimals, // decimals
    [], // multiSigners (not used for single signature)
    spl_token_1.TOKEN_PROGRAM_ID));
    // Partially sign the transaction (client signs, but fee payer doesn't)
    transaction.partialSign(keypair);
    // Serialize the transaction
    const serialized = transaction.serialize({
        requireAllSignatures: false, // Important: allow partial signature
        verifySignatures: false,
    });
    // Encode as base64
    return Buffer.from(serialized).toString('base64');
}
/**
 * Make a request to the x402 webhook server
 */
async function makeX402Request(webhookUrl, keypair, requestBody = {}, method = 'POST') {
    console.log(`\n=== Step 1: Initial request to ${webhookUrl} ===`);
    // First request without payment to get payment requirements
    const initialResponse = await fetch(webhookUrl, {
        method: method,
        headers: {
            'Content-Type': 'application/json',
        },
        body: method === 'POST' ? JSON.stringify(requestBody) : undefined,
    });
    console.log(`Response status: ${initialResponse.status}`);
    if (initialResponse.status === 402) {
        console.log('\n=== Step 2: Received 402 Payment Required ===');
        const responseData = (await initialResponse.json());
        console.log('Payment requirements:', JSON.stringify(responseData, null, 2));
        // Support both response formats:
        // Format 1: { x402Version: 1, accepts: [...] }
        // Format 2: { error: { paymentConfigs: [...] } }
        const paymentConfigs = responseData.accepts || responseData.error?.paymentConfigs;
        if (!paymentConfigs || paymentConfigs.length === 0) {
            throw new Error('No payment configurations available');
        }
        // Use the first payment config (or you could let user choose)
        const paymentConfig = paymentConfigs[0];
        console.log(`\n=== Step 3: Generating payment for ${paymentConfig.network} ===`);
        console.log(`Amount required: ${paymentConfig.maxAmountRequired} (atomic units)`);
        console.log(`Pay to: ${paymentConfig.payTo}`);
        console.log(`Asset: ${paymentConfig.asset}`);
        console.log(`Fee payer: ${paymentConfig.extra?.feePayer || 'NOT PROVIDED - need to call facilitator /accepts'}`);
        console.log(`Recent blockhash: ${paymentConfig.extra?.recentBlockhash || 'NOT PROVIDED - need to call facilitator /accepts'}`);
        if (!paymentConfig.extra?.feePayer || !paymentConfig.extra?.recentBlockhash) {
            throw new Error('Payment requirements missing feePayer or recentBlockhash. Client should call facilitator /accepts endpoint to get enriched requirements.');
        }
        console.log('\nCreating partially-signed Solana transaction...');
        // Create partially-signed Solana transaction
        const transactionBase64 = await createSolanaPaymentTransaction(keypair, paymentConfig);
        console.log('Transaction created and signed (base64 length):', transactionBase64.length);
        // Build payment payload (raw JSON object)
        // Note: paymentPayload is raw JSON, not base64 encoded
        // It will only be base64 encoded when placed in the X-PAYMENT header
        const paymentPayload = {
            x402Version: 1, // Number as per x402 spec
            scheme: paymentConfig.scheme,
            network: paymentConfig.network,
            payload: {
                transaction: transactionBase64, // Base64-encoded partially-signed Solana transaction
            },
        };
        // Encode payment payload as base64 for X-PAYMENT header
        // The payload is raw JSON, but gets base64 encoded when sent in the header
        const paymentPayloadJson = JSON.stringify(paymentPayload);
        const xPaymentHeader = Buffer.from(paymentPayloadJson).toString('base64');
        console.log('\n=== Step 4: Sending request with payment ===');
        console.log('Payment payload:', JSON.stringify(paymentPayload, null, 2));
        console.log('X-Payment header (base64):', xPaymentHeader.substring(0, 100) + '...');
        // Make second request with payment
        const paymentResponse = await fetch(webhookUrl, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'x-payment': xPaymentHeader,
            },
            body: method === 'POST' ? JSON.stringify(requestBody) : undefined,
        });
        console.log(`\n=== Step 5: Payment response ===`);
        console.log(`Response status: ${paymentResponse.status}`);
        const responseText = await paymentResponse.text();
        console.log('Response body:', responseText);
        // Check for X-PAYMENT-RESPONSE header
        const paymentResponseHeader = paymentResponse.headers.get('X-PAYMENT-RESPONSE');
        if (paymentResponseHeader) {
            console.log('\nX-PAYMENT-RESPONSE header received');
            try {
                const decoded = JSON.parse(Buffer.from(paymentResponseHeader, 'base64').toString());
                console.log('Response data:', JSON.stringify(decoded, null, 2));
            }
            catch {
                console.log('Response (raw):', paymentResponseHeader);
            }
        }
        if (!paymentResponse.ok) {
            throw new Error(`Payment failed: ${paymentResponse.status} - ${responseText}`);
        }
        try {
            return JSON.parse(responseText);
        }
        catch {
            return responseText;
        }
    }
    else if (initialResponse.ok) {
        // Request succeeded without payment (shouldn't happen with x402 enabled)
        console.log('Request succeeded without payment');
        const responseText = await initialResponse.text();
        try {
            return JSON.parse(responseText);
        }
        catch {
            return responseText;
        }
    }
    else {
        // Other error
        const errorText = await initialResponse.text();
        throw new Error(`Request failed: ${initialResponse.status} - ${errorText}`);
    }
}
/**
 * Example usage
 */
async function main() {
    // Configuration from environment variables
    const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:5678/webhook-test/tibbir';
    const PRIVATE_KEY_BASE58 = process.env.PRIVATE_KEY_BASE58 || '64SwCkCTwo29Ukc5re7XJioWRHWtKHScikoLSYDXnDVVUcuUaTjE55BYsAsDp4Hpvaya78zpSgQWdTBxQR8axpa9';
    if (!PRIVATE_KEY_BASE58 || PRIVATE_KEY_BASE58 === 'your-wallet-private-key-here') {
        throw new Error('PRIVATE_KEY_BASE58 must be set in .env file or environment');
    }
    // Create keypair from private key (base58 encoded)
    let keypair;
    try {
        const secretKey = bs58_1.default.decode(PRIVATE_KEY_BASE58);
        keypair = web3_js_1.Keypair.fromSecretKey(secretKey);
    }
    catch (error) {
        throw new Error(`Invalid private key format: ${error instanceof Error ? error.message : String(error)}`);
    }
    console.log('Using wallet address:', keypair.publicKey.toBase58());
    // Optional: Request body to send to the webhook
    const requestBody = {
        message: 'Hello from x402 Solana client',
        timestamp: new Date().toISOString(),
    };
    try {
        const result = await makeX402Request(WEBHOOK_URL, keypair, requestBody, 'POST');
        console.log('\n=== SUCCESS ===');
        console.log('Final result:', JSON.stringify(result, null, 2));
    }
    catch (error) {
        console.error('\n=== ERROR ===');
        console.error(error);
        process.exit(1);
    }
}
// Run if executed directly
if (require.main === module) {
    main().catch(console.error);
}
