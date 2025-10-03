# 📖 Explanation: How Crossmint Handles Wallet Custody in n8n

> 🧭 Understand the design principles behind how wallets are created, owned, and accessed in the n8n Crossmint integration.

This article explains what **wallet custody** means in the context of the n8n Crossmint integration, the trade-offs of the design choices, and how developers can reason about security, control, and flexibility when building automated workflows.

---

## 💡 What is Wallet Custody?

In Web3, **custody** refers to who controls the private keys that manage a wallet's assets.

- In **non-custodial wallets**, the user holds the keys (for example, MetaMask).
- In **custodial wallets**, a service provider holds and manages the keys on behalf of the user.

The n8n Crossmint integration operates with a **non-custodial model** using external wallet signers, enabling developers to maintain full control over wallet private keys while leveraging Crossmint's infrastructure for workflow automation.

---

## 🔐 Crossmint's Custody Model in n8n

When a developer creates a wallet using the n8n Crossmint node:

- Developers provide their own private keys as **admin signers** (base58 encoded for Solana).
- Crossmint creates smart wallets linked to these external signers.
- Wallets can optionally be associated with developer-defined user identifiers (for example, `email:user@example.com` or `userId:user-123`).
- Only workflows with access to the admin signer private key can authorize transactions.

This means:

- Developers retain complete custody and control over wallet private keys.
- Private keys remain external to Crossmint's infrastructure.
- Automated workflows can execute transactions programmatically while maintaining non-custodial security.

---

## 🔑 Admin Signer Private Keys

The admin signer private key is the core component of wallet custody in n8n:

- **Generation**: Developers must generate their own key pairs externally. Crossmint provides a [key generation tool](https://www.val.town/x/Crossmint/crypto-address-generator) to simplify this process.
- **Storage**: Private keys are stored within n8n workflow credentials and should be protected using environment variables or secure credential vaults.
- **Usage**: Every transaction requires signing with the admin signer private key, ensuring only authorized workflows can execute operations.
- **Derivation**: The public key and wallet address are automatically derived from the private key during wallet creation.

### Security Best Practices

When working with admin signer private keys in n8n workflows:

1. **Never share or expose private keys** in workflow outputs or logs
2. **Use n8n's credential system** to store private keys securely with password protection
3. **Separate staging and production keys** to isolate test and live environments
4. **Test with small amounts first** before deploying production workflows
5. **Implement key rotation policies** for enhanced security
6. **Monitor wallet activity** to detect unauthorized access attempts
7. **Use dedicated wallets** for automated workflows rather than personal wallets

---

## ⚖️ Trade-offs

| Benefit                                          | Limitation                                   |
|--------------------------------------------------|----------------------------------------------|
| 🔓 Complete non-custodial control                | Requires secure key management               |
| 🤖 Enables workflow automation                   | No biometric or device-based security        |
| 🚀 Instant wallet provisioning                   | Developers responsible for key security      |
| 🔐 Private keys never leave developer control    | Requires understanding of key derivation     |
| 🧑‍🤝‍🧑 Support for user-linked wallets              | Additional setup compared to hosted solutions |

---

## 🧭 When Should I Use This?

Use this custody model when:

- Building automated workflows that require programmatic wallet control
- Creating backend systems that need to execute blockchain transactions
- Implementing treasury management or payment automation
- Developing agent-based applications that operate wallets autonomously
- Requiring non-custodial architecture for compliance or security requirements

**Example use cases:**

- Automated token distribution systems
- Scheduled payment workflows
- Cross-chain treasury management
- Automated NFT minting and distribution
- Programmatic DeFi operations

---

## 🔒 How It Works

### Creating a Wallet

When you create a wallet in the n8n Crossmint node, the system:

1. Accepts your admin signer private key (base58 encoded)
2. Derives the public key and wallet address from the private key
3. Sends a request to Crossmint's API to provision a smart wallet
4. Links the wallet to the external signer address
5. Optionally associates the wallet with a user identifier

The wallet configuration specifies the admin signer as an external wallet:

```json
{
  "type": "smart",
  "chainType": "solana",
  "config": {
    "adminSigner": {
      "type": "external-wallet",
      "address": "derived-from-your-private-key"
    }
  }
}
```

### Signing Transactions

All transactions require explicit signing with the admin signer private key:

1. The workflow creates a transaction request through the Crossmint API
2. The transaction data is signed locally using your private key
3. The signature is submitted to Crossmint to authorize the transaction
4. Crossmint executes the transaction on-chain after validation

This two-step process ensures that private keys remain within your n8n environment and are never transmitted to external services.

---

## 🔗 Related Reading

- [n8n Crossmint Node README](../README.md) - Complete integration guide and setup instructions
- [Understanding Wallet Locators](../README.md#understanding-wallet-locators) - How to reference wallets by address, email, or user ID
- [Crossmint Wallets API Reference](https://docs.crossmint.com/api-reference/wallets/create-wallet) - API documentation for wallet operations
- [Crossmint Signers and Custody](https://docs.crossmint.com/wallets/signers-and-custody) - Comparison of custody models across Crossmint products
- [Key Generation Tool](https://www.val.town/x/Crossmint/crypto-address-generator) - Generate secure key pairs for testing and production

---

## 📋 Prerequisites

To use wallet custody features in n8n:

- **n8n Instance**: Self-hosted or cloud n8n instance (version 0.198.0 or higher)
- **Crossmint API Key**: Server-side API key from [Crossmint Console](https://www.crossmint.com/console)
- **Admin Signer Keys**: Generated key pairs for wallet management
- **Blockchain Knowledge**: Basic understanding of wallet addresses and transaction signing

---

## ❓ Troubleshooting

### Common Issues

**Invalid Private Key Format**
- Ensure the private key is base58 encoded for Solana
- Verify there are no leading or trailing spaces
- Check that the key length is correct (typically 88 characters for base58 Solana keys)

**Transaction Signing Failures**
- Confirm the admin signer address matches the wallet configuration
- Verify the private key corresponds to the expected public key
- Ensure the wallet has sufficient balance for transaction fees

**Security Concerns**
- Review n8n credential storage settings
- Audit workflow access permissions
- Implement monitoring for unusual wallet activity
- Consider using hardware security modules for production keys

### Getting Help

For additional support:
- Review the [n8n Crossmint Node Examples](../README.md#example-workflows)
- Check [Crossmint Documentation](https://docs.crossmint.com)
- Contact Crossmint Support at support@crossmint.com
- Join the [Crossmint Discord Community](https://discord.gg/crossmint)
