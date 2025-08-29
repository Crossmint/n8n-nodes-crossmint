# Contributing to n8n-nodes-crossmint

Thank you for your interest in contributing to the Crossmint n8n community node! This guide will help you get started with development, testing, and submitting contributions.

## Table of Contents

- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Build Process](#build-process)
- [Submitting Changes](#submitting-changes)
- [Release Process](#release-process)

## Development Setup

### Prerequisites

- Node.js >= 20.15 (as specified in package.json)
- npm or yarn package manager
- Git
- A local n8n installation for testing

### Local Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Crossmint/n8n-nodes-crossmint.git
   cd n8n-nodes-crossmint
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the project:**
   ```bash
   npm run build
   ```

4. **Link for local testing:**
   ```bash
   npm link
   cd ~/.n8n/custom
   npm link n8n-nodes-crossmint
   ```

5. **Start n8n in development mode:**
   ```bash
   n8n start
   ```

### Development Commands

- `npm run build` - Build the project (TypeScript compilation + icon copying)
- `npm run dev` - Watch mode for TypeScript compilation
- `npm run lint` - Run ESLint checks
- `npm run lintfix` - Fix auto-fixable ESLint issues
- `npm run format` - Format code with Prettier
- `npm test` - Run Jest tests

## Project Structure

```
├── credentials/           # Credential type definitions
│   ├── CrossmintApi.credentials.ts
│   └── CrossmintPrivateKeyApi.credentials.ts
├── nodes/Crossmint/      # Node implementation
│   ├── CrossmintNode.node.ts
│   ├── CrossmintNode.node.json
│   └── logo.svg
├── test/                 # Test files
│   └── CrossmintNode.test.ts
├── workflows-examples/   # Example workflows
│   └── crossmint-nodes-examples.json
├── dist/                 # Build output (generated)
├── gulpfile.js          # Build system for assets
├── tsconfig.json        # TypeScript configuration
├── jest.config.js       # Jest test configuration
└── .eslintrc.js         # ESLint configuration
```

### Key Files

- **CrossmintApi.credentials.ts**: Defines the main API credential type with environment selection
- **CrossmintPrivateKeyApi.credentials.ts**: Defines private key credentials for transaction signing
- **CrossmintNode.node.ts**: Main node implementation with all operations
- **CrossmintNode.node.json**: Node metadata and UI configuration

## Coding Standards

### TypeScript Guidelines

- Use strict TypeScript configuration (see `tsconfig.json`)
- Follow n8n's interface patterns (`INodeType`, `ICredentialType`, etc.)
- Use proper type annotations for all function parameters and return values
- Implement proper error handling with n8n's `NodeOperationError`

### ESLint Rules

This project uses extensive ESLint rules specifically for n8n nodes:

- **80+ specialized rules** from `eslint-plugin-n8n-nodes-base`
- Rules cover credential naming, node descriptions, parameter validation
- All rules are enforced in CI - ensure `npm run lint` passes before submitting

### Code Style

- Use Prettier for code formatting (`npm run format`)
- Follow existing patterns in the codebase
- Use descriptive variable and function names
- Keep functions focused and single-purpose

### Documentation Standards

- Document all public methods and complex logic
- Use JSDoc comments for function documentation
- Keep inline comments minimal and focused on "why" not "what"
- Update README.md for user-facing changes

## Testing

### Test Structure

Tests are located in the `test/` directory and use Jest with TypeScript support.

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

### Writing Tests

- Follow the existing test patterns in `CrossmintNode.test.ts`
- Mock all external dependencies (HTTP requests, credentials)
- Test both success and error scenarios
- Include tests for all node operations

### Test Coverage

The project aims for high test coverage on:
- All node operations (wallet and checkout)
- Credential validation
- Error handling scenarios
- Parameter validation

## Build Process

### Build System

The build process consists of:

1. **TypeScript Compilation**: `tsc` compiles TypeScript to JavaScript in `dist/`
2. **Asset Copying**: Gulp copies SVG/PNG icons to the distribution directory
3. **Validation**: ESLint ensures code quality

### Build Configuration

- **TypeScript**: Configured in `tsconfig.json` with strict settings
- **Gulp**: Handles asset pipeline for icons (`gulpfile.js`)
- **Output**: All build artifacts go to `dist/` directory

### Pre-publish Checks

Before publishing, the following checks run automatically:
- TypeScript compilation
- ESLint validation with stricter rules (`.eslintrc.prepublish.js`)
- Asset copying

## Submitting Changes

### Pull Request Process

1. **Create a feature branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes and test thoroughly:**
   ```bash
   npm run lint
   npm test
   npm run build
   ```

3. **Commit with descriptive messages:**
   ```bash
   git add <specific-files>
   git commit -m "feat: add new wallet operation support"
   ```

4. **Push and create a pull request:**
   ```bash
   git push origin feature/your-feature-name
   ```

### PR Requirements

- All tests must pass
- ESLint checks must pass
- Code must be formatted with Prettier
- Include tests for new functionality
- Update documentation for user-facing changes
- Follow conventional commit message format

### Code Review Process

- All PRs require review from maintainers
- Address feedback promptly
- Keep PRs focused and reasonably sized
- Include screenshots for UI changes

## Release Process

### Versioning

This project follows [Semantic Versioning](https://semver.org/):
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Release Checklist

1. Update version in `package.json`
2. Update `CHANGELOG.md` with changes
3. Run full test suite
4. Create release PR
5. Tag release after merge
6. Publish to npm registry

## Getting Help

- **Issues**: Report bugs and request features via GitHub Issues
- **Discussions**: Use GitHub Discussions for questions and ideas
- **Documentation**: Check the main README.md and API documentation
- **Crossmint Support**: Contact support@crossmint.com for API-related questions

## Code of Conduct

Please note that this project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## License

By contributing to this project, you agree that your contributions will be licensed under the MIT License.
