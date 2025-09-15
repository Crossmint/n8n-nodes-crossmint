import {
	IExecuteFunctions,
	INodeType,
	INodeTypeDescription,
	INodeExecutionData,
	NodeOperationError,
} from 'n8n-workflow';
import { NodeConnectionType } from 'n8n-workflow';
import { CrossmintApi } from './transport/CrossmintApi';
import { CrossmintCredentials } from './transport/types';
import { 
	walletFields, 
	createWallet, 
	getWallet, 
	getBalance, 
	transferToken, 
	signTransaction 
} from './actions/wallet';
import { 
	checkoutFields, 
	findProduct, 
	purchaseProduct 
} from './actions/checkout';
import { 
	nftFields, 
	mintNFT, 
	getNFTsFromWallet 
} from './actions/nft';

export class Crossmint implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Crossmint',
		name: 'crossmint',
		icon: 'file:crossmint.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Interact with Crossmint API for wallet management, NFT operations, and e-commerce',
		defaults: {
			name: 'Crossmint',
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
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Wallet',
						value: 'wallet',
						description: 'Wallet operations',
					},
					{
						name: 'Checkout',
						value: 'checkout',
						description: 'E-commerce checkout operations',
					},
					{
						name: 'NFT',
						value: 'nft',
						description: 'NFT operations',
					},
				],
				default: 'wallet',
			},
			...walletFields,
			...checkoutFields,
			...nftFields,
		],
	};

	async execute(context: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = context.getInputData();
		const credentials = await context.getCredentials('crossmintApi') as CrossmintCredentials;

		if (!credentials) {
			throw new NodeOperationError(context.getNode(), 'No credentials found');
		}

		const api = new CrossmintApi(context, credentials);
		const executionData: INodeExecutionData[] = [];
		const executionErrorData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const resource = context.getNodeParameter('resource', itemIndex) as string;
				const operation = context.getNodeParameter('operation', itemIndex) as string;

				let result: any;

				if (resource === 'wallet') {
					switch (operation) {
						case 'createWallet':
							result = await createWallet(context, api, itemIndex);
							break;
						case 'getWallet':
							result = await getWallet(context, api, itemIndex);
							break;
						case 'getBalance':
							result = await getBalance(context, api, itemIndex);
							break;
						case 'transferToken':
							result = await transferToken(context, api, itemIndex);
							break;
						case 'signAndSubmitTransaction':
							result = await signTransaction(context, api, itemIndex);
							break;
						default:
							throw new NodeOperationError(context.getNode(), `Unknown wallet operation: ${operation}`, {
								itemIndex,
							});
					}
				} else if (resource === 'checkout') {
					switch (operation) {
						case 'findProduct':
							result = await findProduct(context, api, itemIndex);
							break;
						case 'purchaseProduct':
							result = await purchaseProduct(context, api, itemIndex);
							break;
						default:
							throw new NodeOperationError(context.getNode(), `Unknown checkout operation: ${operation}`, {
								itemIndex,
							});
					}
				} else if (resource === 'nft') {
					switch (operation) {
						case 'mintNFT':
							result = await mintNFT(context, api, itemIndex);
							break;
						case 'getNFTsFromWallet':
							result = await getNFTsFromWallet(context, api, itemIndex);
							break;
						default:
							throw new NodeOperationError(context.getNode(), `Unknown NFT operation: ${operation}`, {
								itemIndex,
							});
					}
				} else {
					throw new NodeOperationError(context.getNode(), `Unknown resource: ${resource}`, {
						itemIndex,
					});
				}

				executionData.push({
					json: result,
					pairedItem: { item: itemIndex },
				});

			} catch (error) {
				if (context.continueOnFail()) {
					executionErrorData.push({
						json: { error: error.message },
						pairedItem: { item: itemIndex },
					});
				} else {
					throw error;
				}
			}
		}

		if (executionErrorData.length > 0) {
			return [executionData, executionErrorData];
		}

		return [executionData];
	}
}
