# Test Scripts

## test-paywall-payment.ts

TypeScript script to test x402 paywall payments to the webhook endpoint using Solana.

### Prerequisites

Install required dependencies:

```bash
npm install @solana/web3.js @solana/spl-token bs58 dotenv
npm install -D typescript @types/node ts-node
```

**Note:** This script requires Node.js 18+ (for built-in `fetch`).

### Environment Setup

Create a `.env` file in the project root:

```env
WEBHOOK_URL=http://localhost:5678/webhook-test/tibbir
PRIVATE_KEY_BASE58=64SwCkCTwo29Ukc5re7XJioWRHWtKHScikoLSYDXnDVVUcuUaTjE55BYsAsDp4Hpvaya78zpSgQWdTBxQR8axpa9
```

### Usage

```bash
# Using ts-node
npx ts-node scripts/test-paywall-payment.ts

# Or compile first
npx tsc scripts/test-paywall-payment.ts
node scripts/test-paywall-payment.js
```

### How it works

1. **Fetch Payment Requirements**: Makes a POST request to the webhook to get payment requirements (returns 402 with `accepts` field)
2. **Create Authorization**: Creates a payment authorization with the required amount and addresses
3. **Sign Message**: Signs the authorization JSON using Ed25519 (Solana signature scheme)
4. **Send Payment**: Sends the payment in the `X-PAYMENT` header as base64-encoded JSON

### Key Differences from EVM Version

- Uses **Solana Ed25519 signatures** instead of EIP-712
- Uses **base58 addresses** instead of hex addresses
- Signs **authorization JSON directly** (no EIP-712 domain/typed data)
- Uses **string nonces** instead of bytes32 hex
- Signature is **base58-encoded** instead of hex

### Configuration

The script reads configuration from environment variables:
- **WEBHOOK_URL**: The webhook endpoint URL (default: `http://localhost:5678/webhook-test/tibbir`)
- **PRIVATE_KEY_BASE58**: Your Solana wallet private key in base58 format

### Example Output

```
=== Step 1: Initial request to http://localhost:5678/webhook-test/tibbir ===
Response status: 402

=== Step 2: Received 402 Payment Required ===
Payment requirements: { ... }

=== Step 3: Generating payment for solana-devnet ===
Amount required: 1000000 (atomic units)
Pay to: GY5UiQtdrRx8z7JxjaBAL3SQUcUJc6RciVLfLvJEQmxy
Asset: 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU

Generating Solana signature...
Signature generated: ...

=== Step 4: Sending request with payment ===
Payment payload: { ... }

=== Step 5: Payment response ===
Response status: 200
```

### Troubleshooting

- **ECONNREFUSED**: Make sure n8n is running on `http://localhost:5678`
- **Invalid private key**: Make sure `PRIVATE_KEY_BASE58` is a valid base58-encoded Solana private key
- **Module not found**: Run `npm install @solana/web3.js bs58 dotenv`
- **TypeScript errors**: Make sure TypeScript is installed and the file compiles correctly

