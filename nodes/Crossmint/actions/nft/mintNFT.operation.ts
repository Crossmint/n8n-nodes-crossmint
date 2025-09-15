import { IExecuteFunctions, NodeOperationError } from 'n8n-workflow';
import { CrossmintApi } from '../../transport/CrossmintApi';
import { API_VERSIONS } from '../../utils/constants';
import { validateRequiredField } from '../../utils/validation';
import { buildNFTRecipient } from '../../utils/locators';
import { NFTMintRequest } from '../../transport/types';

export async function mintNFT(
	context: IExecuteFunctions,
	api: CrossmintApi,
	itemIndex: number,
): Promise<any> {
	const collectionId = context.getNodeParameter('collectionId', itemIndex) as string;
	const recipientData = context.getNodeParameter('nftRecipient', itemIndex) as any;
	const metadataType = context.getNodeParameter('metadataType', itemIndex) as string;

	validateRequiredField(collectionId, 'Collection ID', context, itemIndex);

	const chain = context.getNodeParameter('nftChain', itemIndex) as string;
	const recipient = buildNFTRecipient(recipientData, chain, context, itemIndex);

	const requestBody: NFTMintRequest = {
		recipient: recipient,
		sendNotification: context.getNodeParameter('sendNotification', itemIndex) as boolean,
		locale: context.getNodeParameter('nftLocale', itemIndex) as string,
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
		const name = context.getNodeParameter('nftName', itemIndex) as string;
		const image = context.getNodeParameter('nftImage', itemIndex) as string;
		const description = context.getNodeParameter('nftDescription', itemIndex) as string;

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

		const animationUrl = context.getNodeParameter('nftAnimationUrl', itemIndex) as string;
		const symbol = context.getNodeParameter('nftSymbol', itemIndex) as string;
		const attributesJson = context.getNodeParameter('nftAttributes', itemIndex) as string;

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
	return await api.post(endpoint, requestBody, API_VERSIONS.COLLECTIONS);
}
