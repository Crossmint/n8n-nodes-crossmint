import { IExecuteFunctions, NodeApiError } from 'n8n-workflow';
import { CrossmintApi } from '../../transport/CrossmintApi';
import { API_VERSIONS } from '../../utils/constants';
import { validateRequiredField } from '../../utils/validation';

export async function getMintStatus(
	context: IExecuteFunctions,
	api: CrossmintApi,
	itemIndex: number,
): Promise<any> {
	const collectionId = context.getNodeParameter('statusCollectionId', itemIndex) as string;
	const tokenId = context.getNodeParameter('tokenId', itemIndex) as string;

	validateRequiredField(collectionId, 'Collection ID', context, itemIndex);
	validateRequiredField(tokenId, 'Token ID', context, itemIndex);

	const endpoint = `collections/${encodeURIComponent(collectionId)}/nfts/${encodeURIComponent(tokenId)}`;

	try {
		return await api.get(endpoint, API_VERSIONS.COLLECTIONS);
	} catch (error: any) {
		// Pass through the original Crossmint API error exactly as received
		throw new NodeApiError(context.getNode(), error);
	}
}
