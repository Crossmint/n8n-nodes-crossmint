import { IExecuteFunctions, NodeApiError } from 'n8n-workflow';
import { CrossmintApi } from '../../transport/CrossmintApi';
import { API_VERSIONS } from '../../utils/constants';
import { buildWalletLocator } from '../../utils/locators';
import { WalletLocatorData, ApiResponse } from '../../transport/types';

export async function getBalance(
	context: IExecuteFunctions,
	api: CrossmintApi,
	itemIndex: number,
): Promise<ApiResponse> {
	const walletResource = context.getNodeParameter('walletLocator', itemIndex) as WalletLocatorData;
	const chainType = context.getNodeParameter('balanceWalletChainType', itemIndex) as string;
	
	// Get chain based on blockchain type (Solana or EVM have separate fields)
	// Use whichever parameter is set
	const chainsSolana = context.getNodeParameter('chainsSolana', itemIndex, '') as string;
	const chainsEvm = context.getNodeParameter('chainsEvm', itemIndex, '') as string;
	const chains = chainsSolana || chainsEvm;
	
	const tkn = context.getNodeParameter('tkn', itemIndex) as string;

	const walletLocator = buildWalletLocator(walletResource, chainType, context, itemIndex);

	const endpoint = `wallets/${walletLocator}/balances?chains=${encodeURIComponent(chains)}&tokens=${encodeURIComponent(tkn)}`;

	try {
		return await api.get(endpoint, API_VERSIONS.WALLETS);
	} catch (error: unknown) {
		// Pass through the original Crossmint API error exactly as received
		throw new NodeApiError(context.getNode(), error as object & { message?: string });
	}
}
