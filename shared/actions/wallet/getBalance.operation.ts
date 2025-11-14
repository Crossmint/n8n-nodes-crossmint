import { IExecuteFunctions, NodeApiError, NodeOperationError } from 'n8n-workflow';
import { CrossmintApi } from '../../transport/CrossmintApi';
import { API_VERSIONS } from '../../utils/constants';
import { buildWalletLocator } from '../../utils/locators';
import { WalletLocatorData, ApiResponse } from '../../transport/types';

export async function getBalanceByLocator(
	api: CrossmintApi,
	walletLocator: string,
	chains: string,
	tkn: string,
): Promise<ApiResponse> {
	const endpoint = `wallets/${walletLocator}/balances?chains=${encodeURIComponent(chains)}&tokens=${encodeURIComponent(tkn)}`;
	return await api.get(endpoint, API_VERSIONS.WALLETS);
}

export async function getBalance(
	context: IExecuteFunctions,
	api: CrossmintApi,
	itemIndex: number,
): Promise<ApiResponse> {
	const walletResource = context.getNodeParameter('walletLocator', itemIndex) as WalletLocatorData;
	const chains = context.getNodeParameter('chains', itemIndex) as string;
	const tkn = context.getNodeParameter('tkn', itemIndex) as string;
	const chainType = context.getNodeParameter('balanceWalletChainType', itemIndex) as string;

	if (!['solana', 'evm'].includes(chainType)) {
		throw new NodeOperationError(
			context.getNode(),
			`Unsupported chain type: ${chainType}`,
			{ itemIndex },
		);
	}

	const credentials = api.getCredentials();
	const environment = credentials.environment ?? 'staging';

	if (chainType === 'solana') {
		if (chains !== 'solana') {
			throw new NodeOperationError(
				context.getNode(),
				`Chains must be set to 'solana' when Chain Type is Solana`,
				{ itemIndex },
			);
		}
	} else {
		const expectedChain = environment === 'production' ? 'base' : 'base-sepolia';
		if (chains !== expectedChain) {
			throw new NodeOperationError(
				context.getNode(),
				`Chains must be set to '${expectedChain}' when Chain Type is EVM and credentials environment is ${environment}`,
				{ itemIndex },
			);
		}
	}

	const walletLocator = buildWalletLocator(walletResource, chainType, context, itemIndex);

	try {
		return await getBalanceByLocator(api, walletLocator, chains, tkn);
	} catch (error: unknown) {
		// Pass through the original Crossmint API error exactly as received
		throw new NodeApiError(context.getNode(), error as object & { message?: string });
	}
}
