import { IExecuteFunctions, NodeOperationError, NodeApiError } from 'n8n-workflow';
import { CrossmintApi } from '../../transport/CrossmintApi';
import { API_VERSIONS, PAGINATION } from '../../utils/constants';
import { validatePrivateKey, validateRequiredField } from '../../utils/validation';
import { signMessage } from '../../utils/blockchain';
import { ApprovalRequest } from '../../transport/types';

async function getTransactionStatus(
	api: CrossmintApi,
	walletAddress: string,
	transactionId: string,
): Promise<any> {
	const endpoint = `wallets/${encodeURIComponent(walletAddress)}/transactions/${encodeURIComponent(transactionId)}`;
	return await api.get(endpoint, API_VERSIONS.WALLETS);
}

async function handleWaitForCompletion(
	api: CrossmintApi,
	walletAddress: string,
	transactionId: string,
	initialResponse: any,
	simplifiedOutput: any,
	context: IExecuteFunctions,
	itemIndex: number,
): Promise<any> {
	let currentStatus = initialResponse.status;
	let attempts = 0;
	let finalResponse = {
		'simplified-output': simplifiedOutput,
		raw: initialResponse
	};

	while (currentStatus === 'pending' && attempts < PAGINATION.MAX_ATTEMPTS) {
		await new Promise(resolve => setTimeout(resolve, PAGINATION.POLL_INTERVAL));
		attempts++;

		try {
			const statusResponse = await getTransactionStatus(api, walletAddress, transactionId);
			currentStatus = statusResponse.status;

			const updatedSimplifiedOutput = {
				...simplifiedOutput,
				status: currentStatus,
			};

			if (statusResponse.completedAt) {
				(updatedSimplifiedOutput as any).completedAt = statusResponse.completedAt;
			}
			if (statusResponse.error) {
				(updatedSimplifiedOutput as any).error = statusResponse.error;
			}

			finalResponse = {
				'simplified-output': updatedSimplifiedOutput,
				raw: statusResponse
			};

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
): Promise<any> {
	const chain = context.getNodeParameter('signSubmitChain', itemIndex) as string;
	const privateKey = context.getNodeParameter('signSubmitPrivateKey', itemIndex) as string;
	const transactionData = context.getNodeParameter('signSubmitTransactionData', itemIndex) as string;
	const walletAddress = context.getNodeParameter('signSubmitWalletAddress', itemIndex) as string;
	const transactionId = context.getNodeParameter('signSubmitTransactionId', itemIndex) as string;
	const signerAddress = context.getNodeParameter('signSubmitSignerAddress', itemIndex) as string;
	const waitForCompletion = context.getNodeParameter('waitForCompletion', itemIndex) as boolean;

	let signerChainType: string;
	if (chain.includes('solana')) {
		signerChainType = 'solana';
		validatePrivateKey(privateKey, signerChainType, context, itemIndex);
	} else {
		signerChainType = 'evm';
		validatePrivateKey(privateKey, signerChainType, context, itemIndex);
	}

	const signature = await signMessage(transactionData, privateKey, signerChainType, context, itemIndex);

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

	let rawResponse;
	try {
		rawResponse = await api.post(endpoint, requestBody, API_VERSIONS.WALLETS);
	} catch (error: any) {
		// Pass through the original Crossmint API error exactly as received
		throw new NodeApiError(context.getNode(), error);
	}

	const simplifiedOutput = {
		chainType: rawResponse.chainType,
		walletType: rawResponse.walletType,
		id: rawResponse.id,
		status: rawResponse.status,
		createdAt: rawResponse.createdAt,
		approvals: rawResponse.approvals || {},
		signingDetails: {
			signature: signature,
			signedTransaction: signature,
			chainType: signerChainType,
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
	};
}
