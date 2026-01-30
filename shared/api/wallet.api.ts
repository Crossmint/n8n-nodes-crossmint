import { CrossmintApi } from '../transport/CrossmintApi';
import { API_VERSIONS } from '../utils/constants';
import { ApiResponse } from '../transport/types';

export class WalletApi {
	constructor(private api: CrossmintApi) {}

	async getBalance(
		walletLocator: string,
		chains: string,
		tkn: string,
	): Promise<ApiResponse> {
		const endpoint = `wallets/${walletLocator}/balances?chains=${encodeURIComponent(chains)}&tokens=${encodeURIComponent(tkn)}`;
		return await this.api.get(endpoint, API_VERSIONS.WALLETS);
	}
}
