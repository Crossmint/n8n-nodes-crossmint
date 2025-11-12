import { IExecuteFunctions, IDataObject, NodeOperationError } from 'n8n-workflow';
import { CrossmintApi } from '../../transport/CrossmintApi';
import { API_VERSIONS } from '../../utils/constants';
import { getSupportedTokens } from '../../utils/x402/helpers/paymentHelpers';
import type { CrossmintCredentials, IPaymentRequirements } from '../../transport/types';

interface PayRule {
	paymentToken: string;
	payToAddress: string;
}

interface NormalizedRequirement {
	network: string;
	asset: string;
	requiredAmount: bigint;
	requirement: IPaymentRequirements;
}

interface ResolvedRuleToken {
	network: string;
	contractAddress: string;
}

type SelectedRule = PayRule & {
	requirement: IPaymentRequirements;
	available: bigint;
	required: bigint;
};

export async function paywallRequest(
	context: IExecuteFunctions,
	itemIndex: number,
): Promise<IDataObject> {
	const credentials = await context.getCredentials<CrossmintCredentials>('crossmintApi');
	const api = new CrossmintApi(context, credentials);
	const environment = credentials.environment ?? 'staging';
	const resourceUrl = context.getNodeParameter('resourceUrl', itemIndex) as string;
	const configuredRules = getConfiguredRules(context, itemIndex);

	const supportedTokens = getSupportedTokens(environment);
	const expectedNetwork = supportedTokens.kinds[0]?.network;
	if (!expectedNetwork) {
		throw new NodeOperationError(context.getNode(), 'No supported payment networks available for the selected environment', { itemIndex });
	}

	const paywallBody = await fetchPaywallRequirements(context, resourceUrl, itemIndex);
	const normalizedRequirements = normalizeRequirements(paywallBody.accepts, itemIndex, context);

	const selectedRule = await selectRule({
		api,
		rules: configuredRules,
		requirements: normalizedRequirements,
		supportedTokens,
		expectedNetwork,
	});

	if (!selectedRule) {
		throw new NodeOperationError(context.getNode(), 'No payment rule matched the paywall requirements with sufficient balance', {
			itemIndex,
		});
	}

	return {
		x402Version: paywallBody.x402Version ?? 1,
		accepts: normalizedRequirements.map((r) => r.requirement),
		selectedRule: {
			paymentToken: selectedRule.paymentToken,
			payToAddress: selectedRule.payToAddress,
			requiredAmount: selectedRule.required.toString(),
			availableAmount: selectedRule.available.toString(),
		},
		requirement: selectedRule.requirement,
	};
}

function getConfiguredRules(context: IExecuteFunctions, itemIndex: number): PayRule[] {
	const payRulesParam = context.getNodeParameter('payRules', itemIndex, {
		rule: [],
	}) as { rule: PayRule[] };

	const configuredRules = payRulesParam.rule ?? [];
	if (configuredRules.length === 0) {
		throw new NodeOperationError(context.getNode(), 'At least one payment rule is required', { itemIndex });
	}

	return configuredRules;
}

async function fetchPaywallRequirements(
	context: IExecuteFunctions,
	resourceUrl: string,
	itemIndex: number,
): Promise<IDataObject> {
	try {
		return (await context.helpers.httpRequest({
			method: 'GET',
			url: resourceUrl,
			headers: { Accept: 'application/json' },
			json: true,
			ignoreHttpStatusErrors: true,
		})) as IDataObject;
	} catch (error) {
		throw new NodeOperationError(context.getNode(), 'Failed to retrieve payment requirements from the paywall resource', {
			itemIndex,
		});
	}
}

function normalizeRequirements(
	accepts: unknown,
	itemIndex: number,
	context: IExecuteFunctions,
): NormalizedRequirement[] {
	if (!Array.isArray(accepts) || accepts.length === 0) {
		throw new NodeOperationError(context.getNode(), 'The paywall resource did not return any payment requirements (accepts array)', {
			itemIndex,
		});
	}

	return (accepts as IPaymentRequirements[]).map((requirement) => ({
		network: requirement.network?.toLowerCase(),
		asset: requirement.asset?.toLowerCase(),
		requiredAmount: requirement.maxAmountRequired ? BigInt(requirement.maxAmountRequired) : BigInt(0),
		requirement,
	}));
}

async function selectRule(params: {
	api: CrossmintApi;
	rules: PayRule[];
	requirements: NormalizedRequirement[];
	supportedTokens: ReturnType<typeof getSupportedTokens>;
	expectedNetwork: string;
}): Promise<SelectedRule | null> {
	const { api, rules, requirements, supportedTokens, expectedNetwork } = params;

	for (const rule of rules) {
		const resolvedToken = resolveRuleToken(rule, supportedTokens, expectedNetwork);
		if (!resolvedToken) continue;

		const requirement = findMatchingRequirement(resolvedToken, requirements);
		if (!requirement) continue;

		const available = await fetchAvailableBalance(api, rule.payToAddress, resolvedToken);
		if (available != null && available >= requirement.requiredAmount) {
			return {
				...rule,
				requirement: requirement.requirement,
				available,
				required: requirement.requiredAmount,
			};
		}
	}

	return null;
}

function resolveRuleToken(
	rule: PayRule,
	supportedTokens: ReturnType<typeof getSupportedTokens>,
	expectedNetwork: string,
): ResolvedRuleToken | null {
	const [networkPart, tokenPart] = rule.paymentToken.split(':');
	const normalizedNetwork = (networkPart || '').toLowerCase() === 'base'
		? expectedNetwork.toLowerCase()
		: (networkPart || '').toLowerCase();

	const kind = supportedTokens.kinds.find((k) => k.network.toLowerCase() === normalizedNetwork);
	if (!kind) return null;

	const token = kind.tokens.find((t) => {
		const normalizedName = t.normalizedName?.toLowerCase();
		return (
			normalizedName === (tokenPart || '').toLowerCase() ||
			t.contractAddress.toLowerCase() === (tokenPart || '').toLowerCase()
		);
	});

	if (!token) return null;

	return {
		network: kind.network.toLowerCase(),
		contractAddress: token.contractAddress.toLowerCase(),
	};
}

function findMatchingRequirement(
	resolvedToken: ResolvedRuleToken,
	requirements: NormalizedRequirement[],
): NormalizedRequirement | undefined {
	return requirements.find(
		(requirement) =>
			requirement.network === resolvedToken.network &&
			requirement.asset === resolvedToken.contractAddress &&
			requirement.requiredAmount > BigInt(0),
	);
}

async function fetchAvailableBalance(
	api: CrossmintApi,
	walletAddress: string,
	token: ResolvedRuleToken,
): Promise<bigint | null> {
	try {
		const endpoint = `wallets/${encodeURIComponent(walletAddress)}/balances?chains=${encodeURIComponent(token.network)}&tokens=${encodeURIComponent(token.contractAddress)}`;
		const response = (await api.get(endpoint, API_VERSIONS.WALLETS)) as IDataObject;
		return extractAvailableBalance(response);
	} catch {
		return null;
	}
}

function extractAvailableBalance(balanceResponse: IDataObject): bigint | null {
	const candidates: Array<string | number | undefined> = [];
	const balances = balanceResponse.balances;

	if (Array.isArray(balances)) {
		for (const entry of balances) {
			if (entry && typeof entry === 'object') {
				const entryObject = entry as IDataObject;
				candidates.push(
					(entryObject.available as string | number | undefined) ??
					(entryObject.balance as string | number | undefined) ??
					(entryObject.amount as string | number | undefined) ??
					(entryObject.quantity as string | number | undefined),
				);
			}
		}
	}

	candidates.push(
		balanceResponse.available as string | number | undefined,
		balanceResponse.balance as string | number | undefined,
		balanceResponse.amount as string | number | undefined,
		balanceResponse.quantity as string | number | undefined,
	);

	for (const candidate of candidates) {
		if (candidate == null) continue;

		try {
			const value = typeof candidate === 'number' ? BigInt(Math.trunc(candidate)) : BigInt(candidate);
			if (value >= BigInt(0)) {
				return value;
			}
		} catch {
			continue;
		}
	}

	return null;
}
