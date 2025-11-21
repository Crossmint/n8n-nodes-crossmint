import { IExecuteFunctions, NodeApiError, IDataObject } from 'n8n-workflow';
import { CrossmintApi } from '../../transport/CrossmintApi';
import { API_VERSIONS } from '../../utils/constants';
import { validateRequiredField } from '../../utils/validation';
import { deriveKeyPair } from '../../utils/blockchain';
import { CHAIN_FAMILIES } from '../../types/chains';

export async function createWallet(
	context: IExecuteFunctions,
	api: CrossmintApi,
	itemIndex: number,
): Promise<IDataObject> {
	const chainType = context.getNodeParameter('chainType', itemIndex) as string;
	const ownerType = context.getNodeParameter('ownerType', itemIndex) as string;
	const externalSignerDetails = context.getNodeParameter('externalSignerDetails', itemIndex) as string;

	// Private key is required for both Solana and EVM
	validateRequiredField(externalSignerDetails, 'Admin signer private key', context, itemIndex);

	let adminSigner: { type: string; address?: string; publicKey?: string };
	let derivedPublicKey: string | undefined;
	let derivedAddress: string | undefined;

	if (chainType === CHAIN_FAMILIES.EVM) {
		// EVM: Use P-256 keypair, send public key to API
		const keyPair = await deriveKeyPair(externalSignerDetails, context, itemIndex);
		
		adminSigner = {
			type: 'evm-p256-keypair',
			publicKey: keyPair.publicKey, // Base64 raw 65-byte public key
		};
		
		derivedPublicKey = keyPair.publicKey;
	} else {
		// Solana: Use Ed25519, send address to API
		const keyPair = await deriveKeyPair(externalSignerDetails, context, itemIndex);
		
		adminSigner = {
			type: 'external-wallet',
			address: keyPair.address,
		};
		
		derivedAddress = keyPair.address;
		derivedPublicKey = keyPair.publicKey;
	}

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

	const requestBody: any = {
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
		const response = await api.post('wallets', requestBody as unknown as IDataObject, API_VERSIONS.WALLETS);

		const result: IDataObject = {
			...(response as IDataObject),
		};

		// Add derived keys to response for user reference
		if (derivedAddress) {
			result.derivedAddress = derivedAddress;
		}
		if (derivedPublicKey) {
			result.derivedPublicKey = derivedPublicKey;
		}

		return result;
	} catch (error: unknown) {
		// Pass through the original Crossmint API error exactly as received
		throw new NodeApiError(context.getNode(), error as object & { message?: string });
	}
}
