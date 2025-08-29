# Troubleshooting Guide

This guide helps you resolve common issues when using the Crossmint n8n community node.

## Table of Contents

- [Installation Issues](#installation-issues)
- [Authentication Problems](#authentication-problems)
- [Wallet Operations](#wallet-operations)
- [Transaction Issues](#transaction-issues)
- [Checkout Problems](#checkout-problems)
- [Network and Connectivity](#network-and-connectivity)
- [Development Issues](#development-issues)
- [Getting Help](#getting-help)

## Installation Issues

### Node Not Appearing in n8n

**Problem**: Crossmint node doesn't appear in the node library after installation.

**Solutions**:

1. **Verify Installation**:
   ```bash
   # Check if package is installed
   npm list n8n-nodes-crossmint
   ```

2. **Restart n8n**:
   ```bash
   # Stop n8n and restart
   n8n stop
   n8n start
   ```

3. **Check n8n Version**:
   - Ensure you're using n8n self-hosted version
   - Community nodes don't work with n8n Cloud
   - Minimum n8n version: 0.190.0+

4. **Clear n8n Cache**:
   ```bash
   # Clear n8n cache and restart
   rm -rf ~/.n8n/cache
   n8n start
   ```

### Installation Fails

**Problem**: `npm install n8n-nodes-crossmint` fails.

**Solutions**:

1. **Check Node.js Version**:
   ```bash
   node --version  # Should be >= 20.15
   ```

2. **Clear npm Cache**:
   ```bash
   npm cache clean --force
   npm install n8n-nodes-crossmint
   ```

3. **Use Different Registry**:
   ```bash
   npm install n8n-nodes-crossmint --registry https://registry.npmjs.org/
   ```

## Authentication Problems

### Invalid API Key Error

**Problem**: "Invalid API key" or "Unauthorized" errors.

**Solutions**:

1. **Verify API Key Type**:
   - Must use **server-side** API key (not client-side)
   - Get from Crossmint Console → Project Settings → API Keys

2. **Check Environment**:
   - Staging keys only work with staging environment
   - Production keys only work with production environment

3. **API Key Format**:
   - Should start with `sk_` for server keys
   - No extra spaces or characters

4. **Regenerate API Key**:
   - Create new API key in Crossmint Console
   - Update credentials in n8n

### Credential Test Fails

**Problem**: Credential validation fails when saving.

**Solutions**:

1. **Check Network Access**:
   ```bash
   # Test connectivity to Crossmint API
   curl -H "X-API-KEY: your-api-key" https://staging.crossmint.com/api/2022-06-09/collections/
   ```

2. **Verify Environment Setting**:
   - Ensure environment matches your API key
   - Try switching between staging/production

3. **Firewall/Proxy Issues**:
   - Ensure outbound HTTPS (port 443) is allowed
   - Check corporate firewall settings
   - Verify proxy configuration

## Wallet Operations

### Wallet Creation Fails

**Problem**: "Get or Create Wallet" operation fails.

**Solutions**:

1. **Check Private Key Format**:
   - **EVM**: 64-character hex string (with or without 0x prefix)
   - **Solana**: Base58 encoded string
   - Use [Crossmint Key Generator](https://www.val.town/x/Crossmint/crypto-address-generator)

2. **Verify Chain Type**:
   - Ensure chain type matches your private key
   - EVM for Ethereum-compatible chains
   - Solana for Solana blockchain

3. **Owner Type Configuration**:
   - If using owner type, ensure all required fields are filled
   - Email format: valid email address
   - Phone format: include country code (+1234567890)

### Wallet Not Found

**Problem**: "Get Wallet" operation returns wallet not found.

**Solutions**:

1. **Check Locator Format**:
   ```
   # Correct formats:
   Address: 0x742d35Cc6634C0532925a3b8D0C9e0e7C0C0C0C0
   Email: email:user@example.com:evm:smart
   User ID: userId:user-123:evm:smart
   ```

2. **Verify Chain Type**:
   - Ensure chain type matches wallet creation
   - EVM wallets need `evm` chain type
   - Solana wallets need `solana` chain type

3. **Check Environment**:
   - Wallet created in staging only exists in staging
   - Use same environment for all operations

### Balance Shows Zero

**Problem**: Wallet balance shows zero despite having funds.

**Solutions**:

1. **Check Token Symbol**:
   - Use correct token symbol: `usdc`, `eth`, `matic`, `sol`
   - Case-sensitive token names

2. **Verify Chain Parameter**:
   - Specify correct chain: `ethereum-sepolia`, `polygon`, etc.
   - Match chain where tokens were deposited

3. **Wait for Confirmation**:
   - Recent transactions may not appear immediately
   - Wait 1-2 minutes for blockchain confirmation

## Transaction Issues

### Transfer Fails

**Problem**: Token transfer operation fails or gets stuck.

**Solutions**:

1. **Check Sufficient Balance**:
   - Verify wallet has enough tokens for transfer
   - Account for gas fees (especially on Ethereum)

2. **Validate Addresses**:
   - Ensure recipient address is valid
   - Check address format matches blockchain type
   - EVM: 0x... format, Solana: base58 format

3. **Amount Format**:
   - Use decimal format: "10.5" not "10,5"
   - Don't include currency symbols
   - Check token decimals (USDC has 6 decimals)

### Transaction Signing Fails

**Problem**: "Sign Transaction" operation fails.

**Solutions**:

1. **Private Key Validation**:
   ```bash
   # EVM private key should be 64 hex characters
   echo "your-private-key" | wc -c  # Should be 64 (without 0x) or 66 (with 0x)
   ```

2. **Transaction Data Format**:
   - Ensure transaction data is properly formatted
   - Use output from previous "Create Transfer" operation

3. **Signer Address Match**:
   - Signer address must match private key
   - Verify derived address is correct

## Checkout Problems

### Product Not Found

**Problem**: "Create Order" fails with product not found.

**Solutions**:

1. **Check Product URL**:
   - Use full product URL from Amazon/Shopify
   - Ensure product is available and in stock
   - Test URL in browser first

2. **Platform Selection**:
   - Select correct platform: Amazon or Shopify
   - Match platform with product URL

3. **Geographic Restrictions**:
   - Some products may not be available in all regions
   - Check shipping restrictions

### Payment Fails

**Problem**: "Pay Order" operation fails.

**Solutions**:

1. **Serialized Transaction**:
   - Use exact output from "Create Order" operation
   - Don't modify the serialized transaction data

2. **Wallet Balance**:
   - Ensure payer wallet has sufficient funds
   - Include gas fees in balance calculation

3. **Payment Method Match**:
   - Payment method must match order creation
   - Use same blockchain and token

## Network and Connectivity

### Timeout Errors

**Problem**: Operations timeout or fail with network errors.

**Solutions**:

1. **Check Internet Connection**:
   ```bash
   # Test connectivity
   ping crossmint.com
   curl -I https://staging.crossmint.com
   ```

2. **Increase Timeout**:
   - Some operations may take longer
   - Wait up to 30 seconds for blockchain operations

3. **Retry Logic**:
   - Implement retry logic for transient failures
   - Use exponential backoff

### SSL/TLS Issues

**Problem**: SSL certificate errors.

**Solutions**:

1. **Update Certificates**:
   ```bash
   # Update system certificates
   sudo apt-get update && sudo apt-get install ca-certificates
   ```

2. **Check System Time**:
   - Ensure system clock is accurate
   - SSL certificates are time-sensitive

## Development Issues

### TypeScript Errors

**Problem**: TypeScript compilation errors during development.

**Solutions**:

1. **Install Dependencies**:
   ```bash
   npm install
   npm install --save-dev @types/node
   ```

2. **Check TypeScript Version**:
   ```bash
   npx tsc --version  # Should be 5.8.2+
   ```

3. **Clear Build Cache**:
   ```bash
   rm -rf dist/
   npm run build
   ```

### ESLint Errors

**Problem**: ESLint validation fails.

**Solutions**:

1. **Auto-fix Issues**:
   ```bash
   npm run lintfix
   ```

2. **Check Rule Configuration**:
   - Review `.eslintrc.js` for specific rules
   - Some rules are specific to n8n nodes

3. **Update Dependencies**:
   ```bash
   npm update eslint-plugin-n8n-nodes-base
   ```

### Test Failures

**Problem**: Jest tests fail during development.

**Solutions**:

1. **Update Test Dependencies**:
   ```bash
   npm install --save-dev jest ts-jest @types/jest
   ```

2. **Clear Jest Cache**:
   ```bash
   npx jest --clearCache
   npm test
   ```

3. **Check Mock Configuration**:
   - Ensure all external dependencies are mocked
   - Verify mock return values match expected format

## Getting Help

### Debug Information

When reporting issues, include:

1. **Environment Details**:
   - n8n version: `n8n --version`
   - Node.js version: `node --version`
   - Operating system
   - Package version: `npm list n8n-nodes-crossmint`

2. **Error Details**:
   - Complete error message
   - Steps to reproduce
   - Workflow configuration (remove sensitive data)

3. **Network Information**:
   - Are you behind a corporate firewall?
   - Using VPN or proxy?
   - Geographic location

### Support Channels

1. **GitHub Issues**:
   - [Report bugs](https://github.com/Crossmint/n8n-nodes-crossmint/issues)
   - Search existing issues first

2. **Crossmint Support**:
   - Email: support@crossmint.com
   - For API-related questions

3. **n8n Community**:
   - [n8n Community Forum](https://community.n8n.io/)
   - For general n8n questions

4. **Documentation**:
   - [Crossmint Docs](https://docs.crossmint.com/)
   - [n8n Documentation](https://docs.n8n.io/)

### Enable Debug Logging

For detailed debugging:

1. **n8n Debug Mode**:
   ```bash
   export N8N_LOG_LEVEL=debug
   n8n start
   ```

2. **Workflow Execution Logs**:
   - Check execution logs in n8n interface
   - Look for detailed error messages

3. **Network Debugging**:
   ```bash
   # Monitor network requests
   export NODE_DEBUG=http,https
   n8n start
   ```

### Common Solutions Summary

| Problem | Quick Fix |
|---------|-----------|
| Node not visible | Restart n8n |
| Invalid API key | Check environment setting |
| Wallet not found | Verify locator format |
| Transfer fails | Check balance and addresses |
| Timeout errors | Check internet connection |
| Build fails | Clear cache and rebuild |

Remember: Most issues are related to configuration or network connectivity. Double-check your settings and credentials before seeking help.
