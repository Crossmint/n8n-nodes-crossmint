import { PaymentRequirements } from '../../../../shared/transport/types';
import type * as express from 'express';

export function getSupportedTokens(environment?: string): {
	kinds: Array<{
		scheme: string;
		network: string;
		tokens: Array<{ name: string; contractAddress: string; version: string; normalizedName?: string }>;
	}>;
} {
	// Use base-sepolia for staging, base for production
	const network = environment === 'staging' ? 'base-sepolia' : 'base';

	return {
		kinds: [
			{
				scheme: 'exact',
				network: network,
				tokens: [
					{
						name: 'USDC',
						contractAddress: environment === 'staging'
							? '0x036CbD53842c5426634e7929541eC2318f3dCF7e' // Base Sepolia USDC
							: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Base Mainnet USDC
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

		// Map 'base' to the expected network (base or base-sepolia based on environment)
		const normalizedNetwork = network === 'base' ? expectedNetwork : network;

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

		// Convert payment amount to atomic units (USDC has 6 decimals)
		// If paymentAmount is already in atomic units (integer >= 1000000), use it as-is
		// Otherwise, assume it's in dollars and multiply by 10^6
		const paymentAmountInAtomicUnits = configuredToken.paymentAmount < 1000000
			? Math.floor(configuredToken.paymentAmount * 1000000)
			: configuredToken.paymentAmount;

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