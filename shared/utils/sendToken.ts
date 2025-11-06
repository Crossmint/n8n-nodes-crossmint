import { NodeOperationError, INode, IDataObject } from 'n8n-workflow';
import { CrossmintApi } from '../transport/CrossmintApi';
import { API_VERSIONS, PAGINATION } from './constants';
import { validatePrivateKey } from './validation';
import { signMessage } from './blockchain';
import { ApprovalRequest, ApiResponse, TransferTokenRequest } from '../transport/types';

// Code from transferToken.operation.ts - executeTokenTransfer function
interface TransferResult {
	raw: IDataObject;
	id: string;
	status: string;
	chainType?: string;
	walletType?: string;
	chain?: string;
	approvals?: IDataObject;
}

async function executeTokenTransfer(
	api: CrossmintApi,
	sourceWalletLocator: string,
	tokenLocator: string,
	recipientLocator: string,
	amount: string,
): Promise<TransferResult> {
	const endpoint = `wallets/${encodeURIComponent(sourceWalletLocator)}/tokens/${encodeURIComponent(tokenLocator)}/transfers`;
	const requestBody: TransferTokenRequest = {
		recipient: recipientLocator,
		amount: amount.toString().trim(),
	};
	
	const rawResponse = await api.post(endpoint, requestBody as unknown as IDataObject, API_VERSIONS.WALLETS) as IDataObject;
	
	// Extract chain from params if available
	let chain: string | undefined;
	const responseParams = rawResponse.params as { calls?: Array<{ chain?: string }> } | undefined;
	if (responseParams?.calls && responseParams.calls[0]) {
		chain = responseParams.calls[0].chain;
	}

	return {
		raw: rawResponse,
		id: rawResponse.id as string,
		status: rawResponse.status as string,
		chainType: rawResponse.chainType as string | undefined,
		walletType: rawResponse.walletType as string | undefined,
		chain: chain,
		approvals: rawResponse.approvals as IDataObject | undefined,
	};
}

// Code from signTransaction.operation.ts - getTransactionStatus function
async function getTransactionStatus(
	api: CrossmintApi,
	walletAddress: string,
	transactionId: string,
): Promise<unknown> {
	const endpoint = `wallets/${encodeURIComponent(walletAddress)}/transactions/${encodeURIComponent(transactionId)}`;
	return await api.get(endpoint, API_VERSIONS.WALLETS);
}

// Code from signTransaction.operation.ts - handleWaitForCompletion function
async function handleWaitForCompletion(
	api: CrossmintApi,
	walletAddress: string,
	transactionId: string,
	initialResponse: unknown,
	simplifiedOutput: Record<string, unknown>,
	context: { getNode: () => INode },
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

// Code from signTransaction.operation.ts - submitTransactionApproval function
async function submitTransactionApproval(
	api: CrossmintApi,
	walletAddress: string,
	transactionId: string,
	signerAddress: string,
	signature: string,
): Promise<ApiResponse> {
	const requestBody: ApprovalRequest = {
		approvals: [
			{
				signer: `external-wallet:${signerAddress}`,
				signature: signature,
			}
		]
	};

	const endpoint = `wallets/${encodeURIComponent(walletAddress)}/transactions/${encodeURIComponent(transactionId)}/approvals`;
	return await api.post(endpoint, requestBody as unknown as IDataObject, API_VERSIONS.WALLETS);
}

export interface SendOptions {
	api: CrossmintApi;
	sourceWalletLocator: string;
	tokenLocator: string;
	recipientLocator: string;
	amount: string;
	privateKey: string;
	signerAddress: string;
	chain: string;
	waitForCompletion?: boolean;
	context: { getNode: () => INode };
	itemIndex: number;
}

export interface SendResult {
	'simplified-output': {
		chainType?: string;
		walletType?: string;
		from: string;
		to: string;
		chain?: string;
		id: string;
		status: string;
		createdAt?: string;
		approvals?: IDataObject;
		signingDetails: {
			signature: string;
			signedTransaction: string;
			chainType: string;
			chain: string;
			transactionData: string;
		};
		submittedApproval: {
			walletAddress: string;
			transactionId: string;
			signerAddress: string;
			signature: string;
		};
		completedAt?: string;
		error?: unknown;
	};
	raw: IDataObject;
}

/**
 * Creates a token transfer and signs it in one operation
 * Uses the same code as transferToken.operation.ts and signTransaction.operation.ts
 */
export async function sendToken(
	options: SendOptions,
): Promise<SendResult> {
	const {
		api,
		sourceWalletLocator,
		tokenLocator,
		recipientLocator,
		amount,
		privateKey,
		signerAddress,
		chain,
		waitForCompletion = false,
		context,
		itemIndex,
	} = options;

	// Validate private key (using code from signTransaction.operation.ts)
	validatePrivateKey(privateKey, context, itemIndex);

	// Step 1: Create the transfer (using code from transferToken.operation.ts)
	let transferResult: TransferResult;
	try {
		transferResult = await executeTokenTransfer(
			api,
			sourceWalletLocator,
			tokenLocator,
			recipientLocator,
			amount,
		);
	} catch (error: unknown) {
		throw new NodeOperationError(
			context.getNode(),
			`Failed to create transfer: ${(error as Error).message}`,
			{ itemIndex }
		);
	}

	// Extract transaction data from the transfer response (from approvals.pending[0].message)
	const transferResponseData = transferResult.raw as IDataObject;
	const approvals = transferResponseData.approvals as IDataObject | undefined;
	const pendingApprovals = approvals?.pending as Array<{ message?: string; signer?: string }> | undefined;
	
	if (!pendingApprovals || pendingApprovals.length === 0) {
		throw new NodeOperationError(
			context.getNode(),
			'No pending approvals found in transfer response',
			{ itemIndex }
		);
	}

	const transactionData = pendingApprovals[0].message;
	if (!transactionData) {
		throw new NodeOperationError(
			context.getNode(),
			'Transaction message not found in pending approvals',
			{ itemIndex }
		);
	}

	const walletAddress = sourceWalletLocator;
	const transactionId = transferResult.id;

	// Step 2: Sign the transaction (using code from signTransaction.operation.ts)
	const signature = await signMessage(transactionData as string, privateKey, context, itemIndex);

	if (!signature) {
		throw new NodeOperationError(context.getNode(), 'Failed to generate signature', {
			itemIndex,
		});
	}

	// Step 3: Submit the approval (using code from signTransaction.operation.ts)
	let rawResponse: ApiResponse;
	try {
		rawResponse = await submitTransactionApproval(
			api,
			walletAddress,
			transactionId,
			signerAddress,
			signature,
		);
	} catch (error: unknown) {
		throw new NodeOperationError(
			context.getNode(),
			`Failed to submit approval: ${(error as Error).message}`,
			{ itemIndex }
		);
	}

	const rawResponseData = rawResponse as IDataObject;
	const simplifiedOutput = {
		chainType: rawResponseData.chainType,
		walletType: rawResponseData.walletType,
		from: sourceWalletLocator,
		to: recipientLocator,
		chain: chain,
		id: rawResponseData.id,
		status: rawResponseData.status,
		createdAt: rawResponseData.createdAt,
		approvals: rawResponseData.approvals || {},
		signingDetails: {
			signature: signature,
			signedTransaction: signature,
			chainType: 'solana',
			chain: chain,
			transactionData: transactionData as string,
		},
		submittedApproval: {
			walletAddress,
			transactionId,
			signerAddress,
			signature,
		},
	};

	// Step 4: Optionally wait for completion (using code from signTransaction.operation.ts)
	if (waitForCompletion) {
		const result = await handleWaitForCompletion(
			api,
			walletAddress,
			transactionId,
			rawResponse,
			simplifiedOutput,
			context,
			itemIndex,
		);
		return result as unknown as SendResult;
	}

	return {
		'simplified-output': simplifiedOutput,
		raw: rawResponse
	} as SendResult;
}
