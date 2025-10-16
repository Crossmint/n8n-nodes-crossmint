import { IExecuteFunctions, NodeApiError } from 'n8n-workflow';
import { CrossmintApi } from '../../transport/CrossmintApi';
import { API_VERSIONS } from '../../utils/constants';
import { buildTokenWalletIdentifier } from '../../utils/locators';

export async function getTokensFromWallet(
	context: IExecuteFunctions,
	api: CrossmintApi,
	itemIndex: number,
): Promise<any> {
	const walletIdentifierData = context.getNodeParameter('walletIdentifier', itemIndex) as any;
	const chain = context.getNodeParameter('walletChain', itemIndex) as string;

	// Build the wallet identifier using the utility function
	const identifier = buildTokenWalletIdentifier(walletIdentifierData, chain, context, itemIndex);

	// Get options
	const options = context.getNodeParameter('walletTokensOptions', itemIndex, {}) as any;

	// Build query parameters
	const queryParams: string[] = [];

	// Add pagination
	if (options.page) {
		queryParams.push(`page=${options.page}`);
	}
	if (options.perPage) {
		queryParams.push(`perPage=${options.perPage}`);
	}

	// Add filters
	if (options.contractAddress) {
		const addresses = options.contractAddress.split(',').map((addr: string) => addr.trim());
		addresses.forEach((addr: string) => {
			queryParams.push(`contractAddress=${encodeURIComponent(addr)}`);
		});
	}
	if (options.tokenId) {
		queryParams.push(`tokenId=${encodeURIComponent(options.tokenId)}`);
	}

	const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
	const endpoint = `wallets/${encodeURIComponent(identifier)}/nfts${queryString}`;

	try {
		return await api.get(endpoint, API_VERSIONS.COLLECTIONS);
	} catch (error: any) {
		// Pass through the original Crossmint API error exactly as received
		throw new NodeApiError(context.getNode(), error);
	}
}
