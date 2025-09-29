import { IExecuteFunctions, NodeApiError, IDataObject } from 'n8n-workflow';
import { CrossmintApi } from '../../transport/CrossmintApi';
import { API_VERSIONS } from '../../utils/constants';
import { validateAmount, validateRequiredField } from '../../utils/validation';
import { buildWalletLocator, buildRecipientLocator } from '../../utils/locators';
import { TransferTokenRequest, WalletLocatorData } from '../../transport/types';

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

	const requestBody: TransferTokenRequest = {
		recipient: recipient,
		amount: amount.toString().trim(),
	};

	const endpoint = `wallets/${encodeURIComponent(fromWalletLocator)}/tokens/${encodeURIComponent(tokenLocator)}/transfers`;

	let rawResponse;
	try {
		rawResponse = await api.post(endpoint, requestBody as unknown as IDataObject, API_VERSIONS.WALLETS);
	} catch (error: unknown) {
		// Pass through the original Crossmint API error exactly as received
		throw new NodeApiError(context.getNode(), error as object & { message?: string });
	}

	let chain;
	const responseParams = (rawResponse as IDataObject).params as { calls?: Array<{ chain?: string }> };
	if (responseParams && responseParams.calls && responseParams.calls[0]) {
		chain = responseParams.calls[0].chain;
	}

	const rawResponseData = rawResponse as IDataObject;
	const simplifiedOutput = {
		chainType: rawResponseData.chainType,
		walletType: rawResponseData.walletType,
		from: originWallet,
		to: recipientWallet,
		chain: chain,
		id: rawResponseData.id,
		status: rawResponseData.status,
		approvals: rawResponseData.approvals || {}
	};

	return {
		'simplified-output': simplifiedOutput,
		raw: rawResponse
	};
}