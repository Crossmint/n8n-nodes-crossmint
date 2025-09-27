# n8n Community Node for Crossmint

## Table of Contents

- [Installation](#-installation-local-development-setup)
- [Your First Workflow Using Crossmint](#️-your-first-workflow-using-crossmint)
  - [Step 1: Add the Crossmint Node to Your Workflow](#step-1-add-the-crossmint-node-to-your-workflow)
  - [Step 2: Set Up Crossmint Project & Credentials](#step-2-set-up-crossmint-project--credentials)
  - [Getting Test USDC for Staging](#getting-test-usdc-for-staging)
- [Supported Operations](#-supported-operations)
  - [Resource: Wallet](#resource-wallet)
  - [Resource: Checkout](#resource-checkout)
- [API Reference](#-api-reference)
  - [Wallet Operations](#wallet-operations)
  - [Checkout Operations](#checkout-operations)
  - [Additional Resources](#additional-resources)
- [Understanding Wallet Locators](#-understanding-wallet-locators)
  - [Locator Types](#locator-types)
  - [Chain Types](#chain-types)
  - [Best Practices](#best-practices)
- [Admin Signer Private Key](#-admin-signer-private-key)
- [Example Workflows](#-example-workflows)
- [License](#-license)

This community node for n8n provides a complete integration with Crossmint's **Wallet** and **Checkout** APIs. It allows users and AI agents to program digital money inside wallets, and automate the purchase of physical products all within your n8n workflows.

### 🏗️ Recent Updates
- **Modular Architecture**: Refactored codebase into organized modules for better maintainability
- **Enhanced Error Handling**: Improved error reporting with proper API error propagation
- **Development Workflow**: Added `npm run dev` for automatic rebuilds during development
- **Code Quality**: Fixed all linting issues and added comprehensive type safety

## 🚀 Installation (Local Development Setup)


For now you have to run the Crossmint node from source:

1.  **Clone the repository:** (anywhere in your disk - doesn't need to be inside the n8n folder)
    ```bash
    git clone https://github.com/Crossmint/n8n-nodes-crossmint.git
    cd n8n-nodes-crossmint
    ```
2.  **Install dependencies and build:**
    ```bash
    npm install
    npm run build
    ```

    **Development Commands:**
    ```bash
    sudo npm run dev          # Run in development mode with auto-reload
    ```


> **📝 Note**: You must use the self-hosted version of n8n to run Crossmint nodes. Follow [this guide](https://docs.n8n.io/integrations/creating-nodes/build/n8n-node/) to set it up.


## ⚙️ Your First Workflow Using Crossmint

Once you've installed the community node, here's how to add and configure your first Crossmint node:

### Step 1: Add the Crossmint Node to Your Workflow

1. In your n8n workflow editor, click the **"+"** button to add a new node
2. Search for **"Crossmint"** in the node library
3. Select the **Crossmint** node from the results

<div align="center">
<img src="./images/crossmint-search.png" alt="Crossmint node search" width="50%">
</div>


4. For this example, we'll use **"Get or Create Wallet"** operation:

<div align="center">
<img src="./images/crossmint-config.png" alt="Crossmint node configuration" width="50%">
</div>


### Step 2: Set Up Crossmint Project & Credentials

5. First, create a Crossmint project in Staging:
   - Go to [Crossmint Staging Console](https://staging.crossmint.com/console/overview)
   - Create a new project or select an existing one
   - Copy your **server-side API key** from the project settings

<div align="center">
<img src="./images/crossmint-staging-console.png" alt="Crossmint staging console" width="75%">
</div>


6. Back in n8n, in your Crossmint node, click on **"Credential to connect with"** dropdown
7. Select **"Create New"** to add your Crossmint credentials (this will be available for all future Crossmint nodes)

8. In the credential configuration:
   - Enter your Crossmint **API Key** (must be a **server-side** API key)
   - Set **Environment** to **"Staging"** for testing
   - Click **"Save"**

<div align="center">
<img src="./images/credential-form.png" alt="Crossmint API credential form" width="75%">
</div>


9. Complete the wallet configuration (e.g., set Owner Type to "Email" and enter an email address)

<div align="center">
<img src="./images/completed-config.png" alt="Completed node configuration" width="50%">
</div>


> **⚠️ Important**: Always use **server-side API keys** from Crossmint. Client-side keys will not work. For initial testing, always use **Staging** environment.

### Getting Test USDC for Staging

To test transactions in staging, you'll need test USDC tokens. You can get them from:

- **Circle Faucet**: [https://faucet.circle.com/](https://faucet.circle.com/) - Get free testnet USDC
- **Crossmint Telegram**: [https://t.me/crossmintdevs](https://t.me/crossmintdevs) - Request USDC from Crossmint

## 💡 Supported Operations

The node is organized into two primary resources: **Wallet** and **Checkout**.

### Resource: Wallet
Operations for managing blockchain wallets which can hold and transfer money (in cryptocurrencies like USDC).

* **Get or Create Wallet**: Creates a non-custodial smart wallet or retrieves an existing one. You maintain full control via a private key that authorizes all transactions. This operation is idempotent.
  - `Chain Type` - Blockchain type (solana)
  - `Owner Type` - Optional owner identifier type (email, userId, phone, twitter, x, none)
  - `Owner Details` - Specific owner information based on selected type
  - `Admin Signer` - Private key that authorizes all transactions from this wallet ([see Admin Signer Private Key](#🔐-admin-signer-private-key))

* **Get Wallet**: Retrieves wallet details using its wallet locator (address, email, user ID, etc.).
  - `Wallet` - Wallet identifier (address, email, userId, phone, twitter, x)
  - `Chain Type` - Required for non-address locators (solana)

* **Create Transfer**: Sends tokens (like USDC) between wallets. Requires the wallet's private key to digitally sign and authorize the transfer.
  - `Blockchain Type` - Network type for both wallets (solana)
  - `Origin Wallet` - Source wallet for the transfer
  - `Recipient Wallet` - Destination wallet for the transfer
  - `Token Chain` - Specific blockchain network (e.g., solana, solana-devnet)
  - `Token Name` - Token symbol or identifier (e.g., usdc)
  - `Amount` - Token amount to transfer

* **Get Balance**: Checks token balances for a wallet across one or more blockchain networks.
  - `Wallet` - Wallet locator to check balance for (address, email, userId, phone, twitter, x)
  - `Chain Type` - Required for non-address locators (solana)
  - `Chains` - Blockchain network to query (e.g., solana, solana-devnet)
  - `Tokens` - Comma-separated list of token symbols to query

* **Sign Transaction**: Signs a transaction with a private key and submits the signature to complete pending transactions.
  - `Chain` - Blockchain network for transaction signing
  - `Wallet Address` - Wallet address from Create Transfer response
  - `Transaction ID` - Transaction ID that needs approval
  - `Transaction Data` - Hash or message to sign from transfer response
  - `Signer Address` - Address of the external signer
  - `Signer Private Key` - Private key to sign the transaction
  - `Wait for Completion` - Poll until transaction reaches final status

### Resource: Checkout
Operations to automate the purchase of products using digital money (e.g. tokens like USDC). This is a two-step process.

* **Create Order**: Creates a purchase order for a product from Amazon or Shopify.
  - `Platform` - E-commerce platform (amazon or shopify)
  - `Product Identifier` - Product URL or ASIN/ID from platform (e.g., Amazon URL or ASIN like B01DFSADS2)
  - `Recipient Email` - Email address for order confirmation
  - `Recipient Name` - Full name for shipping address
  - `Address Line 1` - Primary shipping address
  - `Address Line 2` - Secondary address (optional)
  - `City` - Shipping city
  - `State` - Shipping state/province (optional)
  - `Postal Code` - ZIP/postal code
  - `Country` - Shipping country (Amazon: US only, Shopify: varies by store)
  - `Environment` - Environment to use for payment methods (Staging/Testnet or Production/Mainnet)
  - `Payment Method` - Blockchain network for payment
  - `Payment Currency` - Currency for payment (e.g., usdc)
  - `Payer Address` - Wallet address that will pay for the order

* **Pay Order**: Executes the payment for a previously created order using the serialized transaction from Create Order.
  - `Serialized Transaction` - Transaction data from Create Order response
  - `Payment Chain` - Blockchain network for payment
  - `Payer Wallet Address` - Wallet address making the payment
  - `Private Key` - Private key to authorize the payment


## 📖 API Reference

For detailed information about each operation, parameters, and response formats, refer to the official Crossmint API documentation:

### Wallet Operations
- **Get or Create Wallet**: [Crossmint Wallets API](https://docs.crossmint.com/api-reference/wallets/create-wallet)
- **Get Wallet**: [Crossmint Wallets API - Get Wallet](https://docs.crossmint.com/api-reference/wallets/get-wallet-by-locator)
- **Create Transfer**: [Crossmint Wallets API - Transfer Tokens](https://docs.crossmint.com/api-reference/wallets/transfer-token)
- **Get Balance**: [Crossmint Wallets API - Get Balance](https://docs.crossmint.com/api-reference/wallets/get-wallet-balance)
- **Sign Transaction**: [Crossmint Wallets API - Submit Approvals](https://docs.crossmint.com/api-reference/wallets/submit-transaction-approvals)

### Checkout Operations
- **Create Order**: [Crossmint Checkout API - Create Order](https://docs.crossmint.com/api-reference/headless/create-order)
- **Pay Order**: [Crossmint Checkout API - Submit Transaction](https://docs.crossmint.com/api-reference/wallets/create-transaction)


### Additional Resources
- [Supported Chains and Tokens](https://docs.crossmint.com/introduction/supported-chains#supported-chains)

## 🔑 Understanding Wallet Locators

Wallet locators are a key concept used throughout all Crossmint node operations. They provide a flexible way to identify and reference wallets using different types of identifiers.

### Locator Types

| Type | Format | Example | Use Case |
|------|--------|---------|----------|
| **Wallet Address** | `1A1z...` | `1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa` | Direct blockchain address reference |
| **Email** | `email:{email}:{chainType}:smart` | `email:user@example.com:solana:smart` | User identification by email |
| **User ID** | `userId:{id}:{chainType}:smart` | `userId:user-123:solana:smart` | Custom user identifier |
| **Phone Number** | `phoneNumber:{phone}:{chainType}:smart` | `phoneNumber:+1234567890:solana:smart` | SMS-based identification |
| **Twitter Handle** | `twitter:{handle}:{chainType}:smart` | `twitter:username:solana:smart` | Social media identification |
| **X Handle** | `x:{handle}:{chainType}:smart` | `x:username:solana:smart` | X (formerly Twitter) identification |


For more detailed information about wallet locator formats and specifications, see: [Crossmint Wallet Locators Documentation](https://docs.crossmint.com/api-reference/wallets/get-wallet-by-locator)

### Chain Types

- **Solana**: Solana blockchain

### Best Practices

1. **Email locators** are ideal for user-friendly identification
2. **Wallet addresses** provide direct blockchain access
3. **User ID locators** work well with existing user management systems
4. Always specify the correct chain type for non-address locators

## 🔐 Admin Signer Private Key

The **Admin Signer Private Key** is a critical security component that gives you full control over your Crossmint wallet. Understanding how it works is essential for secure wallet management.

### What is an Admin Signer?

The Admin Signer is the private key that acts as the "master key" for your smart wallet. It's used to:
- **Authorize all transactions** from the wallet
- **Sign transfer approvals** when moving tokens
- **Control wallet permissions** and operations

### Key Requirements by Blockchain

**For Solana:**
- Format: Base58 encoded string
- Example: `5Kb8kLf9CJtPkDCe4jfE9TjC8d7X9e3Jh4F6h8F2K3h7J9F4K6h8F2K3h7J9F4K6h`
- Typically 64 bytes when decoded

### Generating Private Keys

You can generate secure private keys using:
- **Crossmint Generator**: [https://www.val.town/x/Crossmint/crypto-address-generator](https://www.val.town/x/Crossmint/crypto-address-generator)
- **Phantom Wallet**: Export private key from an existing Solana wallet
- **Solana CLI**: Generate Solana keypairs
- **Hardware wallets**: Export or derive keys securely

### Security Best Practices

⚠️ **Critical Security Guidelines:**

1. **Never share** your private key with anyone
2. **Store securely** - use environment variables or secure vaults
3. **Use different keys** for staging vs production
4. **Backup safely** - store in multiple secure locations
5. **Test first** - always test with small amounts on testnet
6. **Rotate regularly** - consider changing keys periodically

### How It Works in Crossmint

1. **Wallet Creation**: Your private key becomes the admin signer for the smart wallet
2. **Transaction Flow**:
   - Create transaction → Crossmint generates approval request
   - Sign with private key → Submit signature to complete transaction
3. **Non-Custodial**: You control the key, you control the wallet

## 📁 Example Workflows

Ready-to-use workflow examples are available in the `workflows-examples/` folder:

- [buy-celsius.json](workflows-examples/buy-celsius.json): Complete flow demonstrating wallet operations (get wallet, check balance) followed by checkout (create order and pay order).

<div align="center">
<img src="./images/buy-celsius.png" alt="Buy Celsius workflow" width="100%">
</div>

- [buy-items-amazon.json](workflows-examples/buy-items-amazon.json): Advanced workflow with AI-powered order processing that accepts free-form messages via Chat (can be Telegram), extracts order details using OpenAI, and automatically purchases Amazon products.

<div align="center">
<img src="./images/buy-items-from-amazon.png" alt="Buy items from Amazon workflow" width="100%">
</div>

To use these examples:
1. Import the JSON file into your n8n instance
2. Configure your Crossmint API credentials
3. Update any personal information (email addresses, wallet addresses, etc.)
4. Execute the workflow

## 📄 License

MIT

-----
