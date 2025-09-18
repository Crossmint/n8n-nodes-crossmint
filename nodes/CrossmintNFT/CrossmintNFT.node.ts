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
	nftFields,
	mintNFT,
	getNFTsFromWallet
} from '../../shared/actions/nft';

export class CrossmintNFT implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Crossmint NFT',
		name: 'crossmintNFT',
		icon: 'file:crossmint-nft.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Interact with Crossmint NFT APIs',
		defaults: {
			name: 'Crossmint NFT',
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
						name: 'Mint NFT',
						value: 'mintNFT',
						description: 'Mint a new NFT to a wallet',
						action: 'Mint NFT',
					},
					{
						name: 'Get NFTs From Wallet',
						value: 'getNFTsFromWallet',
						description: 'Fetch the NFTs in a provided wallet',
						action: 'Get nfts from wallet',
					},
				],
				default: 'mintNFT',
			},
			...nftFields,
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