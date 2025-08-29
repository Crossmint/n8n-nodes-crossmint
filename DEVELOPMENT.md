# Development Guide

This guide provides detailed information about the architecture, development setup, and contribution process for the Crossmint n8n community node.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Project Structure](#project-structure)
- [Development Environment](#development-environment)
- [Code Organization](#code-organization)
- [Build System](#build-system)
- [Testing Strategy](#testing-strategy)
- [Debugging](#debugging)
- [Performance Considerations](#performance-considerations)

## Architecture Overview

### High-Level Architecture

The Crossmint n8n node follows n8n's community node architecture pattern:

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   n8n Workflow │    │  Crossmint Node  │    │ Crossmint APIs │
│                 │◄──►│                  │◄──►│                 │
│ User Interface  │    │  Implementation  │    │   (REST APIs)   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │   Credentials    │
                       │   Management     │
                       └──────────────────┘
```

### Core Components

1. **Node Implementation** (`CrossmintNode.node.ts`)
   - Implements `INodeType` interface
   - Handles operation routing and execution
   - Manages API communication

2. **Credential Types** (`credentials/`)
   - `CrossmintApi`: Main API authentication
   - `CrossmintPrivateKeyApi`: Private key management for signing

3. **Build System** (`gulpfile.js`, `tsconfig.json`)
   - TypeScript compilation
   - Asset management (icons, metadata)
   - Distribution packaging

## Project Structure

### Directory Layout

```
n8n-nodes-crossmint/
├── credentials/              # Credential type definitions
│   ├── CrossmintApi.credentials.ts
│   └── CrossmintPrivateKeyApi.credentials.ts
├── nodes/Crossmint/         # Node implementation
│   ├── CrossmintNode.node.ts      # Main node logic
│   ├── CrossmintNode.node.json    # Node metadata
│   └── logo.svg                   # Node icon
├── test/                    # Test suite
│   └── CrossmintNode.test.ts
├── workflows-examples/      # Example workflows
│   └── crossmint-nodes-examples.json
├── dist/                    # Build output (generated)
├── docs/                    # Documentation files
├── .vscode/                 # VS Code configuration
├── gulpfile.js             # Build system
├── tsconfig.json           # TypeScript config
├── jest.config.js          # Test configuration
├── .eslintrc.js            # Linting rules
├── .prettierrc.js          # Code formatting
└── package.json            # Package manifest
```

### Key Files Explained

#### `package.json`
```json
{
  "n8n": {
    "n8nNodesApiVersion": 1,
    "credentials": ["dist/credentials/CrossmintApi.credentials.js"],
    "nodes": ["dist/nodes/Crossmint/CrossmintNode.node.js"]
  }
}
```
- Defines n8n integration points
- Specifies credential and node entry points
- Must point to compiled JavaScript files in `dist/`

#### `tsconfig.json`
```json
{
  "compilerOptions": {
    "strict": true,
    "target": "es2019",
    "outDir": "./dist/"
  },
  "include": ["credentials/**/*", "nodes/**/*"]
}
```
- Strict TypeScript configuration
- Compiles to ES2019 for n8n compatibility
- Outputs to `dist/` directory

## Development Environment

### Prerequisites

- **Node.js**: >= 20.15 (LTS recommended)
- **npm**: >= 8.0
- **TypeScript**: >= 5.8
- **n8n**: Latest self-hosted version

### Setup Steps

1. **Clone and Install**:
   ```bash
   git clone https://github.com/Crossmint/n8n-nodes-crossmint.git
   cd n8n-nodes-crossmint
   npm install
   ```

2. **Development Build**:
   ```bash
   # Watch mode for development
   npm run dev
   
   # Full build
   npm run build
   ```

3. **Link for Testing**:
   ```bash
   # Link package globally
   npm link
   
   # Link in n8n custom directory
   cd ~/.n8n/custom
   npm link n8n-nodes-crossmint
   ```

4. **Start n8n**:
   ```bash
   # Start n8n with debug logging
   export N8N_LOG_LEVEL=debug
   n8n start
   ```

### VS Code Configuration

The project includes VS Code settings in `.vscode/`:

```json
{
  "recommendations": [
    "ms-vscode.vscode-typescript-next",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-eslint"
  ]
}
```

Recommended extensions:
- TypeScript and JavaScript Language Features
- Prettier - Code formatter
- ESLint

## Code Organization

### Node Implementation Pattern

The main node follows this structure:

```typescript
export class CrossmintNode implements INodeType {
  description: INodeTypeDescription = {
    // Node metadata and UI configuration
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    // Main execution logic
  }

  // Helper methods for each operation
  private async createWalletMethod() { /* ... */ }
  private async getWalletMethod() { /* ... */ }
  private async transferToken() { /* ... */ }
  // ...
}
```

### Operation Routing

Operations are routed based on resource and operation parameters:

```typescript
const resource = this.getNodeParameter('resource', 0) as string;
const operation = this.getNodeParameter('operation', 0) as string;

if (resource === 'wallet') {
  switch (operation) {
    case 'createWallet': return await this.createWalletMethod();
    case 'getWallet': return await this.getWalletMethod();
    case 'transferToken': return await this.transferToken();
    // ...
  }
}
```

### Error Handling

Use n8n's error types for consistent error handling:

```typescript
import { NodeOperationError, NodeApiError } from 'n8n-workflow';

// For user errors
throw new NodeOperationError(this.getNode(), 'Invalid wallet address format');

// For API errors
throw new NodeApiError(this.getNode(), error);
```

### Credential Management

Credentials are accessed through the execution context:

```typescript
const credentials = await this.getCredentials('crossmintApi');
const apiKey = credentials.apiKey as string;
const environment = credentials.environment as string;
```

## Build System

### TypeScript Compilation

The build process uses TypeScript compiler with strict settings:

```bash
# Compile TypeScript
npx tsc

# Watch mode for development
npx tsc --watch
```

### Asset Pipeline

Gulp handles asset copying:

```javascript
function copyIcons() {
  const nodeSource = path.resolve('nodes', '**', '*.{png,svg}');
  const nodeDestination = path.resolve('dist', 'nodes');
  
  src(nodeSource).pipe(dest(nodeDestination));
  
  const credSource = path.resolve('credentials', '**', '*.{png,svg}');
  const credDestination = path.resolve('dist', 'credentials');
  
  return src(credSource).pipe(dest(credDestination));
}
```

### Build Commands

```bash
# Full build (TypeScript + assets)
npm run build

# Development watch mode
npm run dev

# Clean build
npx rimraf dist && npm run build
```

## Testing Strategy

### Test Structure

Tests use Jest with TypeScript support:

```typescript
describe('CrossmintNode', () => {
  let node: CrossmintNode;
  let mockExecuteFunctions: IExecuteFunctions;

  beforeEach(() => {
    node = new CrossmintNode();
    // Setup mocks
  });

  it('should handle createWallet operation', async () => {
    // Test implementation
  });
});
```

### Mock Strategy

All external dependencies are mocked:

```typescript
const mockHttpRequest = jest.fn();
const mockGetCredentials = jest.fn();

mockExecuteFunctions = {
  getNodeParameter: mockGetNodeParameter,
  getCredentials: mockGetCredentials,
  helpers: {
    httpRequest: mockHttpRequest,
  },
} as any;
```

### Test Categories

1. **Unit Tests**: Individual operation testing
2. **Integration Tests**: End-to-end operation flows
3. **Error Handling Tests**: Error scenarios and edge cases
4. **Credential Tests**: Authentication and validation

### Running Tests

```bash
# Run all tests
npm test

# Watch mode
npm test -- --watch

# Coverage report
npm test -- --coverage

# Specific test file
npm test -- CrossmintNode.test.ts
```

## Debugging

### Debug Configuration

Enable debug logging:

```bash
# n8n debug mode
export N8N_LOG_LEVEL=debug
n8n start

# Node.js debug mode
export NODE_DEBUG=http,https
n8n start
```

### VS Code Debugging

Create `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Tests",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

### Common Debug Scenarios

1. **API Request Debugging**:
   ```typescript
   console.log('Request:', requestOptions);
   const response = await this.helpers.httpRequest(requestOptions);
   console.log('Response:', response);
   ```

2. **Parameter Debugging**:
   ```typescript
   const params = {
     resource: this.getNodeParameter('resource', 0),
     operation: this.getNodeParameter('operation', 0),
   };
   console.log('Parameters:', params);
   ```

3. **Credential Debugging**:
   ```typescript
   const credentials = await this.getCredentials('crossmintApi');
   console.log('Environment:', credentials.environment);
   // Never log API keys!
   ```

## Performance Considerations

### HTTP Request Optimization

- Use connection pooling for multiple requests
- Implement request timeout handling
- Cache responses when appropriate

```typescript
const requestOptions: IHttpRequestOptions = {
  method: 'GET',
  url: apiUrl,
  headers: { 'X-API-KEY': apiKey },
  timeout: 30000, // 30 second timeout
  json: true,
};
```

### Memory Management

- Avoid storing large objects in memory
- Clean up resources after operations
- Use streaming for large data transfers

### Error Recovery

- Implement retry logic for transient failures
- Use exponential backoff for rate limiting
- Provide meaningful error messages

```typescript
async function retryRequest(requestFn: () => Promise<any>, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await requestFn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
    }
  }
}
```

### Bundle Size Optimization

- Use tree shaking for dependencies
- Avoid large libraries when possible
- Minimize the built package size

```bash
# Check bundle size
npm run build
du -sh dist/
```

## Code Quality

### ESLint Configuration

The project uses 80+ specialized ESLint rules for n8n nodes:

```javascript
// .eslintrc.js
{
  plugins: ['eslint-plugin-n8n-nodes-base'],
  extends: ['plugin:n8n-nodes-base/nodes'],
  rules: {
    'n8n-nodes-base/node-param-default-missing': 'error',
    'n8n-nodes-base/node-param-description-missing-final-period': 'error',
    // ... many more rules
  }
}
```

### Code Formatting

Prettier configuration:

```javascript
// .prettierrc.js
module.exports = {
  semi: true,
  singleQuote: true,
  tabWidth: 2,
  useTabs: true,
};
```

### Type Safety

- Use strict TypeScript configuration
- Define proper interfaces for all data structures
- Avoid `any` types when possible

```typescript
interface WalletResponse {
  id: string;
  address: string;
  type: string;
  chainType: 'evm' | 'solana';
}
```

This development guide provides the foundation for contributing to and extending the Crossmint n8n community node. Follow these patterns and practices to maintain code quality and consistency.
