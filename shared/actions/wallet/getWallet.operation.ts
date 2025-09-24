import { IExecuteFunctions, NodeApiError } from 'n8n-workflow';
import { CrossmintApi } from '../../transport/CrossmintApi';
import { API_VERSIONS } from '../../utils/constants';
import { buildWalletLocator } from '../../utils/locators';

export async function getWallet(
	context: IExecuteFunctions,
	api: CrossmintApi,
	itemIndex: number,
): Promise<any> {
	const walletResource = context.getNodeParameter('getWalletLocator', itemIndex) as any;
	const chainType = context.getNodeParameter('getWalletChainType', itemIndex) as string;

	const walletLocator = buildWalletLocator(walletResource, chainType, context, itemIndex);

	try {
		return await api.get(`wallets/${walletLocator}`, API_VERSIONS.WALLETS);
	} catch (error: any) {
		// Pass through the original Crossmint API error exactly as received
		throw new NodeApiError(context.getNode(), error);
	}
}
