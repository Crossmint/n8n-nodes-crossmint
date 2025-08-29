# Crossmint n8n Node API Reference

This document provides comprehensive API reference documentation for all operations supported by the Crossmint n8n community node.

## Table of Contents

- [Authentication](#authentication)
- [Wallet Operations](#wallet-operations)
- [Checkout Operations](#checkout-operations)
- [Error Handling](#error-handling)
- [Examples](#examples)

## Authentication

### Crossmint API Credentials

The primary credential type for accessing Crossmint APIs.

**Credential Type**: `crossmintApi`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `apiKey` | string (password) | Yes | Server-side API key from Crossmint Console |
| `environment` | options | Yes | API environment: `production` or `staging` |

**Environment URLs**:
- **Production**: `https://www.crossmint.com/api/`
- **Staging**: `https://staging.crossmint.com/api/`

### Private Key Credentials

For transaction signing operations.

**Credential Type**: `crossmintPrivateKeyApi`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `privateKey` | string (password) | Yes | Private key for signing (32-byte hex for EVM, base58 for Solana) |
| `chainType` | options | Yes | Blockchain type: `evm` or `solana` |

## Wallet Operations

### Get or Create Wallet

Creates a new wallet or retrieves an existing one. This operation is idempotent.

**Operation**: `createWallet`

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `chainType` | options | Yes | Blockchain type: `evm` or `solana` |
| `ownerType` | options | No | Owner identifier type |
| `ownerEmail` | string | Conditional | Required if `ownerType` is `email` |
| `ownerUserId` | string | Conditional | Required if `ownerType` is `userId` |
| `ownerPhoneNumber` | string | Conditional | Required if `ownerType` is `phoneNumber` |
| `ownerTwitterHandle` | string | Conditional | Required if `ownerType` is `twitter` |
| `ownerXHandle` | string | Conditional | Required if `ownerType` is `x` |
| `externalSignerDetails` | string (password) | Yes | Private key for wallet admin signer |

#### Response

```json
{
  "id": "wallet-123",
  "address": "0x742d35Cc6634C0532925a3b8D0C9e0e7C0C0C0C0",
  "type": "evm-smart-wallet",
  "chainType": "evm",
  "config": {
    "adminSigner": {
      "type": "external-wallet",
      "address": "0x..."
    }
  }
}
```

#### Example

```json
{
  "chainType": "evm",
  "ownerType": "email",
  "ownerEmail": "user@example.com",
  "externalSignerDetails": "0x1234567890abcdef..."
}
```

### Get Wallet

Retrieves wallet information using a wallet locator.

**Operation**: `getWallet`

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `getWalletLocatorType` | options | Yes | Type of locator to use |
| `getWalletAddress` | string | Conditional | Wallet address (if locator type is `address`) |
| `getWalletEmail` | string | Conditional | Email address (if locator type is `email`) |
| `getWalletUserId` | string | Conditional | User ID (if locator type is `userId`) |
| `getWalletPhoneNumber` | string | Conditional | Phone number (if locator type is `phoneNumber`) |
| `getWalletTwitterHandle` | string | Conditional | Twitter handle (if locator type is `twitter`) |
| `getWalletXHandle` | string | Conditional | X handle (if locator type is `x`) |
| `getWalletChainType` | options | Conditional | Required for non-address locators |

#### Wallet Locator Formats

| Locator Type | Format | Example |
|--------------|--------|---------|
| Address | `{address}` | `0x742d35Cc6634C0532925a3b8D0C9e0e7C0C0C0C0` |
| Email | `email:{email}:{chainType}:smart` | `email:user@example.com:evm:smart` |
| User ID | `userId:{id}:{chainType}:smart` | `userId:user-123:evm:smart` |
| Phone | `phoneNumber:{phone}:{chainType}:smart` | `phoneNumber:+1234567890:evm:smart` |
| Twitter | `twitter:{handle}:{chainType}:smart` | `twitter:username:evm:smart` |
| X | `x:{handle}:{chainType}:smart` | `x:username:evm:smart` |

#### Response

```json
{
  "id": "wallet-123",
  "address": "0x742d35Cc6634C0532925a3b8D0C9e0e7C0C0C0C0",
  "type": "evm-smart-wallet",
  "owner": "email:user@example.com"
}
```

### Transfer Token

Creates a token transfer between wallets.

**Operation**: `transferToken`

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `blockchainType` | options | Yes | Blockchain type: `evm` or `solana` |
| `originWallet` | resourceLocator | Yes | Source wallet locator |
| `recipientWallet` | resourceLocator | Yes | Destination wallet locator |
| `tokenChain` | string | Yes | Blockchain network (e.g., `ethereum-sepolia`) |
| `tokenName` | string | Yes | Token symbol (e.g., `usdc`) |
| `amount` | string | Yes | Amount to transfer (decimal format) |

#### Resource Locator Modes

The `originWallet` and `recipientWallet` parameters support multiple modes:

- **address**: Direct wallet address
- **email**: Email address
- **userId**: User ID
- **phoneNumber**: Phone number with country code
- **twitter**: Twitter handle (without @)
- **x**: X handle (without @)

#### Response

```json
{
  "id": "transfer-123",
  "status": "pending",
  "from": "0x...",
  "to": "0x...",
  "amount": "10.50",
  "token": "usdc",
  "chain": "ethereum-sepolia"
}
```

#### Example

```json
{
  "blockchainType": "evm",
  "originWallet": {
    "mode": "email",
    "value": "sender@example.com"
  },
  "recipientWallet": {
    "mode": "address",
    "value": "0x742d35Cc6634C0532925a3b8D0C9e0e7C0C0C0C0"
  },
  "tokenChain": "ethereum-sepolia",
  "tokenName": "usdc",
  "amount": "10.50"
}
```

### Get Balance

Retrieves wallet balance for specified tokens and chains.

**Operation**: `getBalance`

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `balanceLocatorType` | options | Yes | Type of wallet locator |
| `balanceWalletAddress` | string | Conditional | Wallet address (if locator type is `address`) |
| `balanceWalletEmail` | string | Conditional | Email address (if locator type is `email`) |
| `balanceWalletUserId` | string | Conditional | User ID (if locator type is `userId`) |
| `balanceWalletPhoneNumber` | string | Conditional | Phone number (if locator type is `phoneNumber`) |
| `balanceWalletTwitterHandle` | string | Conditional | Twitter handle (if locator type is `twitter`) |
| `balanceWalletXHandle` | string | Conditional | X handle (if locator type is `x`) |
| `balanceWalletChainType` | options | Conditional | Required for non-address locators |
| `chains` | string | No | Comma-separated list of chains to query |
| `tokens` | string | No | Comma-separated list of tokens to query |

#### Response

```json
{
  "balances": [
    {
      "chain": "ethereum-sepolia",
      "token": "usdc",
      "balance": "150.25",
      "decimals": 6
    },
    {
      "chain": "ethereum-sepolia",
      "token": "eth",
      "balance": "0.05",
      "decimals": 18
    }
  ]
}
```

### Sign Transaction

Signs a transaction with a private key and submits the signature.

**Operation**: `signAndSubmitTransaction`

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `signSubmitWalletAddress` | string | Yes | Wallet address for the transaction |
| `signSubmitTransactionId` | string | Yes | Transaction ID to sign |
| `signSubmitTransactionData` | string | Yes | Transaction data to sign |
| `signSubmitSignerAddress` | string | Yes | Address of the signing wallet |
| `signSubmitPrivateKey` | string (password) | Yes | Private key for signing |

#### Response

```json
{
  "id": "signature-123",
  "signature": "0x...",
  "status": "submitted",
  "transactionHash": "0x..."
}
```

## Checkout Operations

### Create Order

Creates a purchase order for products from supported platforms.

**Operation**: `findProduct`

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `platform` | options | Yes | E-commerce platform: `amazon` or `shopify` |
| `productIdentifier` | string | Yes | Product URL or identifier |
| `recipientEmail` | string | Yes | Recipient email address |
| `recipientName` | string | Yes | Recipient full name |
| `addressLine1` | string | Yes | Shipping address line 1 |
| `addressLine2` | string | No | Shipping address line 2 |
| `city` | string | Yes | Shipping city |
| `state` | string | Yes | Shipping state/province |
| `postalCode` | string | Yes | Shipping postal code |
| `country` | string | Yes | Shipping country code |
| `paymentMethod` | string | Yes | Payment blockchain (e.g., `ethereum-sepolia`) |
| `paymentCurrency` | string | Yes | Payment token (e.g., `usdc`) |
| `payerAddress` | string | Yes | Wallet address for payment |

#### Response

```json
{
  "id": "order-123",
  "status": "created",
  "lineItems": [
    {
      "productLocator": "amazon:B08N5WRWNW:default",
      "quantity": 1,
      "price": "29.99"
    }
  ],
  "totalPrice": "29.99",
  "currency": "USD",
  "serializedTransaction": "0x...",
  "recipient": {
    "email": "recipient@example.com",
    "physicalAddress": {
      "name": "John Doe",
      "line1": "123 Main St",
      "city": "New York",
      "state": "NY",
      "postalCode": "10001",
      "country": "US"
    }
  }
}
```

### Pay Order

Executes payment for a previously created order.

**Operation**: `purchaseProduct`

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `serializedTransaction` | string | Yes | Transaction data from create order |
| `paymentMethod` | string | Yes | Payment blockchain |
| `payerAddress` | string | Yes | Wallet address for payment |

#### Response

```json
{
  "id": "payment-123",
  "status": "pending",
  "transactionHash": "0x...",
  "orderId": "order-123"
}
```

## Error Handling

### Common Error Types

| Error Type | Description | Resolution |
|------------|-------------|------------|
| `INVALID_API_KEY` | API key is invalid or expired | Check API key and environment |
| `INSUFFICIENT_BALANCE` | Wallet has insufficient funds | Add funds to wallet |
| `INVALID_WALLET_LOCATOR` | Wallet locator format is incorrect | Verify locator format |
| `NETWORK_ERROR` | Network connectivity issues | Check internet connection |
| `INVALID_PRIVATE_KEY` | Private key format is incorrect | Verify private key format |

### Error Response Format

```json
{
  "error": {
    "code": "INVALID_API_KEY",
    "message": "The provided API key is invalid",
    "details": {
      "field": "apiKey",
      "value": "hidden"
    }
  }
}
```

## Examples

### Complete Wallet Workflow

```json
{
  "workflow": [
    {
      "operation": "createWallet",
      "parameters": {
        "chainType": "evm",
        "ownerType": "email",
        "ownerEmail": "user@example.com"
      }
    },
    {
      "operation": "getBalance",
      "parameters": {
        "balanceLocatorType": "email",
        "balanceWalletEmail": "user@example.com",
        "balanceWalletChainType": "evm"
      }
    },
    {
      "operation": "transferToken",
      "parameters": {
        "originWallet": {
          "mode": "email",
          "value": "user@example.com"
        },
        "recipientWallet": {
          "mode": "address",
          "value": "0x742d35Cc6634C0532925a3b8D0C9e0e7C0C0C0C0"
        },
        "tokenChain": "ethereum-sepolia",
        "tokenName": "usdc",
        "amount": "10.00"
      }
    }
  ]
}
```

### Complete Checkout Workflow

```json
{
  "workflow": [
    {
      "operation": "findProduct",
      "parameters": {
        "platform": "amazon",
        "productIdentifier": "B08N5WRWNW",
        "recipientEmail": "recipient@example.com",
        "recipientName": "John Doe",
        "addressLine1": "123 Main St",
        "city": "New York",
        "state": "NY",
        "postalCode": "10001",
        "country": "US",
        "paymentMethod": "ethereum-sepolia",
        "paymentCurrency": "usdc",
        "payerAddress": "0x742d35Cc6634C0532925a3b8D0C9e0e7C0C0C0C0"
      }
    },
    {
      "operation": "purchaseProduct",
      "parameters": {
        "serializedTransaction": "{{ $json.serializedTransaction }}",
        "paymentMethod": "ethereum-sepolia",
        "payerAddress": "0x742d35Cc6634C0532925a3b8D0C9e0e7C0C0C0C0"
      }
    }
  ]
}
```

## Rate Limits

- **API Requests**: 100 requests per minute per API key
- **Transaction Signing**: 10 signatures per minute per private key
- **Wallet Creation**: 5 wallets per minute per API key

## Supported Chains and Tokens

### EVM Chains
- Ethereum Mainnet (`ethereum`)
- Ethereum Sepolia (`ethereum-sepolia`)
- Polygon (`polygon`)
- Base (`base`)
- Arbitrum (`arbitrum`)

### Solana
- Solana Mainnet (`solana`)
- Solana Devnet (`solana-devnet`)

### Supported Tokens
- USDC (`usdc`)
- ETH (`eth`)
- MATIC (`matic`)
- SOL (`sol`)

For the most up-to-date list of supported chains and tokens, see the [Crossmint documentation](https://docs.crossmint.com/introduction/supported-chains).
