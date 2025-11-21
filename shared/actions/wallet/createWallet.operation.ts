import { IExecuteFunctions, NodeApiError, IDataObject, NodeOperationError } from 'n8n-workflow';
import { CrossmintApi } from '../../transport/CrossmintApi';
import { API_VERSIONS } from '../../utils/constants';
import { validateRequiredField } from '../../utils/validation';
import { deriveKeyPair, deriveEvmKeyPair } from '../../utils/blockchain';
import { WalletCreateRequest } from '../../transport/types';

export async function createWallet(
	context: IExecuteFunctions,
	api: CrossmintApi,
	itemIndex: number,
): Promise<IDataObject> {
	const chainType = context.getNodeParameter('chainType', itemIndex) as string;
	const ownerType = context.getNodeParameter('ownerType', itemIndex) as string;
	const externalSignerDetails = context.getNodeParameter('externalSignerDetails', itemIndex) as string;

	validateRequiredField(externalSignerDetails, 'External signer private key', context, itemIndex);

	const credentials = api.getCredentials();
	const environment = credentials.environment ?? 'staging';

	if (chainType !== 'solana' && chainType !== 'evm') {
		throw new NodeOperationError(context.getNode(), `Unsupported chain type: ${chainType}`, { itemIndex });
	}

	if (chainType === 'evm') {
		if (environment === 'production') {
			// EVM wallets on production run on Base
		} else if (environment === 'staging') {
			// EVM wallets on staging run on Base Sepolia
		} else {
			throw new NodeOperationError(context.getNode(), 'EVM wallets are only supported when the Crossmint credentials environment is set to production (Base) or staging (Base Sepolia)', {
				itemIndex,
			});
		}
	}

	const keyPair =
		chainType === 'evm'
			? deriveEvmKeyPair(externalSignerDetails, context, itemIndex)
			: deriveKeyPair(externalSignerDetails, context, itemIndex);

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
		chainType,
		config: {
			adminSigner: adminSigner,
		},
	};

	if (owner) {
		requestBody.owner = owner;
	}

	try {
		const response = await api.post('wallets', requestBody as unknown as IDataObject, API_VERSIONS.WALLETS);

		if(keyPair.address && keyPair.publicKey) {
			return {
				...(response as IDataObject),
				derivedAddress: keyPair.address,
				derivedPublicKey: keyPair.publicKey,
			};
		}

		return response;
	} catch (error: unknown) {
		// Pass through the original Crossmint API error exactly as received
		throw new NodeApiError(context.getNode(), error as object & { message?: string });
	}
}
