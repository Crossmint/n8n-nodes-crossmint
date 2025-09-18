import { IExecuteFunctions, NodeApiError } from 'n8n-workflow';
import { CrossmintApi } from '../../transport/CrossmintApi';
import { API_VERSIONS } from '../../utils/constants';
import { validateRequiredField } from '../../utils/validation';
import { deriveKeyPair } from '../../utils/blockchain';
import { WalletCreateRequest } from '../../transport/types';

export async function createWallet(
	context: IExecuteFunctions,
	api: CrossmintApi,
	itemIndex: number,
): Promise<any> {
	const chainType = context.getNodeParameter('chainType', itemIndex) as string;
	const ownerType = context.getNodeParameter('ownerType', itemIndex) as string;
	const externalSignerDetails = context.getNodeParameter('externalSignerDetails', itemIndex) as string;

	validateRequiredField(externalSignerDetails, 'External signer private key', context, itemIndex);

	const keyPair = deriveKeyPair(externalSignerDetails, context, itemIndex);

	const adminSigner = {
		type: 'external-wallet',
		address: keyPair.address,
	};

	let owner: string | undefined;
	if (ownerType !== 'none') {
		switch (ownerType) {
			case 'email': {
				const ownerEmail = context.getNodeParameter('ownerEmail', itemIndex) as string;
				owner = `email:${ownerEmail}`;
				break;
			}
			case 'userId': {
				const ownerUserId = context.getNodeParameter('ownerUserId', itemIndex) as string;
				owner = `userId:${ownerUserId}`;
				break;
			}
			case 'phoneNumber': {
				const ownerPhoneNumber = context.getNodeParameter('ownerPhoneNumber', itemIndex) as string;
				owner = `phoneNumber:${ownerPhoneNumber}`;
				break;
			}
			case 'twitter': {
				const ownerTwitterHandle = context.getNodeParameter('ownerTwitterHandle', itemIndex) as string;
				owner = `twitter:${ownerTwitterHandle}`;
				break;
			}
			case 'x': {
				const ownerXHandle = context.getNodeParameter('ownerXHandle', itemIndex) as string;
				owner = `x:${ownerXHandle}`;
				break;
			}
		}
	}

	const requestBody: WalletCreateRequest = {
		type: 'smart',
		chainType: chainType,
		config: {
			adminSigner: adminSigner,
		},
	};

	if (owner) {
		requestBody.owner = owner;
	}

	try {
		const response = await api.post('wallets', requestBody, API_VERSIONS.WALLETS);

		if(keyPair.address && keyPair.publicKey) {
			return {
				...response,
				derivedAddress: keyPair.address,
				derivedPublicKey: keyPair.publicKey,
			};
		}

		return response;
	} catch (error: any) {
		// Pass through the original Crossmint API error exactly as received
		throw new NodeApiError(context.getNode(), error);
	}
}
