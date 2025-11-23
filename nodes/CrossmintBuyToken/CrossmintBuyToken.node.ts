import {
	IDataObject,
	IExecuteFunctions,
	INodeType,
	INodeTypeDescription,
	INodeExecutionData,
	INodeProperties,
	NodeOperationError,
	NodeConnectionTypes,
} from 'n8n-workflow';
import { CrossmintApi } from '../../shared/transport/CrossmintApi';
import { CrossmintCredentials } from '../../shared/transport/types';
import { buyToken } from '../../shared/actions/buyToken/buyToken.operation';

export class CrossmintBuyToken implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Crossmint Buy Token',
		name: 'crossmintBuyToken',
		icon: 'file:crossmint-buytoken.svg',
		group: ['transform'],
		version: 1,
		subtitle: 'Buy Token',
		description: 'Buy tokens using Crossmint Orders API with cross-chain payments (creates order, signs transaction, and polls for completion)',
		defaults: {
			name: 'Crossmint Buy Token',
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
				displayName: 'Payer Wallet Address',
				name: 'payerAddress',
				type: 'string',
				default: '',
				placeholder: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
				description: 'Solana wallet address that will pay with USDC',
				required: true,
			},
			{
				displayName: 'Recipient Wallet Address',
				name: 'recipientWalletAddress',
				type: 'string',
				default: '',
				placeholder: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
				description: 'Base wallet address that will receive the tokens',
				required: true,
			},
			{
				displayName: 'Token Locator',
				name: 'tokenLocator',
				type: 'string',
				default: '',
				placeholder: 'base:0xTIBBIR_CONTRACT_ADDRESS',
				description: 'Token locator in format chain:contractAddress (e.g., base:0x...)',
				required: true,
			},
			{
				displayName: 'Amount',
				name: 'amount',
				type: 'string',
				default: '',
				placeholder: '10',
				description: 'Amount of tokens to buy',
				required: true,
			},
			{
				displayName: 'Max Slippage BPS',
				name: 'maxSlippageBps',
				type: 'string',
				default: '500',
				placeholder: '500',
				description: 'Maximum slippage in basis points (100 = 1%)',
				required: true,
			},
			{
				displayName: 'Payer Private Key',
				name: 'privateKey',
				type: 'string',
				typeOptions: { password: true },
				default: '',
				placeholder: 'base58 encoded private key',
				description: 'Private key of the payer wallet (base58 for Solana)',
				required: true,
			},
			{
				displayName: 'Wait Until Order Is Completed',
				name: 'waitForCompletion',
				type: 'boolean',
				default: true,
				description: 'Whether to wait until the order reaches final status (completed, success, or failed) before completing the node execution',
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
				const result = await buyToken(this, api, itemIndex);

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

