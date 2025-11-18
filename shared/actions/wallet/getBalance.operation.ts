import { IExecuteFunctions, NodeApiError, NodeOperationError } from 'n8n-workflow';
import { CrossmintApi } from '../../transport/CrossmintApi';
import { API_VERSIONS } from '../../utils/constants';
import { buildWalletLocator } from '../../utils/locators';
import { WalletLocatorData, ApiResponse } from '../../transport/types';

export async function getBalanceByLocator(
	api: CrossmintApi,
	walletLocator: string,
	chains: string,
	tkn: string,
): Promise<ApiResponse> {
	const endpoint = `wallets/${walletLocator}/balances?chains=${encodeURIComponent(chains)}&tokens=${encodeURIComponent(tkn)}`;
	return await api.get(endpoint, API_VERSIONS.WALLETS);
}

export async function getBalance(
	context: IExecuteFunctions,
	api: CrossmintApi,
	itemIndex: number,
): Promise<ApiResponse> {
	const walletResource = context.getNodeParameter('walletLocator', itemIndex) as WalletLocatorData;
	const chains = context.getNodeParameter('chains', itemIndex) as string;
	const tkn = context.getNodeParameter('tkn', itemIndex) as string;

	if (chains !== 'solana') {
		throw new NodeOperationError(
			context.getNode(),
			`Chains must be set to 'solana' for smart wallets`,
			{ itemIndex },
		);
	}

	const walletLocator = buildWalletLocator(walletResource, 'solana', context, itemIndex);

	try {
		return await getBalanceByLocator(api, walletLocator, chains, tkn);
	} catch (error: unknown) {
		// Pass through the original Crossmint API error exactly as received
		throw new NodeApiError(context.getNode(), error as object & { message?: string });
	}
}
