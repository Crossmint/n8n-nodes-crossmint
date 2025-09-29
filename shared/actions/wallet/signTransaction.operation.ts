import { IExecuteFunctions, NodeOperationError, NodeApiError, IDataObject } from 'n8n-workflow';
import { CrossmintApi } from '../../transport/CrossmintApi';
import { API_VERSIONS, PAGINATION } from '../../utils/constants';
import { validatePrivateKey, validateRequiredField } from '../../utils/validation';
import { signMessage } from '../../utils/blockchain';
import { ApprovalRequest, ApiResponse } from '../../transport/types';

async function getTransactionStatus(
	api: CrossmintApi,
	walletAddress: string,
	transactionId: string,
): Promise<unknown> {
	const endpoint = `wallets/${encodeURIComponent(walletAddress)}/transactions/${encodeURIComponent(transactionId)}`;
	return await api.get(endpoint, API_VERSIONS.WALLETS);
}

async function handleWaitForCompletion(
	api: CrossmintApi,
	walletAddress: string,
	transactionId: string,
	initialResponse: unknown,
	simplifiedOutput: Record<string, unknown>,
	context: IExecuteFunctions,
	itemIndex: number,
): Promise<IDataObject> {
	let currentStatus = (initialResponse as Record<string, unknown>).status;
	let attempts = 0;
	let finalResponse: IDataObject = {
		'simplified-output': simplifiedOutput,
		raw: initialResponse
	} as IDataObject;

	while (currentStatus === 'pending' && attempts < PAGINATION.MAX_ATTEMPTS) {
		attempts++;

		try {
			const statusResponse = await getTransactionStatus(api, walletAddress, transactionId) as IDataObject;
			currentStatus = (statusResponse as Record<string, unknown>).status;

			const updatedSimplifiedOutput = {
				...simplifiedOutput,
				status: currentStatus,
			};

			if (statusResponse.completedAt) {
				(updatedSimplifiedOutput as Record<string, unknown>).completedAt = statusResponse.completedAt;
			}
			if (statusResponse.error) {
				(updatedSimplifiedOutput as Record<string, unknown>).error = statusResponse.error;
			}

			finalResponse = {
				'simplified-output': updatedSimplifiedOutput,
				raw: statusResponse
			} as IDataObject;

		} catch (error) {
			// Log the error using n8n's proper error handling
			throw new NodeOperationError(context.getNode(), `Failed to get transaction status during polling: ${error}`, {
				itemIndex,
				description: 'Transaction status polling failed. This may be due to temporary API issues.',
			});
		}

		if (currentStatus === 'success' || currentStatus === 'failed') {
			break;
		}
	}

	return finalResponse;
}

export async function signTransaction(
	context: IExecuteFunctions,
	api: CrossmintApi,
	itemIndex: number,
): Promise<IDataObject> {
	const chain = context.getNodeParameter('signSubmitChain', itemIndex) as string;
	const privateKey = context.getNodeParameter('signSubmitPrivateKey', itemIndex) as string;
	const transactionData = context.getNodeParameter('signSubmitTransactionData', itemIndex) as string;
	const walletAddress = context.getNodeParameter('signSubmitWalletAddress', itemIndex) as string;
	const transactionId = context.getNodeParameter('signSubmitTransactionId', itemIndex) as string;
	const signerAddress = context.getNodeParameter('signSubmitSignerAddress', itemIndex) as string;
	const waitForCompletion = context.getNodeParameter('waitForCompletion', itemIndex) as boolean;

	validatePrivateKey(privateKey, context, itemIndex);

	const signature = await signMessage(transactionData, privateKey, context, itemIndex);

	if (!signature) {
		throw new NodeOperationError(context.getNode(), 'Failed to generate signature', {
			itemIndex,
		});
	}

	validateRequiredField(walletAddress, 'Wallet Address', context, itemIndex);
	validateRequiredField(transactionId, 'Transaction ID', context, itemIndex);
	validateRequiredField(signerAddress, 'Signer Address', context, itemIndex);

	const requestBody: ApprovalRequest = {
		approvals: [
			{
				signer: `external-wallet:${signerAddress}`,
				signature: signature,
			}
		]
	};

	const endpoint = `wallets/${encodeURIComponent(walletAddress)}/transactions/${encodeURIComponent(transactionId)}/approvals`;

	let rawResponse: ApiResponse;
	try {
		rawResponse = await api.post(endpoint, requestBody as unknown as IDataObject, API_VERSIONS.WALLETS);
	} catch (error: unknown) {
		// Pass through the original Crossmint API error exactly as received
		throw new NodeApiError(context.getNode(), error as object & { message?: string });
	}

	const rawResponseData = rawResponse as IDataObject;
	const simplifiedOutput = {
		chainType: rawResponseData.chainType,
		walletType: rawResponseData.walletType,
		id: rawResponseData.id,
		status: rawResponseData.status,
		createdAt: rawResponseData.createdAt,
		approvals: rawResponseData.approvals || {},
		signingDetails: {
			signature: signature,
			signedTransaction: signature,
			chainType: 'solana',
			chain: chain,
			transactionData: transactionData,
		},
		submittedApproval: {
			walletAddress,
			transactionId,
			signerAddress,
			signature,
		},
	};

	if (waitForCompletion) {
		return await handleWaitForCompletion(api, walletAddress, transactionId, rawResponse, simplifiedOutput, context, itemIndex);
	}

	return {
		'simplified-output': simplifiedOutput,
		raw: rawResponse
	} as IDataObject;
}
