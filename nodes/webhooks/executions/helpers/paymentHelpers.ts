import { PaymentRequirements } from '../types/x402Types';
import type * as express from 'express';

export function getSupportedTokens(environment?: string): {
	kinds: Array<{
		scheme: string;
		network: string;
		tokens: Array<{ name: string; contractAddress: string; version: string; normalizedName?: string }>;
	}>;
} {
	// Use solana-devnet for staging, solana for production
	const network = environment === 'staging' ? 'solana-devnet' : 'solana';
	
	return {
		kinds: [
			{
				scheme: 'exact',
				network: network,
				tokens: [
					{ name: 'USDC', contractAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', version: '1', normalizedName: 'usdc' },
					{ name: 'SOL', contractAddress: 'So11111111111111111111111111111111111111112', version: '1', normalizedName: 'sol' },
				],
			},
		],
	};
}

export function buildPaymentRequirements(
	configured:
		| { paymentToken: string; payToAddress: string; paymentAmount: number }[]
		| undefined,
	supportedTokens: ReturnType<typeof getSupportedTokens>,
	webhookUrl: string,
	resourceDescription: string,
	mimeType: string,
	resp: express.Response,
): PaymentRequirements[] | null {
	const requirements: PaymentRequirements[] = [];
	const configuredNetworks: string[] = [];

	// Get the expected network from supported tokens (should match environment)
	const expectedNetwork = supportedTokens.kinds[0]?.network;

	for (const configuredToken of configured ?? []) {
		const [network, contractAddress] = (configuredToken.paymentToken || '').split(':');

		if (!network || !contractAddress) {
			resp.writeHead(403);
			resp.end('Misconfiguration: paymentToken must be in the form "network:contractAddress"');
			return null;
		}

		// Map 'solana' to the expected network (solana or solana-devnet based on environment)
		const normalizedNetwork = network === 'solana' ? expectedNetwork : network;

		if (configuredNetworks.includes(normalizedNetwork)) {
			resp.writeHead(403);
			resp.end(
				`Misconfiguration: Network ${normalizedNetwork} has multiple configured tokens. You may only have one payment token per network.`,
			);
			return null;
		}
		configuredNetworks.push(normalizedNetwork);

		const kind = supportedTokens.kinds.find((k) => k.network === expectedNetwork);
		if (kind == null) throw new Error(`Supported network ${expectedNetwork} not found`);

		// Match by normalizedName (usdc/sol) or by contractAddress (full address)
		const supportedToken = kind.tokens.find((t) => t.normalizedName === contractAddress || t.contractAddress === contractAddress);
		if (supportedToken == null) throw new Error(`Supported token ${contractAddress} not found`);

		requirements.push(
			new PaymentRequirements(
				kind.scheme,
				kind.network,
				String(configuredToken.paymentAmount),
				webhookUrl,
				resourceDescription,
				mimeType,
				{},
				configuredToken.payToAddress,
				60,
				supportedToken.contractAddress,
				{ name: supportedToken.name, version: supportedToken.version },
			),
		);
	}

	return requirements;
}

/**
 * Recursively sorts object keys alphabetically
 * @param obj - The object to sort
 * @returns A new object with sorted keys
 */
export function sortObjectKeys(obj: Record<string, any>): Record<string, any> {
	if (obj === null || typeof obj !== 'object') {
		return obj;
	}

	if (Array.isArray(obj)) {
		return obj.map(sortObjectKeys);
	}

	return Object.keys(obj)
		.sort()
		.reduce((result: Record<string, any>, key: string) => {
			result[key] = sortObjectKeys(obj[key]);
			return result;
		}, {});
}

