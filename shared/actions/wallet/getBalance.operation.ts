import { IExecuteFunctions, NodeApiError } from 'n8n-workflow';
import { CrossmintApi } from '../../transport/CrossmintApi';
import { API_VERSIONS } from '../../utils/constants';
import { buildWalletLocator } from '../../utils/locators';
import { WalletLocatorData, ApiResponse } from '../../transport/types';

/**
 * Reusable function to get wallet balance from the API
 * @param api - CrossmintApi instance
 * @param walletLocator - Wallet locator string (e.g., "address:ABC123..." or "email:user@example.com:solana:smart")
 * @param chains - Comma-separated list of chains (e.g., "solana" or "solana-devnet")
 * @param tokens - Comma-separated list of tokens (e.g., "sol,usdc")
 * @returns Balance response from the API
 */
export async function getWalletBalance(
	api: CrossmintApi,
	walletLocator: string,
	chains: string,
	tokens: string,
): Promise<ApiResponse> {
	const endpoint = `wallets/${walletLocator}/balances?chains=${encodeURIComponent(chains)}&tokens=${encodeURIComponent(tokens)}`;
	return await api.get(endpoint, API_VERSIONS.WALLETS);
}

/**
 * Operation function for n8n node - gets balance using node parameters
 */
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

	try {
		return await getWalletBalance(api, walletLocator, chains, tkn);
	} catch (error: unknown) {
		// Pass through the original Crossmint API error exactly as received
		throw new NodeApiError(context.getNode(), error as object & { message?: string });
	}
}
