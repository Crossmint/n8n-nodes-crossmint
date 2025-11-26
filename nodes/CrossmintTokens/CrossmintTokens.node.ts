import {
	IDataObject,
	IExecuteFunctions,
	INodeType,
	INodeTypeDescription,
	INodeExecutionData,
	INodeProperties,
	NodeConnectionTypes,
	NodeOperationError,
} from 'n8n-workflow';
import { CrossmintApi } from '../../shared/transport/CrossmintApi';
import { CrossmintCredentials } from '../../shared/transport/types';
import { buyToken } from '../../shared/actions/buyToken/buyToken.operation';
import { burnToken } from '../../shared/actions/burnToken/burnToken.operation';

export class CrossmintTokens implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Crossmint Tokens',
		name: 'crossmintTokens',
		icon: 'file:crossmint-tokens.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Buy and burn tokens using Crossmint APIs',
		defaults: {
			name: 'Crossmint Tokens',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'crossmintApi',
				required: true,
			},
		],
		requestDefaults: {
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
		},
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Token',
						value: 'token',
						description: 'Token operations',
					},
				],
				default: 'token',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['token'],
					},
				},
				options: [
					{
						name: 'Buy Token',
						value: 'buyToken',
						description: 'Buy tokens using Crossmint Orders API with cross-chain payments',
						action: 'Buy token',
					},
					{
						name: 'Burn Token',
						value: 'burnToken',
						description: 'Burn tokens using Crossmint Wallets API',
						action: 'Burn token',
					},
				],
				default: 'buyToken',
			},

			// ---- Buy Token fields
			{
				displayName: 'Payer Wallet Address',
				name: 'payerAddress',
				type: 'string',
				displayOptions: { show: { resource: ['token'], operation: ['buyToken'] } },
				default: '',
				placeholder: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
				description: 'Solana wallet address that will pay',
				required: true,
			},
			{
				displayName: 'Payment Currency',
				name: 'paymentCurrency',
				type: 'options',
				displayOptions: { show: { resource: ['token'], operation: ['buyToken'] } },
				options: [
					{
						name: 'USDC',
						value: 'usdc',
						description: 'USD Coin',
					},
					{
						name: 'SOL',
						value: 'sol',
						description: 'Solana native token',
					},
					{
						name: 'BONK',
						value: 'bonk',
						description: 'Bonk token',
					},
				],
				default: 'usdc',
				description: 'Currency to pay with on Solana',
				required: true,
			},
			{
				displayName: 'Recipient Wallet Address',
				name: 'recipientWalletAddress',
				type: 'string',
				displayOptions: { show: { resource: ['token'], operation: ['buyToken'] } },
				default: '',
				placeholder: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
				description: 'Base wallet address that will receive the tokens',
				required: true,
			},
			{
				displayName: 'Token Locator',
				name: 'tokenLocator',
				type: 'string',
				displayOptions: { show: { resource: ['token'], operation: ['buyToken'] } },
				default: '',
				placeholder: 'base:0xTIBBIR_CONTRACT_ADDRESS or base:0xTIBBIR_CONTRACT_ADDRESS:tokenId',
				description: 'Token locator in format chain:contractAddress (for fungible tokens) or chain:contractAddress:tokenId (for NFTs). For EVM: base:0x..., for Solana: solana:mintHash',
				required: true,
			},
			{
				displayName: 'Amount',
				name: 'amount',
				type: 'string',
				displayOptions: { show: { resource: ['token'], operation: ['buyToken'] } },
				default: '',
				placeholder: '10',
				description: 'Amount of tokens to buy',
				required: true,
			},
			{
				displayName: 'Max Slippage BPS',
				name: 'maxSlippageBps',
				type: 'string',
				displayOptions: { show: { resource: ['token'], operation: ['buyToken'] } },
				default: '500',
				placeholder: '500',
				description: 'Maximum slippage in basis points (100 = 1%). Optional - if not provided, default slippage will be applied',
				required: false,
			},
			{
				displayName: 'Payer Private Key',
				name: 'privateKey',
				type: 'string',
				typeOptions: { password: true },
				displayOptions: { show: { resource: ['token'], operation: ['buyToken'] } },
				default: '',
				placeholder: 'base58 encoded private key',
				description: 'Private key of the payer wallet (base58 for Solana)',
				required: true,
			},
			{
				displayName: 'Wait Until Order Is Completed',
				name: 'waitForCompletion',
				type: 'boolean',
				displayOptions: { show: { resource: ['token'], operation: ['buyToken'] } },
				default: true,
				description: 'Whether to wait until the order reaches final status (completed, success, or failed) before completing the node execution',
			},

			// ---- Burn Token fields
			{
				displayName: 'Wallet Address',
				name: 'walletAddress',
				type: 'string',
				displayOptions: { show: { resource: ['token'], operation: ['burnToken'] } },
				default: '',
				placeholder: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
				description: 'Wallet address that owns the tokens to burn',
				required: true,
			},
			{
				displayName: 'Token Locator',
				name: 'tokenLocator',
				type: 'string',
				displayOptions: { show: { resource: ['token'], operation: ['burnToken'] } },
				default: '',
				placeholder: 'base:0xTIBBIR_CONTRACT_ADDRESS or base:0xTIBBIR_CONTRACT_ADDRESS:tokenId',
				description: 'Token locator in format chain:contractAddress (for fungible tokens) or chain:contractAddress:tokenId (for NFTs). For EVM: base:0x..., for Solana: solana:mintHash',
				required: true,
			},
			{
				displayName: 'Amount',
				name: 'amount',
				type: 'string',
				displayOptions: { show: { resource: ['token'], operation: ['burnToken'] } },
				default: '',
				placeholder: '1 or 1.5',
				description: 'Amount of tokens to burn (will be automatically converted to wei - smallest unit). Supports decimals up to 18 places.',
				required: true,
			},
			{
				displayName: 'Private Key',
				name: 'privateKey',
				type: 'string',
				typeOptions: { password: true },
				displayOptions: { show: { resource: ['token'], operation: ['burnToken'] } },
				default: '',
				placeholder: '0x... (hex format for EVM)',
				description: 'Private key of the wallet that owns the tokens (hex format for EVM chains like Base)',
				required: true,
			},
			{
				displayName: 'Wait Until Transaction Is Completed',
				name: 'waitForCompletion',
				type: 'boolean',
				displayOptions: { show: { resource: ['token'], operation: ['burnToken'] } },
				default: true,
				description: 'Whether to wait until the transaction reaches final status (success or failed) before completing the node execution',
			},
		] as INodeProperties[],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const credentials = await this.getCredentials<CrossmintCredentials>('crossmintApi');
		const api = new CrossmintApi(this, credentials);

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const operation = this.getNodeParameter('operation', itemIndex) as string;
				let result: IDataObject;

				switch (operation) {
					case 'buyToken':
						result = await buyToken(this, api, itemIndex);
						break;
					case 'burnToken':
						result = await burnToken(this, api, itemIndex);
						break;
					default:
						throw new NodeOperationError(this.getNode(), `Unknown token operation: ${operation}`, {
							itemIndex,
						});
				}

				const executionData: INodeExecutionData = {
					json: result,
					pairedItem: { item: itemIndex },
				};

				returnData.push(executionData);
			} catch (error) {
				if (this.continueOnFail()) {
					const executionData: INodeExecutionData = {
						json: { error: error.message },
						pairedItem: { item: itemIndex },
					};
					returnData.push(executionData);
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}

