import { ILoadOptionsFunctions, INodePropertyOptions } from 'n8n-workflow';

export async function getProductOptions(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	return [
		{
			name: 'Amazon Product',
			value: 'amazon',
		},
		{
			name: 'Shopify Product',
			value: 'shopify',
		},
	];
}

export async function getChainOptions(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	return [
		{
			name: 'Ethereum Sepolia',
			value: 'ethereum-sepolia',
		},
		{
			name: 'Polygon Amoy',
			value: 'polygon-amoy',
		},
		{
			name: 'Solana Devnet',
			value: 'solana-devnet',
		},
	];
}

export async function getTokenOptions(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	return [
		{
			name: 'Native Token',
			value: 'native',
		},
		{
			name: 'USDC',
			value: 'usdc',
		},
		{
			name: 'USDT',
			value: 'usdt',
		},
	];
}
