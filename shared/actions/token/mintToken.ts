import { IExecuteFunctions, NodeOperationError, NodeApiError, IDataObject } from 'n8n-workflow';
import { CrossmintApi } from '../../transport/CrossmintApi';
import { API_VERSIONS } from '../../utils/constants';
import { validateRequiredField } from '../../utils/validation';
import { buildTokenRecipient } from '../../utils/locators';
import { TokenMintRequest } from '../../transport/types';

export async function mintToken(
	context: IExecuteFunctions,
	api: CrossmintApi,
	itemIndex: number,
): Promise<any> {
	const collectionId = context.getNodeParameter('collectionId', itemIndex) as string;
	const recipientData = context.getNodeParameter('tokenRecipient', itemIndex) as any;
	const metadataType = context.getNodeParameter('metadataType', itemIndex) as string;

	validateRequiredField(collectionId, 'Collection ID', context, itemIndex);

	const chain = context.getNodeParameter('tokenChain', itemIndex) as string;
	const recipient = buildTokenRecipient(recipientData, chain, context, itemIndex);

	const requestBody: TokenMintRequest = {
		recipient: recipient,
		sendNotification: context.getNodeParameter('sendNotification', itemIndex) as boolean,
		locale: context.getNodeParameter('tokenLocale', itemIndex) as string,
		reuploadLinkedFiles: context.getNodeParameter('reuploadLinkedFiles', itemIndex) as boolean,
		compressed: context.getNodeParameter('compressed', itemIndex) as boolean,
	};

	if (metadataType === 'template') {
		const templateId = context.getNodeParameter('templateId', itemIndex) as string;
		validateRequiredField(templateId, 'Template ID', context, itemIndex);
		requestBody.templateId = templateId;
	} else if (metadataType === 'url') {
		const metadataUrl = context.getNodeParameter('metadataUrl', itemIndex) as string;
		validateRequiredField(metadataUrl, 'Metadata URL', context, itemIndex);
		requestBody.metadata = metadataUrl;
	} else {
		const name = context.getNodeParameter('tokenName', itemIndex) as string;
		const image = context.getNodeParameter('tokenImage', itemIndex) as string;
		const description = context.getNodeParameter('tokenDescription', itemIndex) as string;

		if (!name || !image || !description) {
			throw new NodeOperationError(context.getNode(), 'Name, Image, and Description are required for metadata object mode', {
				itemIndex,
			});
		}

		const metadata: any = {
			name: name,
			image: image,
			description: description,
		};

		const animationUrl = context.getNodeParameter('tokenAnimationUrl', itemIndex) as string;
		const symbol = context.getNodeParameter('tokenSymbol', itemIndex) as string;
		const attributesJson = context.getNodeParameter('tokenAttributes', itemIndex) as string;

		if (animationUrl) {
			metadata.animation_url = animationUrl;
		}

		if (symbol) {
			metadata.symbol = symbol;
		}

		if (attributesJson && attributesJson.trim() !== '') {
			try {
				const attributes = JSON.parse(attributesJson);
				if (Array.isArray(attributes)) {
					metadata.attributes = attributes;
				}
			} catch {
				throw new NodeOperationError(context.getNode(), 'Invalid JSON format for attributes', {
					description: 'Please provide a valid JSON array for attributes',
					itemIndex,
				});
			}
		}

		requestBody.metadata = metadata;
	}

	const endpoint = `collections/${encodeURIComponent(collectionId)}/nfts`;

	try {
		return await api.post(endpoint, requestBody as unknown as IDataObject, API_VERSIONS.COLLECTIONS);
	} catch (error: any) {
		// Pass through the original Crossmint API error exactly as received
		throw new NodeApiError(context.getNode(), error);
	}
}
