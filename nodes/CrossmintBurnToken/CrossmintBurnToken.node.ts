import {
	IExecuteFunctions,
	INodeType,
	INodeTypeDescription,
	INodeExecutionData,
	INodeProperties,
	NodeConnectionTypes,
} from 'n8n-workflow';
import { CrossmintApi } from '../../shared/transport/CrossmintApi';
import { CrossmintCredentials } from '../../shared/transport/types';
import { burnToken } from '../../shared/actions/burnToken/burnToken.operation';

export class CrossmintBurnToken implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Crossmint Burn Token',
		name: 'crossmintBurnToken',
		icon: 'file:crossmint-burntoken.svg',
		group: ['transform'],
		version: 1,
		subtitle: 'Burn Token',
		description: 'Burn tokens using Crossmint Wallets API (creates burn transaction, signs, and submits)',
		defaults: {
			name: 'Crossmint Burn Token',
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
				displayName: 'Wallet Address',
				name: 'walletAddress',
				type: 'string',
				default: '',
				placeholder: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
				description: 'Wallet address that owns the tokens to burn',
				required: true,
			},
			{
				displayName: 'Token Locator',
				name: 'tokenLocator',
				type: 'string',
				default: '',
				placeholder: 'base:0xTIBBIR_CONTRACT_ADDRESS or base:0xTIBBIR_CONTRACT_ADDRESS:tokenId',
				description: 'Token locator in format chain:contractAddress (for fungible tokens) or chain:contractAddress:tokenId (for NFTs). For EVM: base:0x..., for Solana: solana:mintHash',
				required: true,
			},
			{
				displayName: 'Amount',
				name: 'amount',
				type: 'string',
				default: '',
				placeholder: '10',
				description: 'Amount of tokens to burn',
				required: true,
			},
			{
				displayName: 'Private Key',
				name: 'privateKey',
				type: 'string',
				typeOptions: { password: true },
				default: '',
				placeholder: '0x... (hex format for EVM)',
				description: 'Private key of the wallet that owns the tokens (hex format for EVM chains like Base)',
				required: true,
			},
			{
				displayName: 'Wait Until Transaction Is Completed',
				name: 'waitForCompletion',
				type: 'boolean',
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
				const result = await burnToken(this, api, itemIndex);

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

