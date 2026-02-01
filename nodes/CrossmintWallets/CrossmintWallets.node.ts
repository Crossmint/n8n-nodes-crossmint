import {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	INodeExecutionData,
	INodeProperties,
	NodeOperationError,
	NodeConnectionTypes,
} from 'n8n-workflow';
import { CrossmintApi } from '../../shared/transport/CrossmintApi';
import { CrossmintCredentials } from '../../shared/transport/types';
import { createWallet } from '../../shared/actions/wallet/createWallet.operation';
import { getWallet } from '../../shared/actions/wallet/getWallet.operation';
import { getBalance } from '../../shared/actions/wallet/getBalance.operation';
import { transferToken } from '../../shared/actions/wallet/transferToken.operation';
import { signTransaction } from '../../shared/actions/wallet/signTransaction.operation';
import {
	createResourceProperty,
	createOperationProperty,
	WALLET_OPERATIONS,
	createGetOrCreateWalletFields,
	createGetWalletFields,
	createTransferFields,
	createGetBalanceFields,
	createTokenTransferFields,
	createBalanceQueryFields,
	createTransactionSigningFields,
} from '../../shared/nodeProperties';
import { ChainFactory } from '../../shared/chains/ChainFactory';

export class CrossmintWallets implements INodeType {
	methods = {
		loadOptions: {
			// Solana network options - filtered by credential environment
			async getSolanaNetworkOptions(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const credentials = await this.getCredentials<CrossmintCredentials>('crossmintApi');
				const isProduction = credentials.environment === 'production';

				return isProduction
					? ChainFactory.getSolanaMainnetOptions()
					: ChainFactory.getSolanaTestnetOptions();
			},

			// EVM network options - filtered by credential environment
			async getEvmNetworkOptions(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const credentials = await this.getCredentials<CrossmintCredentials>('crossmintApi');
				const isProduction = credentials.environment === 'production';

				return isProduction
					? ChainFactory.getEvmMainnetOptions()
					: ChainFactory.getEvmTestnetOptions();
			},
		},
	};

	description: INodeTypeDescription = {
		displayName: 'Crossmint Wallets',
		name: 'crossmintWallets',
		icon: 'file:crossmint-wallet.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Interact with Crossmint Wallet APIs',
		defaults: {
			name: 'Crossmint Wallets',
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
			// Resource and Operation selectors
			createResourceProperty([{ name: 'Wallet', value: 'wallet', description: 'Crossmint wallet operations' }]),
			createOperationProperty('wallet', WALLET_OPERATIONS, 'getOrCreateWallet'),

			// Get or Create Wallet operation
			...createGetOrCreateWalletFields(),

			// Get Wallet operation
			...createGetWalletFields(),

			// Create Transfer operation
			...createTransferFields(),
			...createTokenTransferFields('createTransfer'),

			// Get Balance operation
			...createGetBalanceFields(),
			...createBalanceQueryFields('getBalance'),

			// Sign Transaction operation
			...createTransactionSigningFields('signTransaction'),
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
					case 'getOrCreateWallet':
						result = await createWallet(this, api, itemIndex);
						break;
					case 'getWallet':
						result = await getWallet(this, api, itemIndex);
						break;
					case 'getBalance':
						result = await getBalance(this, api, itemIndex);
						break;
					case 'createTransfer':
						result = await transferToken(this, api, itemIndex);
						break;
					case 'signTransaction':
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