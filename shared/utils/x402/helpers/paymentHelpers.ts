import { PaymentRequirements } from '../../../../shared/transport/types';
import type * as express from 'express';

export function getSupportedTokens(environment?: string): {
	kinds: Array<{
		scheme: string;
		network: string;
		tokens: Array<{ name: string; contractAddress: string; version: string; normalizedName?: string }>;
	}>;
} {
	const isProduction = environment === 'production';
	const network = isProduction ? 'solana-mainnet-beta' : 'solana-devnet';
	const mint = isProduction
		? 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
		: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

	return {
		kinds: [
			{
				scheme: '@faremeter/x-solana-settlement',
				network: network,
				tokens: [
					{
						name: 'USDC',
						contractAddress: mint,
						version: '1',
						normalizedName: 'usdc'
					},
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

	const expectedNetwork = supportedTokens.kinds[0]?.network;
	if (!expectedNetwork) {
		resp.writeHead(403);
		resp.end('Misconfiguration: No supported Solana networks found for the selected environment');
		return null;
	}

	for (const configuredToken of configured ?? []) {
		const [network, contractAddress] = (configuredToken.paymentToken || '').split(':');

		if (!network || !contractAddress) {
			resp.writeHead(403);
			resp.end('Misconfiguration: paymentToken must be in the form "network:contractAddress"');
			return null;
		}

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

		const supportedToken = kind.tokens.find((t) => t.normalizedName === contractAddress || t.contractAddress === contractAddress);
		if (supportedToken == null) throw new Error(`Supported token ${contractAddress} not found`);

		const paymentAmount = configuredToken.paymentAmount;
		if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
			throw new Error(`Invalid payment amount configured for network ${normalizedNetwork}`);
		}

		const paymentAmountInAtomicUnits = Math.round(paymentAmount * 1000000);

		requirements.push(
			new PaymentRequirements(
				kind.scheme,
				kind.network,
				String(paymentAmountInAtomicUnits),
				webhookUrl,
				resourceDescription,
				mimeType,
				{},
				configuredToken.payToAddress,
				60,
				supportedToken.contractAddress,
				{ tokenName: supportedToken.normalizedName ?? supportedToken.name },
			),
		);
	}

	return requirements;
}
