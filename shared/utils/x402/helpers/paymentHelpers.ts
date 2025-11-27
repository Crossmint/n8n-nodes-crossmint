import { PaymentRequirements } from '../../../../shared/transport/types';
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
					{
						name: 'USDC',
						contractAddress: environment === 'staging'
							? '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU' // Solana Devnet USDC
							: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // Solana Mainnet USDC
						version: '2',
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

	// Get the expected network from supported tokens (should match environment)
	const expectedNetwork = supportedTokens.kinds[0]?.network;
	if (!expectedNetwork) {
		resp.writeHead(403);
		resp.end('Misconfiguration: No supported payment networks found for the selected environment');
		return null;
	}

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

		// Convert payment amount (entered in standard token units) to atomic units (USDC has 6 decimals)
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
				{ version: supportedToken.version, name: supportedToken.name },
			),
		);
	}

	return requirements;
}