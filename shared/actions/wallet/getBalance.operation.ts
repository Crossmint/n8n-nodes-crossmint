import { IExecuteFunctions, NodeApiError } from 'n8n-workflow';
import { CrossmintApi } from '../../transport/CrossmintApi';
import { WalletApi } from '../../api/wallet.api';
import { buildWalletLocator } from '../../utils/locators';
import { WalletLocatorData, ApiResponse } from '../../transport/types';

export async function getBalance(
	context: IExecuteFunctions,
	api: CrossmintApi,
	itemIndex: number,
): Promise<ApiResponse> {
	const walletResource = context.getNodeParameter('walletLocator', itemIndex) as WalletLocatorData;
	const chains = context.getNodeParameter('chains', itemIndex) as string;
	const tkn = context.getNodeParameter('tkn', itemIndex) as string;
	const chainType = context.getNodeParameter('balanceWalletChainType', itemIndex) as string;

	const walletLocator = buildWalletLocator(walletResource, chainType, context, itemIndex);
	const walletApi = new WalletApi(api);

	try {
		return await walletApi.getBalance(walletLocator, chains, tkn);
	} catch (error: unknown) {
		throw new NodeApiError(context.getNode(), error as object & { message?: string });
	}
}
