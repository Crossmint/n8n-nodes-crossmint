import {
	IExecuteFunctions,
	INodeType,
	INodeTypeDescription,
	INodeExecutionData,
	NodeOperationError,
	NodeConnectionType,
} from 'n8n-workflow';
import { CrossmintApi } from '../../shared/transport/CrossmintApi';
import { CrossmintCredentials } from '../../shared/transport/types';
import {
	walletFields,
	createWallet,
	getWallet,
	getBalance,
	transferToken,
	signTransaction
} from '../../shared/actions/wallet';

export class CrossmintWallets implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Crossmint Wallets',
		name: 'crossmintWallets',
		icon: 'file:crossmint-wallet.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Interact with Crossmint Wallet APIs',
		defaults: {
			name: 'Crossmint Wallets',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
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
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Get or Create Wallet',
						value: 'createWallet',
						description: 'Create a wallet or retrieve an existing one',
						action: 'Get or create wallet',
					},
					{
						name: 'Get Wallet',
						value: 'getWallet',
						description: 'Get wallet details by locator',
						action: 'Get wallet',
					},
					{
						name: 'Get Balance',
						value: 'getBalance',
						description: 'Get wallet balance for tokens',
						action: 'Get balance',
					},
					{
						name: 'Create Transfer',
						value: 'transferToken',
						description: 'Transfer tokens between wallets',
						action: 'Create transfer',
					},
					{
						name: 'Sign Transaction',
						value: 'signAndSubmitTransaction',
						description: 'Sign and submit a transaction',
						action: 'Sign transaction',
					},
				],
				default: 'createWallet',
			},
			...walletFields,
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const credentials = await this.getCredentials<CrossmintCredentials>('crossmintApi');
		const api = new CrossmintApi(this, credentials);

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const operation = this.getNodeParameter('operation', itemIndex) as string;
				let result: any;

				switch (operation) {
					case 'createWallet':
						result = await createWallet(this, api, itemIndex);
						break;
					case 'getWallet':
						result = await getWallet(this, api, itemIndex);
						break;
					case 'getBalance':
						result = await getBalance(this, api, itemIndex);
						break;
					case 'transferToken':
						result = await transferToken(this, api, itemIndex);
						break;
					case 'signAndSubmitTransaction':
						result = await signTransaction(this, api, itemIndex);
						break;
					default:
						throw new NodeOperationError(this.getNode(), `Unknown wallet operation: ${operation}`, {
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