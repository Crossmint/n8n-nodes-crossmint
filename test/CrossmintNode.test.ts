import { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
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

		expect(result).toEqual([[{ json: mockResponse, pairedItem: { item: 0 } }]]);
		expect(mockHttpRequest).toHaveBeenCalledWith({
			method: 'POST',
			url: 'https://staging.crossmint.com/api/2025-06-09/wallets',
			headers: {
				'X-API-KEY': 'test-api-key',
				'Content-Type': 'application/json',
			},
			body: {
				type: 'custodial',
				config: {
					chain: 'polygon',
				},
			},
			json: true,
		});
	});

	it('should handle getWalletBalance operation', async () => {
		mockGetNodeParameter.mockImplementation((paramName: string) => {
			switch (paramName) {
				case 'operation': return 'getWalletBalance';
				case 'walletLocator': return 'email:user@example.com:polygon';
				case 'currency': return 'MATIC';
				default: return '';
			}
		});

		const mockResponse = { balance: '1.5', currency: 'MATIC' };
		mockHttpRequest.mockResolvedValue(mockResponse);

		const result = await node.execute.call(mockExecuteFunctions);

		expect(result).toEqual([[{ json: mockResponse, pairedItem: { item: 0 } }]]);
		expect(mockHttpRequest).toHaveBeenCalledWith({
			method: 'GET',
			url: 'https://staging.crossmint.com/api/2025-06-09/wallets/email%3Auser%40example.com%3Apolygon/balances',
			headers: {
				'X-API-KEY': 'test-api-key',
			},
			qs: { currency: 'MATIC' },
			json: true,
		});
	});

	it('should handle mintNFT operation', async () => {
		mockGetNodeParameter.mockImplementation((paramName: string) => {
			switch (paramName) {
				case 'operation': return 'mintNFT';
				case 'collectionId': return 'collection-123';
				case 'recipient': return 'email:user@example.com';
				case 'metadata': return { name: 'Test NFT', description: 'A test NFT' };
				default: return '';
			}
		});

		const mockResponse = { id: 'nft-123', status: 'pending' };
		mockHttpRequest.mockResolvedValue(mockResponse);

		const result = await node.execute.call(mockExecuteFunctions);

		expect(result).toEqual([[{ json: mockResponse, pairedItem: { item: 0 } }]]);
		expect(mockHttpRequest).toHaveBeenCalledWith({
			method: 'POST',
			url: 'https://staging.crossmint.com/api/2022-06-09/collections/collection-123/nfts',
			headers: {
				'X-API-KEY': 'test-api-key',
				'Content-Type': 'application/json',
			},
			body: {
				recipient: 'email:user@example.com',
				metadata: { name: 'Test NFT', description: 'A test NFT' },
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

	it('should handle agentSetupCardTokenization operation', async () => {
		mockGetNodeParameter.mockImplementation((paramName: string) => {
			switch (paramName) {
				case 'operation': return 'agentSetupCardTokenization';
				default: return '';
			}
		});

		const mockResponse = { basisTheoryApiKey: 'bt-api-key-123' };
		mockHttpRequest.mockResolvedValue(mockResponse);

		const result = await node.execute.call(mockExecuteFunctions);

		expect(result).toEqual([[{ json: mockResponse, pairedItem: { item: 0 } }]]);
		expect(mockHttpRequest).toHaveBeenCalledWith({
			method: 'GET',
			url: 'https://staging.crossmint.com/api/unstable/setupTokenizeCard',
			headers: {
				'X-API-KEY': 'test-api-key',
			},
			json: true,
		});
	});

	it('should handle agentRegisterCardToken operation', async () => {
		mockGetNodeParameter.mockImplementation((paramName: string) => {
			switch (paramName) {
				case 'operation': return 'agentRegisterCardToken';
				case 'cardToken': return 'test-card-token';
				default: return '';
			}
		});

		const mockResponse = { token: 'registered-token-123' };
		mockHttpRequest.mockResolvedValue(mockResponse);

		const result = await node.execute.call(mockExecuteFunctions);

		expect(result).toEqual([[{ json: mockResponse, pairedItem: { item: 0 } }]]);
		expect(mockHttpRequest).toHaveBeenCalledWith({
			method: 'POST',
			url: 'https://staging.crossmint.com/api/unstable/setupTokenizeCard/registerToken',
			headers: {
				'X-API-KEY': 'test-api-key',
				'Content-Type': 'application/json',
			},
			body: {
				token: 'test-card-token',
			},
			json: true,
		});
	});

	it('should handle agentCreateOrder operation', async () => {
		mockGetNodeParameter.mockImplementation((paramName: string) => {
			switch (paramName) {
				case 'operation': return 'agentCreateOrder';
				case 'productLocator': return 'amazon:https://www.amazon.com/product-url';
				case 'agentPaymentMethod': return 'card-token';
				case 'orderRecipient': return 'user@example.com';
				default: return '';
			}
		});

		const mockResponse = { id: 'order-123', status: 'created' };
		mockHttpRequest.mockResolvedValue(mockResponse);

		const result = await node.execute.call(mockExecuteFunctions);

		expect(result).toEqual([[{ json: mockResponse, pairedItem: { item: 0 } }]]);
		expect(mockHttpRequest).toHaveBeenCalledWith({
			method: 'POST',
			url: 'https://staging.crossmint.com/api/2022-06-09/orders',
			headers: {
				'X-API-KEY': 'test-api-key',
				'Content-Type': 'application/json',
			},
			body: {
				recipient: {
					email: 'user@example.com',
				},
				payment: {
					method: 'card-token',
					receiptEmail: 'user@example.com',
				},
				lineItems: {
					productLocator: 'amazon:https://www.amazon.com/product-url',
				},
				locale: 'en-US',
			},
			json: true,
		});
	});

	it('should handle agentCreateWallet operation', async () => {
		mockGetNodeParameter.mockImplementation((paramName: string) => {
			switch (paramName) {
				case 'operation': return 'agentCreateWallet';
				case 'walletType': return 'custodial';
				case 'chain': return 'polygon';
				default: return '';
			}
		});

		const mockResponse = { id: 'wallet-123', type: 'custodial' };
		mockHttpRequest.mockResolvedValue(mockResponse);

		const result = await node.execute.call(mockExecuteFunctions);

		expect(result).toEqual([[{ json: mockResponse, pairedItem: { item: 0 } }]]);
		expect(mockHttpRequest).toHaveBeenCalledWith({
			method: 'POST',
			url: 'https://staging.crossmint.com/api/2025-06-09/wallets',
			headers: {
				'X-API-KEY': 'test-api-key',
				'Content-Type': 'application/json',
			},
			body: {
				type: 'custodial',
				config: {
					chain: 'polygon',
					purpose: 'agent',
				},
			},
			json: true,
		});
	});

	it('should handle agentExecuteTransaction operation', async () => {
		mockGetNodeParameter.mockImplementation((paramName: string) => {
			switch (paramName) {
				case 'operation': return 'agentExecuteTransaction';
				case 'agentWalletId': return 'agent-wallet-123';
				case 'transactionData': return {
					calls: [{ transaction: 'serialized_transaction_data' }],
					chain: 'base-sepolia',
				};
				default: return '';
			}
		});

		const mockResponse = { transactionId: 'tx-123', status: 'executed' };
		mockHttpRequest.mockResolvedValue(mockResponse);

		const result = await node.execute.call(mockExecuteFunctions);

		expect(result).toEqual([[{ json: mockResponse, pairedItem: { item: 0 } }]]);
		expect(mockHttpRequest).toHaveBeenCalledWith({
			method: 'POST',
			url: 'https://staging.crossmint.com/api/2022-06-09/wallets/agent-wallet-123/transactions',
			headers: {
				'X-API-KEY': 'test-api-key',
				'Content-Type': 'application/json',
			},
			body: {
				params: {
					calls: [{ transaction: 'serialized_transaction_data' }],
					chain: 'base-sepolia',
				},
			},
			json: true,
		});
	});

	it('should handle agentCompletePayment operation', async () => {
		mockGetNodeParameter.mockImplementation((paramName: string) => {
			switch (paramName) {
				case 'operation': return 'agentCompletePayment';
				case 'agentOrderId': return 'order-123';
				case 'cardToken': return 'test-card-token';
				default: return '';
			}
		});

		const mockResponse = { paymentId: 'payment-123', status: 'completed' };
		mockHttpRequest.mockResolvedValue(mockResponse);

		const result = await node.execute.call(mockExecuteFunctions);

		expect(result).toEqual([[{ json: mockResponse, pairedItem: { item: 0 } }]]);
		expect(mockHttpRequest).toHaveBeenCalledWith({
			method: 'POST',
			url: 'https://staging.crossmint.com/api/2022-06-09/orders/order-123/payment',
			headers: {
				'X-API-KEY': 'test-api-key',
				'Content-Type': 'application/json',
			},
			body: {
				token: 'test-card-token',
			},
			json: true,
		});
	});

	describe('createWalletWithSigner', () => {
		it('should create wallet with EVM external signer', async () => {
			const mockCredentials = {
				apiKey: 'test-api-key',
			};

			const mockPrivateKeyCredentials = {
				privateKey: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
				chainType: 'evm',
			};

			const mockResponse = {
				id: 'wallet-123',
				address: '0x742d35Cc6634C0532925a3b8D0C9e0e7C0C0C0C0',
				type: 'evm-smart-wallet',
			};

			mockGetCredentials
				.mockResolvedValueOnce(mockCredentials)
				.mockResolvedValueOnce(mockPrivateKeyCredentials);

			mockHttpRequest.mockResolvedValue(mockResponse);

			mockGetNodeParameter
				.mockReturnValueOnce('wallet')
				.mockReturnValueOnce('createWalletWithSigner')
				.mockReturnValueOnce('evm');

			const result = await crossmintNode.execute.call(mockContext);

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
			const mockCredentials = {
				apiKey: 'test-api-key',
			};

			const mockPrivateKeyCredentials = {
				privateKey: '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtrzVHpcXjn5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtrzVHpcXjn',
				chainType: 'solana',
			};

			const mockResponse = {
				id: 'wallet-456',
				address: 'DjVE6JNiYqPL2QXyCUUh8rNjHrbz6hXHNYt99MQ59qw1',
				type: 'solana-custodial-wallet',
			};

			mockGetCredentials
				.mockResolvedValueOnce(mockCredentials)
				.mockResolvedValueOnce(mockPrivateKeyCredentials);

			mockHttpRequest.mockResolvedValue(mockResponse);

			mockGetNodeParameter
				.mockReturnValueOnce('wallet')
				.mockReturnValueOnce('createWalletWithSigner')
				.mockReturnValueOnce('solana');

			const result = await crossmintNode.execute.call(mockContext);

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

			mockGetNodeParameter
				.mockReturnValueOnce('wallet')
				.mockReturnValueOnce('signTransaction')
				.mockReturnValueOnce(JSON.stringify(transactionData))
				.mockReturnValueOnce(1);

			const result = await crossmintNode.execute.call(mockContext);

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
				privateKey: '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtrzVHpcXjn5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtrzVHpcXjn',
				chainType: 'solana',
			};

			const transactionData = {
				message: 'SGVsbG8gU29sYW5hIQ==',
			};

			mockGetCredentials.mockResolvedValue(mockPrivateKeyCredentials);

			mockGetNodeParameter
				.mockReturnValueOnce('wallet')
				.mockReturnValueOnce('signTransaction')
				.mockReturnValueOnce(JSON.stringify(transactionData))
				.mockReturnValueOnce(1);

			const result = await crossmintNode.execute.call(mockContext);

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

			mockGetNodeParameter
				.mockReturnValueOnce('wallet')
				.mockReturnValueOnce('signTransaction')
				.mockReturnValueOnce('invalid json')
				.mockReturnValueOnce(1);

			await expect(crossmintNode.execute.call(mockContext)).rejects.toThrow('Invalid transaction data JSON');
		});
	});
});
