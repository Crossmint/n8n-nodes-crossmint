import { IExecuteFunctions } from 'n8n-workflow';
import { CrossmintApi } from '../../transport/CrossmintApi';
import { API_VERSIONS } from '../../utils/constants';
import { buildWalletLocator } from '../../utils/locators';
import { WalletLocatorData, ApiResponse } from '../../transport/types';

export async function getWalletByLocator(
	api: CrossmintApi,
	walletLocator: string,
): Promise<ApiResponse> {
	return await api.get(`wallets/${walletLocator}`, API_VERSIONS.WALLETS);
}

export async function getWallet(
	context: IExecuteFunctions,
	api: CrossmintApi,
	itemIndex: number,
): Promise<ApiResponse> {
	const walletResource = context.getNodeParameter('getWalletLocator', itemIndex) as WalletLocatorData;
	const chainType = context.getNodeParameter('getWalletChainType', itemIndex) as string;

	const walletLocator = buildWalletLocator(walletResource, chainType, context, itemIndex);

	return await getWalletByLocator(api, walletLocator);
}
