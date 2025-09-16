import { IExecuteFunctions, NodeApiError } from 'n8n-workflow';
import { CrossmintApi } from '../../transport/CrossmintApi';
import { API_VERSIONS, PAGINATION } from '../../utils/constants';
import { buildNFTWalletIdentifier } from '../../utils/locators';

export async function getNFTsFromWallet(
	context: IExecuteFunctions,
	api: CrossmintApi,
	itemIndex: number,
): Promise<any> {
	const walletIdentifierData = context.getNodeParameter('walletIdentifier', itemIndex) as any;
	const contractAddressesStr = context.getNodeParameter('contractAddresses', itemIndex) as string;
	const tokenId = context.getNodeParameter('nftsTokenId', itemIndex) as string;
	const chain = context.getNodeParameter('nftsWalletChain', itemIndex) as string;

	const walletIdentifier = buildNFTWalletIdentifier(walletIdentifierData, chain, context, itemIndex);

	const baseQueryParams: any = {};

	if (contractAddressesStr && contractAddressesStr.trim() !== '') {
		const addresses = contractAddressesStr.split(',').map(addr => addr.trim()).filter(addr => addr !== '');
		if (addresses.length > 0) {
			baseQueryParams.contractAddress = addresses;
		}
	}

	if (tokenId && tokenId.trim() !== '') {
		baseQueryParams.tokenId = tokenId.trim();
	}

	const allNFTs: any[] = [];
	let currentPage = 1;
	const perPage = PAGINATION.DEFAULT_PER_PAGE;

	try {
		while (true) {
			const queryParams = {
				...baseQueryParams,
				page: currentPage.toString(),
				perPage: perPage.toString(),
			};

			const queryString = new URLSearchParams();
			Object.keys(queryParams).forEach(key => {
				const value = queryParams[key];
				if (Array.isArray(value)) {
					value.forEach(item => queryString.append(key, item));
				} else {
					queryString.append(key, value);
				}
			});

			const endpoint = `wallets/${encodeURIComponent(walletIdentifier)}/nfts?${queryString.toString()}`;
			const pageResponse = await api.get(endpoint, API_VERSIONS.COLLECTIONS);

			if (Array.isArray(pageResponse) && pageResponse.length > 0) {
				allNFTs.push(...pageResponse);

				if (pageResponse.length < perPage) {
					break;
				}

				currentPage++;
			} else {
				break;
			}
		}

		return allNFTs;
	} catch (error: any) {
		// Pass through the original Crossmint API error exactly as received
		throw new NodeApiError(context.getNode(), error);
	}
}
