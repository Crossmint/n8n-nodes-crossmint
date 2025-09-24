import { IExecuteFunctions } from 'n8n-workflow';
import { CrossmintApi } from '../../transport/CrossmintApi';
import { API_VERSIONS } from '../../utils/constants';
import { buildWalletLocator } from '../../utils/locators';

export async function getBalance(
	context: IExecuteFunctions,
	api: CrossmintApi,
	itemIndex: number,
): Promise<any> {
	const walletResource = context.getNodeParameter('walletLocator', itemIndex) as any;
	const chains = context.getNodeParameter('chains', itemIndex) as string;
	const tokens = context.getNodeParameter('tokens', itemIndex) as string;
	const chainType = context.getNodeParameter('balanceWalletChainType', itemIndex) as string;

	const walletLocator = buildWalletLocator(walletResource, chainType, context, itemIndex);

	const endpoint = `wallets/${walletLocator}/balances?chains=${encodeURIComponent(chains)}&tokens=${encodeURIComponent(tokens)}`;

	// Build request details for error reporting
	const requestDetails = {
		endpoint,
		method: 'GET',
		walletLocator,
		parameters: {
			chains,
			tokens,
			chainType,
			walletResource
		},
		apiVersion: API_VERSIONS.WALLETS
	};

	try {
		return await api.get(endpoint, API_VERSIONS.WALLETS);
	} catch (error: any) {
		// Return error details as node output instead of throwing
		return {
			error: true,
			errorMessage: error.message || 'Unknown error',
			statusCode: error.response?.status || error.status || 'Unknown',
			requestDetails,
			originalError: error.response?.data || error
		};
	}
}
