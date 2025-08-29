# Workflow Examples

This document provides detailed examples of n8n workflows using the Crossmint community node, covering common use cases and advanced scenarios.

## Table of Contents

- [Basic Wallet Operations](#basic-wallet-operations)
- [Token Transfer Workflows](#token-transfer-workflows)
- [E-commerce Checkout Flows](#e-commerce-checkout-flows)
- [Advanced Use Cases](#advanced-use-cases)
- [AI-Powered Workflows](#ai-powered-workflows)
- [Error Handling Patterns](#error-handling-patterns)

## Basic Wallet Operations

### 1. Create and Fund Wallet

This workflow demonstrates creating a wallet, checking its balance, and preparing it for transactions.

#### Workflow Steps

1. **Manual Trigger** - Start the workflow
2. **Get or Create Wallet** - Create wallet for user
3. **Get Wallet Details** - Retrieve wallet information
4. **Check Balance** - Verify wallet balance
5. **Conditional Logic** - Check if funding is needed

#### Configuration

**Node 1: Get or Create Wallet**
```json
{
  "operation": "createWallet",
  "chainType": "evm",
  "ownerType": "email",
  "ownerEmail": "user@example.com",
  "externalSignerDetails": "your-private-key-here"
}
```

**Node 2: Get Wallet Details**
```json
{
  "operation": "getWallet",
  "getWalletLocatorType": "address",
  "getWalletAddress": "={{ $json.address }}"
}
```

**Node 3: Check Balance**
```json
{
  "operation": "getBalance",
  "balanceLocatorType": "address",
  "balanceWalletAddress": "={{ $json.address }}",
  "chains": "ethereum-sepolia",
  "tokens": "usdc"
}
```

#### Expected Output

```json
{
  "wallet": {
    "id": "wallet-123",
    "address": "0x742d35Cc6634C0532925a3b8D0C9e0e7C0C0C0C0",
    "type": "evm-smart-wallet"
  },
  "balance": {
    "usdc": "0.00",
    "eth": "0.001"
  }
}
```

### 2. Multi-Chain Wallet Management

Create wallets on multiple blockchains for the same user.

#### Workflow Steps

1. **Manual Trigger** - Start workflow
2. **Create EVM Wallet** - Ethereum-compatible wallet
3. **Create Solana Wallet** - Solana blockchain wallet
4. **Parallel Balance Check** - Check balances on both chains
5. **Merge Results** - Combine wallet information

#### Configuration

**EVM Wallet Creation**
```json
{
  "operation": "createWallet",
  "chainType": "evm",
  "ownerType": "email",
  "ownerEmail": "user@example.com",
  "externalSignerDetails": "evm-private-key"
}
```

**Solana Wallet Creation**
```json
{
  "operation": "createWallet",
  "chainType": "solana",
  "ownerType": "email",
  "ownerEmail": "user@example.com",
  "externalSignerDetails": "solana-private-key"
}
```

## Token Transfer Workflows

### 3. Simple USDC Transfer

Transfer USDC tokens between two wallets.

#### Workflow Steps

1. **Manual Trigger** - Start transfer
2. **Check Sender Balance** - Verify sufficient funds
3. **Create Transfer** - Initiate token transfer
4. **Sign Transaction** - Sign with private key
5. **Confirmation** - Verify transaction success

#### Configuration

**Check Balance**
```json
{
  "operation": "getBalance",
  "balanceLocatorType": "email",
  "balanceWalletEmail": "sender@example.com",
  "balanceWalletChainType": "evm",
  "tokens": "usdc"
}
```

**Create Transfer**
```json
{
  "operation": "transferToken",
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
  "amount": "10.00"
}
```

**Sign Transaction**
```json
{
  "operation": "signAndSubmitTransaction",
  "signSubmitWalletAddress": "={{ $('Create Transfer').item.json.from }}",
  "signSubmitTransactionId": "={{ $('Create Transfer').item.json.id }}",
  "signSubmitTransactionData": "={{ $('Create Transfer').item.json.message }}",
  "signSubmitSignerAddress": "signer-address",
  "signSubmitPrivateKey": "private-key"
}
```

### 4. Batch Transfer Workflow

Transfer tokens to multiple recipients in a single workflow.

#### Workflow Steps

1. **Manual Trigger** - Start batch transfer
2. **Set Recipients** - Define recipient list
3. **Split Recipients** - Process each recipient
4. **Create Transfers** - Create transfer for each
5. **Sign All Transactions** - Batch sign transactions
6. **Merge Results** - Combine all results

#### Configuration

**Set Recipients Node (Code)**
```javascript
const recipients = [
  { email: "user1@example.com", amount: "5.00" },
  { email: "user2@example.com", amount: "10.00" },
  { address: "0x742d35Cc6634C0532925a3b8D0C9e0e7C0C0C0C0", amount: "15.00" }
];

return recipients.map(recipient => ({ json: recipient }));
```

**Create Transfer (in loop)**
```json
{
  "operation": "transferToken",
  "blockchainType": "evm",
  "originWallet": {
    "mode": "email",
    "value": "sender@example.com"
  },
  "recipientWallet": {
    "mode": "={{ $json.email ? 'email' : 'address' }}",
    "value": "={{ $json.email || $json.address }}"
  },
  "tokenChain": "ethereum-sepolia",
  "tokenName": "usdc",
  "amount": "={{ $json.amount }}"
}
```

## E-commerce Checkout Flows

### 5. Amazon Product Purchase

Complete workflow for purchasing Amazon products with cryptocurrency.

#### Workflow Steps

1. **Webhook Trigger** - Receive purchase request
2. **Validate Input** - Check product URL and payment details
3. **Create Order** - Generate purchase order
4. **Process Payment** - Execute cryptocurrency payment
5. **Send Confirmation** - Notify customer

#### Configuration

**Webhook Trigger**
```json
{
  "httpMethod": "POST",
  "path": "purchase-product",
  "responseMode": "responseNode"
}
```

**Create Order**
```json
{
  "operation": "findProduct",
  "platform": "amazon",
  "productIdentifier": "={{ $json.productUrl }}",
  "recipientEmail": "={{ $json.customer.email }}",
  "recipientName": "={{ $json.customer.name }}",
  "addressLine1": "={{ $json.shipping.address1 }}",
  "city": "={{ $json.shipping.city }}",
  "state": "={{ $json.shipping.state }}",
  "postalCode": "={{ $json.shipping.postalCode }}",
  "country": "={{ $json.shipping.country }}",
  "paymentMethod": "ethereum-sepolia",
  "paymentCurrency": "usdc",
  "payerAddress": "={{ $json.payment.walletAddress }}"
}
```

**Process Payment**
```json
{
  "operation": "purchaseProduct",
  "serializedTransaction": "={{ $json.serializedTransaction }}",
  "paymentMethod": "ethereum-sepolia",
  "payerAddress": "={{ $json.payment.walletAddress }}"
}
```

### 6. Shopify Integration

Integrate with Shopify stores for crypto payments.

#### Workflow Steps

1. **Shopify Webhook** - New order created
2. **Extract Product Info** - Parse Shopify order data
3. **Create Crossmint Order** - Convert to Crossmint format
4. **Process Payment** - Handle crypto payment
5. **Update Shopify** - Mark order as paid

#### Configuration

**Shopify Webhook Trigger**
```json
{
  "events": ["orders/create"],
  "webhook_url": "https://your-n8n-instance.com/webhook/shopify-order"
}
```

**Extract Product Info (Code)**
```javascript
const shopifyOrder = $input.first().json;

return [{
  json: {
    productLocator: `shopify:${shopifyOrder.line_items[0].product_id}:default`,
    customer: {
      email: shopifyOrder.customer.email,
      name: `${shopifyOrder.customer.first_name} ${shopifyOrder.customer.last_name}`
    },
    shipping: shopifyOrder.shipping_address,
    totalPrice: shopifyOrder.total_price
  }
}];
```

## Advanced Use Cases

### 7. Subscription Payment System

Automated recurring payments using Crossmint wallets.

#### Workflow Steps

1. **Cron Trigger** - Daily subscription check
2. **Get Active Subscriptions** - Query database
3. **Process Each Subscription** - Loop through subscriptions
4. **Check Wallet Balance** - Verify sufficient funds
5. **Create Payment** - Process subscription payment
6. **Update Records** - Mark payment processed
7. **Handle Failures** - Retry or suspend subscription

#### Configuration

**Cron Trigger**
```json
{
  "rule": "0 9 * * *",
  "timezone": "America/New_York"
}
```

**Check Balance**
```json
{
  "operation": "getBalance",
  "balanceLocatorType": "email",
  "balanceWalletEmail": "={{ $json.customerEmail }}",
  "balanceWalletChainType": "evm",
  "tokens": "usdc"
}
```

**Process Payment**
```json
{
  "operation": "transferToken",
  "blockchainType": "evm",
  "originWallet": {
    "mode": "email",
    "value": "={{ $json.customerEmail }}"
  },
  "recipientWallet": {
    "mode": "address",
    "value": "company-treasury-address"
  },
  "tokenChain": "ethereum-sepolia",
  "tokenName": "usdc",
  "amount": "={{ $json.subscriptionAmount }}"
}
```

### 8. Multi-Signature Wallet Management

Implement multi-signature approval workflow.

#### Workflow Steps

1. **HTTP Trigger** - Transaction proposal
2. **Store Proposal** - Save to database
3. **Notify Signers** - Send approval requests
4. **Collect Signatures** - Wait for approvals
5. **Execute Transaction** - When threshold met
6. **Broadcast Result** - Notify all parties

#### Configuration

**Store Proposal (Database)**
```json
{
  "operation": "insert",
  "table": "transaction_proposals",
  "data": {
    "id": "={{ $json.proposalId }}",
    "from": "={{ $json.fromAddress }}",
    "to": "={{ $json.toAddress }}",
    "amount": "={{ $json.amount }}",
    "status": "pending",
    "signatures": [],
    "created_at": "={{ $now }}"
  }
}
```

## AI-Powered Workflows

### 9. AI Shopping Assistant

AI-powered workflow that processes natural language purchase requests.

#### Workflow Steps

1. **Telegram Bot** - Receive message
2. **OpenAI Processing** - Extract purchase intent
3. **Product Search** - Find matching products
4. **User Confirmation** - Request approval
5. **Process Purchase** - Execute order
6. **Delivery Tracking** - Monitor shipment

#### Configuration

**OpenAI Processing**
```json
{
  "model": "gpt-4",
  "messages": [
    {
      "role": "system",
      "content": "Extract product details from user message. Return JSON with product name, quantity, and price range."
    },
    {
      "role": "user",
      "content": "={{ $json.message.text }}"
    }
  ]
}
```

**Product Search (Code)**
```javascript
const aiResponse = $input.first().json;
const productDetails = JSON.parse(aiResponse.choices[0].message.content);

// Search Amazon for matching products
const searchQuery = productDetails.productName;
const amazonUrl = `https://www.amazon.com/s?k=${encodeURIComponent(searchQuery)}`;

return [{
  json: {
    searchQuery,
    amazonUrl,
    estimatedPrice: productDetails.priceRange,
    quantity: productDetails.quantity
  }
}];
```

### 10. Smart Contract Interaction

Interact with smart contracts through Crossmint wallets.

#### Workflow Steps

1. **API Trigger** - Contract interaction request
2. **Validate Parameters** - Check input data
3. **Prepare Transaction** - Build contract call
4. **Sign Transaction** - Sign with wallet
5. **Submit to Blockchain** - Execute transaction
6. **Monitor Status** - Track confirmation

#### Configuration

**Prepare Transaction (Code)**
```javascript
const { contractAddress, functionName, parameters } = $input.first().json;

// Build contract interaction data
const contractCall = {
  to: contractAddress,
  data: encodeFunctionCall(functionName, parameters),
  value: "0"
};

return [{ json: contractCall }];
```

## Error Handling Patterns

### 11. Robust Error Handling

Implement comprehensive error handling and retry logic.

#### Workflow Steps

1. **Try Operation** - Attempt main operation
2. **Catch Errors** - Handle failures
3. **Retry Logic** - Implement backoff
4. **Fallback Actions** - Alternative approaches
5. **Notification** - Alert on persistent failures

#### Configuration

**Error Handling (Code)**
```javascript
const maxRetries = 3;
let attempt = 0;

while (attempt < maxRetries) {
  try {
    // Attempt operation
    const result = await performOperation();
    return [{ json: { success: true, result } }];
  } catch (error) {
    attempt++;
    
    if (attempt >= maxRetries) {
      // Send alert
      await sendAlert(`Operation failed after ${maxRetries} attempts: ${error.message}`);
      return [{ json: { success: false, error: error.message } }];
    }
    
    // Wait before retry (exponential backoff)
    await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
  }
}
```

### 12. Transaction Monitoring

Monitor transaction status and handle different outcomes.

#### Workflow Steps

1. **Submit Transaction** - Initial transaction
2. **Wait for Confirmation** - Monitor blockchain
3. **Check Status** - Verify completion
4. **Handle Success** - Process successful transaction
5. **Handle Failure** - Retry or refund

#### Configuration

**Monitor Transaction (Code)**
```javascript
const transactionHash = $input.first().json.transactionHash;
const maxWaitTime = 300000; // 5 minutes
const checkInterval = 10000; // 10 seconds

let elapsed = 0;

while (elapsed < maxWaitTime) {
  const status = await checkTransactionStatus(transactionHash);
  
  if (status === 'confirmed') {
    return [{ json: { status: 'success', transactionHash } }];
  } else if (status === 'failed') {
    return [{ json: { status: 'failed', transactionHash } }];
  }
  
  await new Promise(resolve => setTimeout(resolve, checkInterval));
  elapsed += checkInterval;
}

return [{ json: { status: 'timeout', transactionHash } }];
```

## Best Practices

### Workflow Design

1. **Modular Design**: Break complex workflows into smaller, reusable components
2. **Error Handling**: Always include error handling and retry logic
3. **Logging**: Add logging nodes for debugging and monitoring
4. **Testing**: Test workflows in staging environment first

### Security Considerations

1. **Credential Management**: Use n8n's credential system for sensitive data
2. **Input Validation**: Validate all external inputs
3. **Rate Limiting**: Implement rate limiting for public endpoints
4. **Monitoring**: Monitor for unusual activity patterns

### Performance Optimization

1. **Parallel Processing**: Use parallel branches where possible
2. **Caching**: Cache frequently accessed data
3. **Batch Operations**: Group similar operations together
4. **Resource Management**: Clean up resources after use

These workflow examples provide a foundation for building sophisticated automation using the Crossmint n8n community node. Adapt and extend these patterns to meet your specific use cases.
