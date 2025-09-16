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

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const credentials = await this.getCredentials('crossmintApi') as CrossmintCredentials;

		if (!credentials) {
			throw new NodeOperationError(this.getNode(), 'No credentials found');
		}

		const api = new CrossmintApi(this, credentials);
		const executionData: INodeExecutionData[] = [];
		const executionErrorData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const resource = this.getNodeParameter('resource', itemIndex) as string;
				const operation = this.getNodeParameter('operation', itemIndex) as string;

				let result: any;

				if (resource === 'wallet') {
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
				} else if (resource === 'checkout') {
					switch (operation) {
						case 'findProduct':
							result = await findProduct(this, api, itemIndex);
							break;
						case 'purchaseProduct':
							result = await purchaseProduct(this, api, itemIndex);
							break;
						default:
							throw new NodeOperationError(this.getNode(), `Unknown checkout operation: ${operation}`, {
								itemIndex,
							});
					}
				} else if (resource === 'nft') {
					switch (operation) {
						case 'mintNFT':
							result = await mintNFT(this, api, itemIndex);
							break;
						case 'getNFTsFromWallet':
							result = await getNFTsFromWallet(this, api, itemIndex);
							break;
						default:
							throw new NodeOperationError(this.getNode(), `Unknown NFT operation: ${operation}`, {
								itemIndex,
							});
					}
				} else {
					throw new NodeOperationError(this.getNode(), `Unknown resource: ${resource}`, {
						itemIndex,
					});
				}

				executionData.push({
					json: result,
					pairedItem: { item: itemIndex },
				});

			} catch (error) {
				if (this.continueOnFail()) {
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
