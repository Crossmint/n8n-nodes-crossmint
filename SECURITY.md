# Security Policy

## Supported Versions

We actively support the following versions of n8n-nodes-crossmint with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 0.3.x   | :white_check_mark: |
| 0.2.x   | :white_check_mark: |
| < 0.2   | :x:                |

## Reporting a Vulnerability

We take the security of n8n-nodes-crossmint seriously. If you discover a security vulnerability, please follow these steps:

### 1. Do NOT Create a Public Issue

Please do not report security vulnerabilities through public GitHub issues, discussions, or pull requests.

### 2. Report Privately

Send your security report to: **security@crossmint.com**

Include the following information:
- Description of the vulnerability
- Steps to reproduce the issue
- Potential impact assessment
- Any suggested fixes or mitigations

### 3. Response Timeline

- **Initial Response**: Within 48 hours of receiving your report
- **Status Update**: Within 7 days with our assessment
- **Resolution**: Security fixes will be prioritized and released as soon as possible

### 4. Responsible Disclosure

We follow responsible disclosure practices:
- We will acknowledge receipt of your vulnerability report
- We will provide regular updates on our progress
- We will notify you when the vulnerability is fixed
- We will publicly disclose the vulnerability after a fix is released (with your permission)

## Security Best Practices

### API Key Management

**Critical Security Requirements:**

1. **Never commit API keys to version control**
   - Use n8n's credential system exclusively
   - Never hardcode keys in workflow configurations
   - Regularly rotate API keys

2. **Use Server-Side API Keys Only**
   - Client-side API keys will not work and are less secure
   - Obtain server-side keys from Crossmint Console
   - Store keys securely in n8n credentials

3. **Environment Separation**
   - Use staging environment for development and testing
   - Only use production keys for live workflows
   - Never mix staging and production credentials

### Private Key Security

**For Transaction Signing:**

1. **Private Key Storage**
   - Store private keys securely using n8n's password-protected credential fields
   - Never log or expose private keys in workflow outputs
   - Use hardware wallets or secure key management systems when possible

2. **Key Generation**
   - Generate private keys using cryptographically secure methods
   - Use the recommended key generation tools mentioned in documentation
   - Never reuse private keys across different environments

3. **Access Control**
   - Limit access to workflows containing private keys
   - Use n8n's user permission system to restrict access
   - Regularly audit who has access to sensitive workflows

### Network Security

1. **HTTPS Only**
   - All API communications use HTTPS
   - Verify SSL certificates are properly validated
   - Never disable SSL verification

2. **Firewall Configuration**
   - Restrict outbound connections to necessary Crossmint endpoints only
   - Monitor network traffic for unusual patterns
   - Use VPN or private networks when possible

### Workflow Security

1. **Input Validation**
   - Validate all user inputs in workflows
   - Sanitize data before processing
   - Use n8n's built-in validation features

2. **Error Handling**
   - Implement proper error handling to prevent information leakage
   - Never expose sensitive data in error messages
   - Log security events appropriately

3. **Data Handling**
   - Minimize storage of sensitive data
   - Use secure data transmission methods
   - Implement data retention policies

## Known Security Considerations

### 1. Credential Exposure

**Risk**: API keys or private keys could be exposed in workflow logs or outputs.

**Mitigation**:
- Use n8n's credential system with password protection
- Never include credentials in workflow node outputs
- Regularly review workflow execution logs

### 2. Transaction Replay Attacks

**Risk**: Signed transactions could be replayed if not properly protected.

**Mitigation**:
- Use nonces and proper transaction sequencing
- Implement transaction expiration where applicable
- Monitor for duplicate transactions

### 3. Man-in-the-Middle Attacks

**Risk**: API communications could be intercepted.

**Mitigation**:
- All communications use HTTPS with certificate validation
- Verify API endpoint URLs are correct
- Use certificate pinning where possible

## Security Updates

### Automatic Updates

- Security patches are released as soon as possible
- Update to the latest version promptly
- Subscribe to GitHub releases for notifications

### Security Advisories

- Security advisories are published on GitHub Security tab
- Critical vulnerabilities are announced via multiple channels
- Follow [@crossmint](https://twitter.com/crossmint) for security announcements

## Compliance and Standards

### Industry Standards

This project follows security best practices including:
- OWASP guidelines for web application security
- Cryptocurrency security standards
- n8n community node security requirements

### Audit Information

- Regular security reviews are conducted
- Third-party security audits may be performed
- Vulnerability scanning is performed on dependencies

## Contact Information

For security-related questions or concerns:

- **Security Issues**: security@crossmint.com
- **General Support**: support@crossmint.com
- **Documentation**: [Crossmint Security Documentation](https://docs.crossmint.com/security)

## Acknowledgments

We appreciate the security research community and will acknowledge researchers who responsibly disclose vulnerabilities (with their permission).

---

**Remember**: Security is a shared responsibility. Please follow these guidelines and report any security concerns promptly.
