import { IExecuteFunctions } from 'n8n-workflow';
import { CrossmintApi } from '../../transport/CrossmintApi';
import { API_VERSIONS } from '../../utils/constants';
import { validateAmount, validateRequiredField } from '../../utils/validation';
import { buildWalletLocator, buildRecipientLocator } from '../../utils/locators';
import { TransferTokenRequest } from '../../transport/types';

export async function transferToken(
	context: IExecuteFunctions,
	api: CrossmintApi,
	itemIndex: number,
): Promise<any> {
	const amount = context.getNodeParameter('amount', itemIndex) as string;
	const tokenChain = context.getNodeParameter('tokenChain', itemIndex) as string;
	const tokenName = context.getNodeParameter('tokenName', itemIndex) as string;
	const blockchainType = context.getNodeParameter('blockchainType', itemIndex) as string;

	validateAmount(amount, context, itemIndex);
	validateRequiredField(tokenChain, 'Token chain', context, itemIndex);
	validateRequiredField(tokenName, 'Token name', context, itemIndex);

	const tokenLocator = `${tokenChain}:${tokenName}`;

	const originWallet = context.getNodeParameter('originWallet', itemIndex) as any;
	const fromWalletLocator = buildWalletLocator(originWallet, blockchainType, context, itemIndex);

	const recipientWallet = context.getNodeParameter('recipientWallet', itemIndex) as any;
	const recipient = buildRecipientLocator(recipientWallet, tokenChain, context, itemIndex);

	const requestBody: TransferTokenRequest = {
		recipient: recipient,
		amount: amount.toString().trim(),
	};

	const endpoint = `wallets/${encodeURIComponent(fromWalletLocator)}/tokens/${encodeURIComponent(tokenLocator)}/transfers`;
	const rawResponse = await api.post(endpoint, requestBody, API_VERSIONS.WALLETS);

	let chain;
	if (rawResponse.params && rawResponse.params.calls && rawResponse.params.calls[0]) {
		chain = rawResponse.params.calls[0].chain;
	}

	const simplifiedOutput = {
		chainType: rawResponse.chainType,
		walletType: rawResponse.walletType,
		from: originWallet,
		to: recipientWallet,
		chain: chain,
		id: rawResponse.id,
		status: rawResponse.status,
		approvals: rawResponse.approvals || {}
	};

	return {
		'simplified-output': simplifiedOutput,
		raw: rawResponse
	};
}
