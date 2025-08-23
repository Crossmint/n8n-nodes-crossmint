# n8n Community Node for Crossmint


This community node for n8n provides a complete integration with Crossmint's **Wallet** and **Checkout** APIs. It allows users and AI agents to program digital money inside wallets, and automate the purchase of physical products all within your n8n workflows.

## 🚀 Installation

1.  Go to your n8n instance.
2.  From the menu, go to **Settings > Community Nodes**.
3.  Click on **Install a community node**.
4.  Enter the npm package name: `n8n-nodes-crossmint`.
5.  Click **Install**.

Once installed, the "Crossmint" node will appear in your workflow editor.

## ⚙️ Your First Crossmint Node in n8n

Once you've installed the community node, here's how to add and configure your first Crossmint node:

### Step 1: Add the Crossmint Node to Your Workflow

1. In your n8n workflow editor, click the **"+"** button to add a new node
2. Search for **"Crossmint"** in the node library
3. Select the **Crossmint** node from the results

![Crossmint node search](./images/crossmint-search.png)

4. For this example, we'll use **"Get or Create Wallet"** operation:
   - Set **Resource** to **"Wallet"**
   - Set **Operation** to **"Get or Create Wallet"**

![Crossmint node configuration](./images/crossmint-config.png)

### Step 2: Set Up Crossmint Project & Credentials

5. First, create a Crossmint project in Staging:
   - Go to [Crossmint Staging Console](https://staging.crossmint.com/console/overview)
   - Create a new project or select an existing one
   - Copy your **server-side API key** from the project settings

![Crossmint staging console](./images/crossmint-staging-console.png)

6. Back in n8n, in your Crossmint node, click on **"Credential for Crossmint API"** dropdown
7. Select **"Create New"** to add your Crossmint credentials (this will be available for all future Crossmint nodes)

8. In the credential configuration:
   - Enter your Crossmint **API Key** (must be a **server-side** API key)
   - Set **Environment** to **"Staging"** for testing
   - Click **"Save"**

![Crossmint API credential form](./images/credential-form.png)

9. Complete the wallet configuration (e.g., set Owner Type to "Email" and enter an email address)

![Completed node configuration](./images/completed-config.png)

> **⚠️ Important**: Always use **server-side API keys** from Crossmint. Client-side keys will not work. For initial testing, always use **Staging** environment.

### Getting Test USDC for Staging

To test transactions in staging, you'll need test USDC tokens. You can get them from:

- **Circle Faucet**: [https://faucet.circle.com/](https://faucet.circle.com/) - Get free testnet USDC
- **Crossmint Telegram**: [https://t.me/crossmintdevs](https://t.me/crossmintdevs) - Request help from the community

## 💡 Supported Operations

The node is organized into two primary resources: **Wallet** and **Checkout**.

### Resource: Wallet
Operations for managing blockchain wallets which can hold and transfer money (in cryptocurrencies like USDC).

* **Get or Create Wallet**: Creates a new Wallet or retrieves an existing one if it's already associated with a user identifier on a specific blockchain. This operation is idempotent.
* **Get Wallet**: Retrieves the details of an existing wallet using its `walletLocator`.
* **Transfer Token**: Sends tokens (like USDC) from a Crossmint wallet to any other address or user.
* **Get Balance**: Checks the balance of native and other tokens (like USDC) for a specific wallet on one or more chains.

### Resource: Checkout
Operations to automate the purchase of products using digital money (e.g. tokens like USDC). This is a two-step process.

* **1. Create Order**:
    * **Function**: Creates a purchase order for a product from Amazon or Shopify.
    * **Key Input**: Product URL or identifier, recipient details (name, email, physical address), and payment details (which cryptocurrency to use and from which wallet to pay).
    * **Key Output**: Returns an order object containing the final price and, most importantly, a `serializedTransaction`. This serialized transaction is the "payment authorization" needed for the next step.

* **2. Pay Order**:
    * **Function**: Executes the payment for a previously created order.
    * **Key Input**: The `serializedTransaction` obtained from the "Create Order" step.
    * **Key Output**: The transaction confirmation once it's submitted to the blockchain, with a `pending` status.

## 📖 API Reference

For detailed information about each operation, parameters, and response formats, refer to the official Crossmint API documentation:

### Wallet Operations
- **Get or Create Wallet**: [Crossmint Wallets API](https://docs.crossmint.com/api-reference/wallets/create-wallet)
- **Get Wallet**: [Crossmint Wallets API - Get Wallet](https://docs.crossmint.com/api-reference/wallets/get-wallet-by-locator)
- **Transfer Token**: [Crossmint Wallets API - Transfer Tokens](https://docs.crossmint.com/api-reference/wallets/transfer-token)
- **Get Balance**: [Crossmint Wallets API - Get Balance](https://docs.crossmint.com/api-reference/wallets/get-wallet-balance)

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
| **Wallet Address** | `0x...` | `0x1234567890123456789012345678901234567890` | Direct blockchain address reference |
| **Email** | `email:{email}:{chainType}:smart` | `email:user@example.com:evm:smart` | User identification by email |
| **User ID** | `userId:{id}:{chainType}:smart` | `userId:user-123:evm:smart` | Custom user identifier |
| **Phone Number** | `phoneNumber:{phone}:{chainType}:smart` | `phoneNumber:+1234567890:evm:smart` | SMS-based identification |
| **Twitter Handle** | `twitter:{handle}:{chainType}:smart` | `twitter:username:evm:smart` | Social media identification |
| **X Handle** | `x:{handle}:{chainType}:smart` | `x:username:evm:smart` | X (formerly Twitter) identification |
| **Me** | `me:{chainType}:smart` | `me:evm:smart` | API key owner's wallet |

For more detailed information about wallet locator formats and specifications, see: [Crossmint Wallet Locators Documentation](https://docs.crossmint.com/api-reference/wallets/get-wallet-by-locator)

### Chain Types

- **EVM**: Ethereum Virtual Machine compatible chains (Ethereum, Polygon, Base, Arbitrum, etc.)
- **Solana**: Solana blockchain

### Best Practices

1. **Email locators** are ideal for user-friendly identification
2. **Wallet addresses** provide direct blockchain access
3. **"Me" locators** are perfect for API key owner operations
4. **User ID locators** work well with existing user management systems
5. Always specify the correct chain type for non-address locators

## 📁 Example Workflows

Ready-to-use workflow examples are available in the `workflows-examples/` folder:

- **`crossmint-nodes-examples.json`**: Complete workflow demonstrating all wallet operations (create wallet, get wallet details, check balance) followed by a checkout flow (create order and pay order).
- **`buy-items-from-amazon.json`**: Advanced workflow with AI-powered order processing that accepts free-form messages via Telegram, extracts order details using OpenAI, and automatically purchases Amazon products.

To use these examples:
1. Import the JSON file into your n8n instance
2. Configure your Crossmint API credentials
3. Update any personal information (email addresses, wallet addresses, etc.)
4. Execute the workflow

## 📄 License

MIT

-----

## 🛠️ Development Setup

For contributing to this project:

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/YourUsername/n8n-nodes-crossmint.git](https://github.com/YourUsername/n8n-nodes-crossmint.git)
    cd n8n-nodes-crossmint
    ```
2.  **Install dependencies and build:**
    ```bash
    npm install
    npm run build
    ```
3.  **Link your node for testing:**
    ```bash
    npm link
    cd ~/.n8n/
    npm link n8n-nodes-crossmint
    ```
4.  Start n8n in a separate terminal (`n8n start`) and your node will appear.

### Quick Setup for Testing Locally (Recommended)

If you want to test the node locally without installing it globally:

1. **Install n8n globally:**
   ```bash
   npm install n8n -g
   ```

2. **Install the Crossmint node:**
   ```bash
   npm install n8n-nodes-crossmint
   ```

3. **Start n8n:**
   ```bash
   n8n start
   ```

4. **Configure the community node:**
   - Open your browser and go to the n8n interface (usually `http://localhost:5678`)
   - Click on **Settings** (bottom left corner)
   - Go to **Community Nodes**
   - Click **Install a community node**
   - Enter: `n8n-nodes-crossmint`
   - Click **Install**

For more information about n8n installation, see: [n8n Installation Guide](https://docs.n8n.io/hosting/installation/npm/#try-n8n-with-npx)
