import { IExecuteFunctions, NodeApiError, IDataObject } from 'n8n-workflow';
import { CrossmintApi } from '../../transport/CrossmintApi';
import { API_VERSIONS } from '../../utils/constants';
import { validateAmount, validateRequiredField } from '../../utils/validation';
import { buildWalletLocator, buildRecipientLocator } from '../../utils/locators';
import { TransferTokenRequest, WalletLocatorData } from '../../transport/types';

export interface TransferResult {
	raw: IDataObject;
	id: string;
	status: string;
	chainType?: string;
	walletType?: string;
	chain?: string;
	approvals?: IDataObject;
}

/**
 * Reusable function to execute a token transfer
 * @param api - CrossmintApi instance
 * @param sourceWalletLocator - Source wallet locator string
 * @param tokenLocator - Token locator string (e.g., "solana:sol")
 * @param recipientLocator - Recipient wallet locator string
 * @param amount - Amount to transfer (as string)
 * @returns Structured transfer result with parsed response data
 */
export async function executeTokenTransfer(
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

export async function transferToken(
	context: IExecuteFunctions,
	api: CrossmintApi,
	itemIndex: number,
): Promise<IDataObject> {
	const amount = context.getNodeParameter('amount', itemIndex) as string;
	const tknChain = context.getNodeParameter('tknChain', itemIndex) as string;
	const tknName = context.getNodeParameter('tknName', itemIndex) as string;
	const blockchainType = context.getNodeParameter('blockchainType', itemIndex) as string;

	validateAmount(amount, context, itemIndex);
	validateRequiredField(tknChain, 'Token chain', context, itemIndex);
	validateRequiredField(tknName, 'Token name', context, itemIndex);

	const tokenLocator = `${tknChain}:${tknName}`;

	const originWallet = context.getNodeParameter('originWallet', itemIndex) as WalletLocatorData;
	const fromWalletLocator = buildWalletLocator(originWallet, blockchainType, context, itemIndex);

	const recipientWallet = context.getNodeParameter('recipientWallet', itemIndex) as WalletLocatorData;
	const recipient = buildRecipientLocator(recipientWallet, tknChain, context, itemIndex);

	let transferResult: TransferResult;
	try {
		transferResult = await executeTokenTransfer(api, fromWalletLocator, tokenLocator, recipient, amount);
	} catch (error: unknown) {
		// Pass through the original Crossmint API error exactly as received
		throw new NodeApiError(context.getNode(), error as object & { message?: string });
	}

	const simplifiedOutput = {
		chainType: transferResult.chainType,
		walletType: transferResult.walletType,
		from: originWallet,
		to: recipientWallet,
		chain: transferResult.chain,
		id: transferResult.id,
		status: transferResult.status,
		approvals: transferResult.approvals || {}
	};

	return {
		'simplified-output': simplifiedOutput,
		raw: transferResult.raw
	};
}