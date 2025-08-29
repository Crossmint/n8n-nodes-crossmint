# Testing Guide

This document provides comprehensive information about testing the Crossmint n8n community node, including test structure, best practices, and guidelines for writing new tests.

## Table of Contents

- [Test Overview](#test-overview)
- [Test Structure](#test-structure)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Test Coverage](#test-coverage)
- [Integration Testing](#integration-testing)
- [Debugging Tests](#debugging-tests)

## Test Overview

### Testing Framework

The project uses **Jest** with TypeScript support for comprehensive testing:

- **Unit Tests**: Test individual operations and methods
- **Integration Tests**: Test complete operation flows
- **Mock Testing**: Mock external dependencies (HTTP requests, credentials)
- **Error Testing**: Test error scenarios and edge cases

### Test Configuration

**Jest Configuration** (`jest.config.js`):
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: [
    'nodes/**/*.ts',
    'credentials/**/*.ts',
    '!**/*.d.ts',
  ],
};
```

## Test Structure

### File Organization

```
test/
├── CrossmintNode.test.ts        # Main node tests
├── credentials/                 # Credential tests (future)
├── helpers/                     # Test utilities (future)
└── fixtures/                    # Test data (future)
```

### Main Test File Structure

**`CrossmintNode.test.ts`** contains:

1. **Setup and Teardown**: Mock configuration and cleanup
2. **Wallet Operation Tests**: All wallet-related operations
3. **Checkout Operation Tests**: E-commerce functionality
4. **Error Handling Tests**: Error scenarios and edge cases
5. **Credential Tests**: Authentication and validation

### Test Categories

#### 1. Wallet Operations
- `createWallet` - Wallet creation with various configurations
- `getWallet` - Wallet retrieval by different locator types
- `getBalance` - Balance checking across chains and tokens
- `transferToken` - Token transfers between wallets
- `signAndSubmitTransaction` - Transaction signing

#### 2. Checkout Operations
- `findProduct` - Product order creation
- `purchaseProduct` - Payment processing

#### 3. Error Scenarios
- Invalid API keys
- Network failures
- Invalid parameters
- Insufficient balances

## Running Tests

### Basic Test Commands

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run specific test file
npm test -- CrossmintNode.test.ts

# Run tests with coverage
npm test -- --coverage

# Run tests with verbose output
npm test -- --verbose
```

### Advanced Test Options

```bash
# Run tests matching pattern
npm test -- --testNamePattern="createWallet"

# Run tests in specific directory
npm test -- test/

# Run tests with debugging
npm test -- --detectOpenHandles --forceExit

# Run tests in band (sequential)
npm test -- --runInBand
```

### Coverage Reports

Generate detailed coverage reports:

```bash
# Generate coverage report
npm test -- --coverage

# Generate HTML coverage report
npm test -- --coverage --coverageReporters=html

# Open coverage report
open coverage/lcov-report/index.html
```

## Writing Tests

### Test Structure Pattern

Follow this pattern for new tests:

```typescript
describe('Operation Name', () => {
  let node: CrossmintNode;
  let mockExecuteFunctions: IExecuteFunctions;
  let mockGetNodeParameter: jest.Mock;
  let mockGetCredentials: jest.Mock;
  let mockHttpRequest: jest.Mock;

  beforeEach(() => {
    // Setup mocks
    node = new CrossmintNode();
    setupMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should handle success scenario', async () => {
    // Test implementation
  });

  it('should handle error scenario', async () => {
    // Error test implementation
  });
});
```

### Mock Setup

**Standard Mock Configuration**:

```typescript
beforeEach(() => {
  node = new CrossmintNode();
  
  mockGetNodeParameter = jest.fn();
  mockGetCredentials = jest.fn();
  mockHttpRequest = jest.fn();
  mockGetInputData = jest.fn();
  mockConstructExecutionMetaData = jest.fn();
  mockReturnJsonArray = jest.fn();

  mockExecuteFunctions = {
    getNodeParameter: mockGetNodeParameter,
    getCredentials: mockGetCredentials,
    helpers: {
      httpRequest: mockHttpRequest,
      constructExecutionMetaData: mockConstructExecutionMetaData,
      returnJsonArray: mockReturnJsonArray,
    },
    getInputData: mockGetInputData,
    continueOnFail: jest.fn().mockReturnValue(false),
    getNode: jest.fn().mockReturnValue({ name: 'CrossmintNode' }),
  } as any;

  // Default mock implementations
  mockGetInputData.mockReturnValue([{ json: {} }]);
  mockGetCredentials.mockResolvedValue({
    apiKey: 'test-api-key',
    environment: 'staging',
  });
  mockConstructExecutionMetaData.mockImplementation((data) => data);
  mockReturnJsonArray.mockImplementation((data) => [{ json: data, pairedItem: { item: 0 } }]);
});
```

### Writing Operation Tests

**Example: Testing createWallet Operation**

```typescript
it('should handle createWallet operation', async () => {
  // Arrange
  mockGetNodeParameter.mockImplementation((paramName: string) => {
    switch (paramName) {
      case 'operation': return 'createWallet';
      case 'chainType': return 'evm';
      case 'ownerType': return 'email';
      case 'ownerEmail': return 'test@example.com';
      case 'externalSignerDetails': return 'test-private-key';
      default: return '';
    }
  });

  const mockResponse = {
    id: 'wallet-123',
    address: '0x742d35Cc6634C0532925a3b8D0C9e0e7C0C0C0C0',
    type: 'evm-smart-wallet',
  };
  mockHttpRequest.mockResolvedValue(mockResponse);

  // Act
  const result = await node.execute.call(mockExecuteFunctions);

  // Assert
  expect(result).toEqual([[{ json: mockResponse }]]);
  expect(mockHttpRequest).toHaveBeenCalledWith({
    method: 'POST',
    url: 'https://staging.crossmint.com/api/2025-06-09/wallets',
    headers: {
      'X-API-KEY': 'test-api-key',
      'Content-Type': 'application/json',
    },
    body: {
      type: 'smart',
      chainType: 'evm',
      owner: 'email:test@example.com',
      config: {
        adminSigner: {
          type: 'external-wallet',
          address: expect.stringMatching(/^0x[a-fA-F0-9]{40}$/),
        },
      },
    },
    json: true,
  });
});
```

### Testing Error Scenarios

**Example: Testing API Error Handling**

```typescript
it('should handle API errors gracefully', async () => {
  // Arrange
  mockGetNodeParameter.mockImplementation((paramName: string) => {
    switch (paramName) {
      case 'operation': return 'createWallet';
      case 'chainType': return 'evm';
      default: return '';
    }
  });

  const mockError = new Error('API Error: Invalid request');
  mockHttpRequest.mockRejectedValue(mockError);

  // Act & Assert
  await expect(node.execute.call(mockExecuteFunctions)).rejects.toThrow('API Error: Invalid request');
});
```

### Testing Different Parameter Combinations

**Example: Testing Multiple Locator Types**

```typescript
describe('getWallet with different locators', () => {
  const testCases = [
    {
      locatorType: 'email',
      email: 'user@example.com',
      chainType: 'evm',
      expectedLocator: 'email%3Auser%40example.com%3Aevm%3Asmart'
    },
    {
      locatorType: 'userId',
      userId: 'user-123',
      chainType: 'solana',
      expectedLocator: 'userId%3Auser-123%3Asolana%3Asmart'
    },
    {
      locatorType: 'address',
      address: '0x742d35Cc6634C0532925a3b8D0C9e0e7C0C0C0C0',
      expectedLocator: '0x742d35Cc6634C0532925a3b8D0C9e0e7C0C0C0C0'
    }
  ];

  testCases.forEach(({ locatorType, expectedLocator, ...params }) => {
    it(`should handle ${locatorType} locator`, async () => {
      mockGetNodeParameter.mockImplementation((paramName: string) => {
        const paramMap = {
          operation: 'getWallet',
          getWalletLocatorType: locatorType,
          ...params
        };
        return paramMap[paramName] || '';
      });

      const mockResponse = { id: 'wallet-123', address: '0x...' };
      mockHttpRequest.mockResolvedValue(mockResponse);

      const result = await node.execute.call(mockExecuteFunctions);

      expect(mockHttpRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          url: `https://staging.crossmint.com/api/2025-06-09/wallets/${expectedLocator}`,
        })
      );
    });
  });
});
```

## Test Coverage

### Coverage Goals

Maintain high test coverage across all components:

- **Statements**: > 90%
- **Branches**: > 85%
- **Functions**: > 95%
- **Lines**: > 90%

### Coverage Analysis

```bash
# Generate detailed coverage report
npm test -- --coverage --coverageReporters=text-lcov | npx lcov-viewer

# Check coverage thresholds
npm test -- --coverage --coverageThreshold='{"global":{"statements":90,"branches":85,"functions":95,"lines":90}}'
```

### Areas to Focus

1. **All Operations**: Every node operation must be tested
2. **Error Paths**: All error scenarios and edge cases
3. **Parameter Validation**: Different parameter combinations
4. **Credential Handling**: Authentication scenarios
5. **Response Processing**: Output formatting and data transformation

## Integration Testing

### Testing with Real APIs

For integration testing with real Crossmint APIs:

```typescript
describe('Integration Tests', () => {
  // Skip in CI/CD unless explicitly enabled
  const runIntegrationTests = process.env.RUN_INTEGRATION_TESTS === 'true';

  beforeEach(() => {
    if (!runIntegrationTests) {
      pending('Integration tests disabled');
    }
  });

  it('should create wallet with real API', async () => {
    // Use real credentials and API calls
    const realCredentials = {
      apiKey: process.env.CROSSMINT_API_KEY,
      environment: 'staging'
    };

    // Test with real API
  });
});
```

### Environment Setup for Integration Tests

```bash
# Set environment variables for integration tests
export RUN_INTEGRATION_TESTS=true
export CROSSMINT_API_KEY=your-staging-api-key
export CROSSMINT_PRIVATE_KEY=your-test-private-key

# Run integration tests
npm test -- --testNamePattern="Integration"
```

## Debugging Tests

### Debug Configuration

**VS Code Debug Configuration** (`.vscode/launch.json`):

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Jest Tests",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": ["--runInBand", "--no-cache"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen",
      "env": {
        "NODE_ENV": "test"
      }
    }
  ]
}
```

### Debug Techniques

**1. Console Logging in Tests**:
```typescript
it('should debug test scenario', async () => {
  console.log('Mock parameters:', mockGetNodeParameter.mock.calls);
  console.log('HTTP request calls:', mockHttpRequest.mock.calls);
  
  const result = await node.execute.call(mockExecuteFunctions);
  
  console.log('Test result:', result);
});
```

**2. Debugging Mock Calls**:
```typescript
afterEach(() => {
  if (process.env.DEBUG_TESTS) {
    console.log('HTTP requests made:', mockHttpRequest.mock.calls);
    console.log('Parameters accessed:', mockGetNodeParameter.mock.calls);
  }
  jest.clearAllMocks();
});
```

**3. Isolating Test Cases**:
```typescript
// Use .only to run specific test
it.only('should debug this specific case', async () => {
  // Test implementation
});

// Use .skip to skip problematic tests temporarily
it.skip('should skip this test for now', async () => {
  // Test implementation
});
```

### Common Debugging Scenarios

**1. Mock Not Working**:
```typescript
// Check if mock is being called
expect(mockHttpRequest).toHaveBeenCalled();

// Check mock call arguments
expect(mockHttpRequest).toHaveBeenCalledWith(
  expect.objectContaining({
    method: 'POST',
    url: expect.stringContaining('crossmint.com')
  })
);
```

**2. Async Issues**:
```typescript
// Ensure proper async/await usage
it('should handle async operations', async () => {
  const promise = node.execute.call(mockExecuteFunctions);
  await expect(promise).resolves.toBeDefined();
});
```

**3. Parameter Mocking Issues**:
```typescript
// Debug parameter access
mockGetNodeParameter.mockImplementation((paramName: string, itemIndex: number) => {
  console.log(`Accessing parameter: ${paramName} at index: ${itemIndex}`);
  return parameterMap[paramName] || '';
});
```

## Best Practices

### Test Organization

1. **Group Related Tests**: Use `describe` blocks to group related functionality
2. **Clear Test Names**: Use descriptive test names that explain the scenario
3. **Setup and Teardown**: Use `beforeEach` and `afterEach` for consistent setup
4. **Test Independence**: Each test should be independent and not rely on others

### Mock Management

1. **Consistent Mocking**: Use the same mock setup pattern across tests
2. **Reset Mocks**: Always clear mocks between tests
3. **Realistic Responses**: Use realistic mock responses that match actual API responses
4. **Error Simulation**: Test both success and error scenarios

### Test Data

1. **Valid Test Data**: Use realistic test data that matches expected formats
2. **Edge Cases**: Test boundary conditions and edge cases
3. **Invalid Data**: Test with invalid inputs to ensure proper error handling
4. **Data Fixtures**: Use fixtures for complex test data

### Continuous Integration

1. **Fast Tests**: Keep tests fast to enable quick feedback
2. **Reliable Tests**: Ensure tests are deterministic and don't flake
3. **Coverage Reporting**: Monitor test coverage and maintain high standards
4. **Parallel Execution**: Use parallel test execution when possible

This testing guide provides the foundation for maintaining high-quality, reliable tests for the Crossmint n8n community node. Follow these patterns and practices to ensure comprehensive test coverage and reliable functionality.
