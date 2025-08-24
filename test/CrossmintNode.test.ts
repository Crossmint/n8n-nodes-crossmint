import { IExecuteFunctions } from 'n8n-workflow';
import { CrossmintNode } from '../nodes/Crossmint/CrossmintNode.node';

describe('CrossmintNode', () => {
	let node: CrossmintNode;
	let mockExecuteFunctions: IExecuteFunctions;
	let mockGetNodeParameter: jest.Mock;
	let mockGetCredentials: jest.Mock;
	let mockHttpRequest: jest.Mock;
	let mockGetInputData: jest.Mock;
	let mockConstructExecutionMetaData: jest.Mock;
	let mockReturnJsonArray: jest.Mock;

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

		mockGetInputData.mockReturnValue([{ json: {} }]);
		mockGetCredentials.mockResolvedValue({
			apiKey: 'test-api-key',
			environment: 'staging',
		});
		mockConstructExecutionMetaData.mockImplementation((data) => data);
		mockReturnJsonArray.mockImplementation((data) => [{ json: data, pairedItem: { item: 0 } }]);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should handle createWallet operation', async () => {
		mockGetNodeParameter.mockImplementation((paramName: string) => {
			switch (paramName) {
				case 'operation': return 'createWallet';
				case 'walletType': return 'custodial';
				case 'chain': return 'polygon';
				default: return '';
			}
		});

		const mockResponse = { id: 'wallet-123', type: 'custodial' };
		mockHttpRequest.mockResolvedValue(mockResponse);

		const result = await node.execute.call(mockExecuteFunctions);

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
				chainType: '',
				config: {
					adminSigner: {
						type: 'api-key',
					},
				},
			},
			json: true,
		});
	});

	it('should handle getWallet operation', async () => {
		mockGetNodeParameter.mockImplementation((paramName: string) => {
			switch (paramName) {
				case 'operation': return 'getWallet';
				case 'getWalletLocatorType': return 'email';
				case 'getWalletEmail': return 'user@example.com';
				case 'getWalletChainType': return 'polygon';
				default: return '';
			}
		});

		const mockResponse = { id: 'wallet-123', address: '0x742d35Cc6634C0532925a3b8D0C9e0e7C0C0C0C0' };
		mockHttpRequest.mockResolvedValue(mockResponse);

		const result = await node.execute.call(mockExecuteFunctions);

		expect(result).toEqual([[{ json: mockResponse }]]);
		expect(mockHttpRequest).toHaveBeenCalledWith({
			method: 'GET',
			url: 'https://staging.crossmint.com/api/2025-06-09/wallets/email%3Auser%40example.com%3Apolygon%3Asmart',
			headers: {
				'X-API-KEY': 'test-api-key',
			},
			json: true,
		});
	});

	it('should handle getBalance operation', async () => {
		mockGetNodeParameter.mockImplementation((paramName: string) => {
			switch (paramName) {
				case 'operation': return 'getBalance';
				case 'balanceLocatorType': return 'email';
				case 'balanceWalletEmail': return 'user@example.com';
				case 'balanceWalletChainType': return 'polygon';
				case 'chains': return 'polygon';
				case 'tokens': return 'matic';
				default: return '';
			}
		});

		const mockResponse = { balance: '1.5', currency: 'MATIC' };
		mockHttpRequest.mockResolvedValue(mockResponse);

		const result = await node.execute.call(mockExecuteFunctions);

		expect(result).toEqual([[{ json: mockResponse }]]);
		expect(mockHttpRequest).toHaveBeenCalledWith({
			method: 'GET',
			url: 'https://staging.crossmint.com/api/2025-06-09/wallets/email%3Auser%40example.com%3Apolygon%3Asmart/balances?chains=polygon&tokens=matic',
			headers: {
				'X-API-KEY': 'test-api-key',
			},
			json: true,
		});
	});

	it('should handle API errors gracefully', async () => {
		mockGetNodeParameter.mockImplementation((paramName: string) => {
			switch (paramName) {
				case 'operation': return 'createWallet';
				case 'walletType': return 'custodial';
				case 'chain': return 'polygon';
				default: return '';
			}
		});

		const mockError = new Error('API Error');
		mockHttpRequest.mockRejectedValue(mockError);

		await expect(node.execute.call(mockExecuteFunctions)).rejects.toThrow('API Error');
	});

	it('should handle transferToken operation', async () => {
		mockGetNodeParameter.mockImplementation((paramName: string) => {
			switch (paramName) {
				case 'operation': return 'transferToken';
				case 'amount': return '1.0';
				case 'tokenChain': return 'ethereum-sepolia';
				case 'tokenName': return 'usdc';
				case 'originLocatorType': return 'email';
				case 'originWalletEmail': return 'sender@example.com';
				case 'originWalletChainType': return 'polygon';
				case 'recipientLocatorType': return 'address';
				case 'recipientWalletAddress': return '0x1234567890123456789012345678901234567890';
				default: return '';
			}
		});

		const mockResponse = { id: 'transaction-123', status: 'pending' };
		mockHttpRequest.mockResolvedValue(mockResponse);

		const result = await node.execute.call(mockExecuteFunctions);

		expect(result).toEqual([[{ json: mockResponse }]]);
		expect(mockHttpRequest).toHaveBeenCalledWith({
			method: 'POST',
			url: 'https://staging.crossmint.com/api/2025-06-09/wallets/email%3Asender%40example.com%3A%3Asmart/tokens/ethereum-sepolia%3Ausdc/transfers',
			headers: {
				'X-API-KEY': 'test-api-key',
				'Content-Type': 'application/json',
			},
			body: {
				recipient: '0x1234567890123456789012345678901234567890',
				amount: '1.0',
			},
			json: true,
		});
	});

	it('should handle findProduct operation', async () => {
		mockGetNodeParameter.mockImplementation((paramName: string) => {
			switch (paramName) {
				case 'operation': return 'findProduct';
				case 'platform': return 'shopify';
				case 'productIdentifier': return 'product-123';
				case 'recipientEmail': return 'recipient@example.com';
				case 'recipientName': return 'John Doe';
				case 'addressLine1': return '123 Main St';
				case 'city': return 'New York';
				case 'state': return 'NY';
				case 'postalCode': return '10001';
				case 'country': return 'US';
				case 'paymentMethod': return 'ethereum-sepolia';
				case 'paymentCurrency': return 'usdc';
				case 'payerAddress': return '0x742d35Cc6634C0532925a3b8D0C9e0e7C0C0C0C0';
				default: return '';
			}
		});

		const mockResponse = { id: 'product-123', price: '10.00', currency: 'USDC' };
		mockHttpRequest.mockResolvedValue(mockResponse);

		const result = await node.execute.call(mockExecuteFunctions);

		expect(result).toEqual([[{ json: mockResponse }]]);
		expect(mockHttpRequest).toHaveBeenCalledWith({
			method: 'POST',
			url: 'https://staging.crossmint.com/api/2022-06-09/orders',
			headers: {
				'X-API-KEY': 'test-api-key',
				'Content-Type': 'application/json',
			},
			body: {
				lineItems: [
					{
						productLocator: 'shopify:product-123:default',
					},
				],
				recipient: {
					email: 'recipient@example.com',
					physicalAddress: {
						name: 'John Doe',
						line1: '123 Main St',
						city: 'New York',
						state: 'NY',
						postalCode: '10001',
						country: 'US',
					},
				},
				payment: {
					method: 'ethereum-sepolia',
					currency: 'usdc',
					payerAddress: '0x742d35Cc6634C0532925a3b8D0C9e0e7C0C0C0C0',
					receiptEmail: 'recipient@example.com',
				},
			},
			json: true,
		});
	});

	it('should handle purchaseProduct operation', async () => {
		mockGetNodeParameter.mockImplementation((paramName: string) => {
			switch (paramName) {
				case 'operation': return 'purchaseProduct';
				case 'serializedTransaction': return '0x1234567890abcdef';
				case 'paymentMethod': return 'ethereum-sepolia';
				case 'payerAddress': return '0x742d35Cc6634C0532925a3b8D0C9e0e7C0C0C0C0';
				default: return '';
			}
		});

		const mockResponse = { id: 'purchase-123', status: 'completed' };
		mockHttpRequest.mockResolvedValue(mockResponse);

		const result = await node.execute.call(mockExecuteFunctions);

		expect(result).toEqual([[{ json: mockResponse }]]);
		expect(mockHttpRequest).toHaveBeenCalledWith({
			method: 'POST',
			url: 'https://staging.crossmint.com/api/2022-06-09/wallets/0x742d35Cc6634C0532925a3b8D0C9e0e7C0C0C0C0/transactions',
			headers: {
				'X-API-KEY': 'test-api-key',
				'Content-Type': 'application/json',
			},
			body: {
				params: {
					calls: [
						{
							transaction: '0x1234567890abcdef',
						},
					],
					chain: 'ethereum-sepolia',
				},
			},
			json: true,
		});
	});

	describe('createWalletWithSigner', () => {
		it('should create wallet with EVM external signer', async () => {
			const mockResponse = {
				id: 'wallet-123',
				address: '0x742d35Cc6634C0532925a3b8D0C9e0e7C0C0C0C0',
				type: 'evm-smart-wallet',
			};

			mockGetCredentials.mockImplementation((credentialType: string) => {
				if (credentialType === 'crossmintApi') {
					return Promise.resolve({
						apiKey: 'test-api-key',
						environment: 'staging',
					});
				} else if (credentialType === 'crossmintPrivateKeyApi') {
					return Promise.resolve({
						privateKey: 'abb51256c1324a1350598653f46aa3ad693ac3cf5d05f36eba3f495a1f51590f',
						chainType: 'evm',
					});
				}
				return Promise.resolve({});
			});

			mockHttpRequest.mockResolvedValue(mockResponse);

			mockGetNodeParameter.mockImplementation((paramName: string) => {
				switch (paramName) {
					case 'operation': return 'createWalletWithSigner';
					case 'signerChainType': return 'evm';
					default: return '';
				}
			});

			const result = await node.execute.call(mockExecuteFunctions);

			expect(result).toEqual([
				[
					{
						json: {
							...mockResponse,
							derivedAddress: expect.stringMatching(/^0x[a-fA-F0-9]{40}$/),
							derivedPublicKey: expect.stringMatching(/^0x[a-fA-F0-9]{128}$/),
						},
					},
				],
			]);

			expect(mockHttpRequest).toHaveBeenCalledWith({
				method: 'POST',
				url: 'https://staging.crossmint.com/api/2025-06-09/wallets',
				headers: {
					'X-API-KEY': 'test-api-key',
					'Content-Type': 'application/json',
				},
				body: {
					type: 'evm-smart-wallet',
					config: {
						adminSigner: expect.stringMatching(/^0x[a-fA-F0-9]{40}$/),
					},
				},
				json: true,
			});
		});

		it('should create wallet with Solana external signer', async () => {
			const mockResponse = {
				id: 'wallet-456',
				address: 'DjVE6JNiYqPL2QXyCUUh8rNjHrbz6hXHNYt99MQ59qw1',
				type: 'solana-custodial-wallet',
			};

			mockGetCredentials.mockImplementation((credentialType: string) => {
				if (credentialType === 'crossmintApi') {
					return Promise.resolve({
						apiKey: 'test-api-key',
						environment: 'staging',
					});
				} else if (credentialType === 'crossmintPrivateKeyApi') {
					return Promise.resolve({
						privateKey: '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtrzVHpcXjnBtmN2jGMxgKG1H1cH8TjC2hgHqfnAHRdMeUiN',
						chainType: 'solana',
					});
				}
				return Promise.resolve({});
			});

			mockHttpRequest.mockResolvedValue(mockResponse);

			mockGetNodeParameter.mockImplementation((paramName: string) => {
				switch (paramName) {
					case 'operation': return 'createWalletWithSigner';
					case 'signerChainType': return 'solana';
					default: return '';
				}
			});

			const result = await node.execute.call(mockExecuteFunctions);

			expect(result).toEqual([
				[
					{
						json: {
							...mockResponse,
							derivedAddress: expect.any(String),
							derivedPublicKey: expect.any(String),
						},
					},
				],
			]);

			expect(mockHttpRequest).toHaveBeenCalledWith({
				method: 'POST',
				url: 'https://staging.crossmint.com/api/2025-06-09/wallets',
				headers: {
					'X-API-KEY': 'test-api-key',
					'Content-Type': 'application/json',
				},
				body: {
					type: 'solana-custodial-wallet',
					config: {
						adminSigner: expect.any(String),
					},
				},
				json: true,
			});
		});
	});

	describe('signTransaction', () => {
		it('should sign EVM transaction', async () => {
			const mockPrivateKeyCredentials = {
				privateKey: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
				chainType: 'evm',
			};

			const transactionData = {
				nonce: 0,
				gasPrice: '0x3b9aca00',
				gasLimit: '0x5208',
				to: '0x742d35Cc6634C0532925a3b8D0C9e0e7C0C0C0C0',
				value: '0xde0b6b3a7640000',
				data: '0x',
			};

			mockGetCredentials.mockResolvedValue(mockPrivateKeyCredentials);

			mockGetNodeParameter.mockImplementation((paramName: string) => {
				switch (paramName) {
					case 'operation': return 'signTransaction';
					case 'transactionData': return JSON.stringify(transactionData);
					case 'chainId': return 1;
					default: return '';
				}
			});

			const result = await node.execute.call(mockExecuteFunctions);

			expect(result[0][0].json).toHaveProperty('rawTransaction');
			expect(result[0][0].json).toHaveProperty('transactionHash');
			expect(result[0][0].json).toHaveProperty('r');
			expect(result[0][0].json).toHaveProperty('s');
			expect(result[0][0].json).toHaveProperty('v');
			expect(result[0][0].json).toHaveProperty('from');

			expect(result[0][0].json.rawTransaction).toMatch(/^0x[a-fA-F0-9]+$/);
			expect(result[0][0].json.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
			expect(result[0][0].json.from).toMatch(/^0x[a-fA-F0-9]{40}$/);
		});

		it('should sign Solana transaction', async () => {
			const mockPrivateKeyCredentials = {
				privateKey: '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtrzVHpcXjn',
				chainType: 'solana',
			};

			const transactionData = {
				message: 'SGVsbG8gU29sYW5hIQ==',
			};

			mockGetCredentials.mockResolvedValue(mockPrivateKeyCredentials);

			mockGetNodeParameter.mockImplementation((paramName: string) => {
				switch (paramName) {
					case 'operation': return 'signTransaction';
					case 'transactionData': return JSON.stringify(transactionData);
					case 'chainId': return 1;
					default: return '';
				}
			});

			const result = await node.execute.call(mockExecuteFunctions);

			expect(result[0][0].json).toHaveProperty('signature');
			expect(result[0][0].json).toHaveProperty('publicKey');
			expect(result[0][0].json).toHaveProperty('signedMessage');

			expect(typeof result[0][0].json.signature).toBe('string');
			expect(typeof result[0][0].json.publicKey).toBe('string');
			expect(typeof result[0][0].json.signedMessage).toBe('string');
		});

		it('should handle invalid transaction data', async () => {
			const mockPrivateKeyCredentials = {
				privateKey: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
				chainType: 'evm',
			};

			mockGetCredentials.mockResolvedValue(mockPrivateKeyCredentials);

			mockGetNodeParameter.mockImplementation((paramName: string) => {
				switch (paramName) {
					case 'operation': return 'signTransaction';
					case 'transactionData': return 'invalid json';
					case 'chainId': return 1;
					default: return '';
				}
			});

			await expect(node.execute.call(mockExecuteFunctions)).rejects.toThrow('Invalid transaction data JSON');
		});
	});
});
