# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2025-08-29

### Added
- Comprehensive documentation suite including CONTRIBUTING.md, API_REFERENCE.md, TROUBLESHOOTING.md
- Enhanced README.md with improved structure and examples
- Detailed workflow examples documentation
- Development and testing guides

### Changed
- Improved project documentation structure and organization
- Enhanced code examples and usage instructions

### Fixed
- Documentation gaps and missing developer guidelines

## [0.2.x] - Previous Releases

### Added
- Transaction signing functionality with private key support
- Support for both EVM and Solana blockchain operations
- Wallet creation and management operations
- Token transfer capabilities
- Balance checking functionality
- Checkout operations for e-commerce integration
- Support for multiple wallet locator types (email, userId, phone, etc.)
- Comprehensive test suite with Jest
- ESLint configuration with n8n-specific rules

### Features
- **Wallet Operations**:
  - Get or Create Wallet
  - Get Wallet by locator
  - Transfer tokens between wallets
  - Get wallet balance
  - Sign and submit transactions

- **Checkout Operations**:
  - Create orders for Amazon/Shopify products
  - Process payments with cryptocurrency
  - Support for physical product delivery

- **Multi-Environment Support**:
  - Production and staging environment configuration
  - Environment-specific API endpoints
  - Credential validation and testing

### Technical Improvements
- TypeScript implementation with strict type checking
- Comprehensive error handling
- Modular credential system
- Build system with Gulp for asset management
- Automated testing with high coverage

## [0.1.x] - Initial Releases

### Added
- Initial n8n community node implementation
- Basic Crossmint API integration
- Core wallet functionality
- Project structure and build system

---

## Release Notes

### Version 0.3.0 - Documentation Enhancement

This release focuses on significantly improving the project's documentation to make it more accessible for both users and contributors. The documentation now provides comprehensive coverage of all features, development processes, and usage examples.

**Key Documentation Additions:**
- Complete contributing guidelines with development setup
- Comprehensive API reference with detailed examples
- Troubleshooting guide for common issues
- Development architecture documentation
- Enhanced workflow examples with step-by-step instructions

**For Users:**
- Better installation and setup instructions
- More detailed usage examples
- Comprehensive troubleshooting guide
- Clear API reference documentation

**For Contributors:**
- Detailed development setup instructions
- Code style and testing guidelines
- Build process documentation
- PR submission guidelines

### Upgrade Notes

No breaking changes in this release. All existing workflows and configurations remain compatible.

### Future Roadmap

- Additional workflow examples for common use cases
- Enhanced error handling and validation
- Performance optimizations
- Extended blockchain support
- Advanced transaction features

---

For more details about any release, please check the [GitHub releases page](https://github.com/Crossmint/n8n-nodes-crossmint/releases).
