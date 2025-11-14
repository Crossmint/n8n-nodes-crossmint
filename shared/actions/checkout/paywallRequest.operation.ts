import { IExecuteFunctions, IDataObject, NodeOperationError, NodeApiError } from 'n8n-workflow';
import { CrossmintApi } from '../../transport/CrossmintApi';
import { getSupportedTokens } from '../../utils/x402/helpers/paymentHelpers';
import type { CrossmintCredentials, IPaymentRequirements, IPaymentPayload } from '../../transport/types';
import { getBalanceByLocator } from '../wallet/getBalance.operation';
import { PaymentRequirements as PaymentRequirementsClass } from '../../transport/types';

interface PayRule {
	paymentToken: string;
	fromWallet: string;
	privateKey: string;
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
	tokenName: string;
}

type SelectedRule = PayRule & {
	requirement: IPaymentRequirements;
	available: bigint;
	required: bigint;
	walletAddress: string;
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
		context,
	});

	if (!selectedRule) {
		throw new NodeOperationError(context.getNode(), 'No payment rule matched the paywall requirements with sufficient balance', {
			itemIndex,
		});
	}

	// Sign and pay the selected rule using the rule's private key and wallet address
	const paymentPayload = await signPayment(
		selectedRule.walletAddress,
		selectedRule.privateKey,
		selectedRule.requirement,
		selectedRule.required,
		context,
		itemIndex,
	);

	const settlementResult = await settlePayment(
		paymentPayload,
		selectedRule.requirement,
		context,
		itemIndex,
	);

	return {
		x402Version: paywallBody.x402Version ?? 1,
		accepts: normalizedRequirements.map((r) => r.requirement),
		selectedRule: {
			paymentToken: selectedRule.paymentToken,
			walletAddress: selectedRule.walletAddress,
			payTo: selectedRule.requirement.payTo,
			requiredAmount: selectedRule.required.toString(),
			availableAmount: selectedRule.available.toString(),
		},
		requirement: selectedRule.requirement,
		payment: paymentPayload,
		settlement: settlementResult,
	};
}

function getConfiguredRules(context: IExecuteFunctions, itemIndex: number): PayRule[] {
	const payRulesParam = context.getNodeParameter('payRules', itemIndex, {
		rule: [],
	}) as { rule: Array<PayRule & { privateKey?: string }> };

	const configuredRules = payRulesParam.rule ?? [];
	if (configuredRules.length === 0) {
		throw new NodeOperationError(context.getNode(), 'At least one payment rule is required', { itemIndex });
	}

	// Validate that each rule has required fields
	for (const rule of configuredRules) {
		if (!rule.fromWallet || rule.fromWallet.trim() === '') {
			throw new NodeOperationError(context.getNode(), 'Each payment rule must have a from wallet address', { itemIndex });
		}
		if (!rule.privateKey || rule.privateKey.trim() === '') {
			throw new NodeOperationError(context.getNode(), 'Each payment rule must have a private key', { itemIndex });
		}
	}

	return configuredRules as PayRule[];
}

async function fetchPaywallRequirements(
	context: IExecuteFunctions,
	resourceUrl: string,
	itemIndex: number,
): Promise<IDataObject> {
	try {
		return (await context.helpers.httpRequest({
			method: 'POST',
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
	context?: IExecuteFunctions;
}): Promise<SelectedRule | null> {
	const { api, rules, requirements, supportedTokens, expectedNetwork, context } = params;

	for (const rule of rules) {
		const resolvedToken = resolveRuleToken(rule, supportedTokens, expectedNetwork);
		if (!resolvedToken) continue;

		const requirement = findMatchingRequirement(resolvedToken, requirements);
		if (!requirement) continue;

		// Use the wallet address from the rule (this is the "from" wallet)
		const walletAddress = rule.fromWallet.trim().toLowerCase();

		// Check balance of the wallet associated with this rule
		try {
			// Log the balance request details
			const balanceRequest = {
				walletAddress,
				network: resolvedToken.network,
				token: resolvedToken.tokenName,
				requiredAmount: requirement.requiredAmount.toString(),
				paymentToken: rule.paymentToken,
			};
			
			if (context) {
				context.logger?.info(`Checking balance for rule: ${JSON.stringify(balanceRequest)}`);
			}

			const balanceResponse = await getBalanceByLocator(api, walletAddress, resolvedToken.network, resolvedToken.tokenName);
			
			if (context) {
				context.logger?.debug(`Balance response received: ${JSON.stringify(balanceResponse)}`);
			}

			const available = extractAvailableBalance(balanceResponse as IDataObject);
			
			if (context) {
				context.logger?.info(`Balance check result - Wallet: ${walletAddress}, Network: ${resolvedToken.network}, Token: ${resolvedToken.tokenName}, Available: ${available?.toString() || 'null'}, Required: ${requirement.requiredAmount.toString()}, Sufficient: ${available != null && available >= requirement.requiredAmount}`);
			}
			
			if (available != null && available >= requirement.requiredAmount) {
				return {
					...rule,
					requirement: requirement.requirement,
					available,
					required: requirement.requiredAmount,
					walletAddress,
				};
			}
		} catch (error) {
			// If balance check fails, skip this rule and try the next one
			if (context) {
				context.logger?.warn(`Balance check failed for wallet ${walletAddress}, network ${resolvedToken.network}, token ${resolvedToken.tokenName}: ${error instanceof Error ? error.message : String(error)}`);
			}
			continue;
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

	// Use normalizedName if available, otherwise fall back to the tokenPart from the rule
	const tokenName = token.normalizedName?.toLowerCase() || (tokenPart || '').toLowerCase();

	return {
		network: kind.network.toLowerCase(),
		contractAddress: token.contractAddress.toLowerCase(),
		tokenName,
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

async function signPayment(
	payerWalletAddress: string,
	payerPrivateKey: string,
	requirement: IPaymentRequirements,
	requiredAmount: bigint,
	context: IExecuteFunctions,
	itemIndex: number,
): Promise<IPaymentPayload> {
	// Dynamic import of ethers
	const { ethers } = await import('ethers');

	// Create wallet from private key
	const wallet = new ethers.Wallet(payerPrivateKey);

	// Get current timestamp
	const now = Math.floor(Date.now() / 1000);
	const validAfter = now.toString();
	const validBefore = (now + (requirement.maxTimeoutSeconds || 3600)).toString();

	// Generate a nonce (using random bytes for uniqueness)
	// Use Node.js crypto for better compatibility
	const crypto = await import('crypto');
	const nonceBytes = crypto.randomBytes(32);
	const nonce = '0x' + nonceBytes.toString('hex');

	// Create authorization object
	const authorization = {
		from: payerWalletAddress.toLowerCase(),
		to: requirement.payTo.toLowerCase(),
		value: requiredAmount.toString(),
		validAfter,
		validBefore,
		nonce,
	};

	// EIP-3009 exact scheme uses EIP-712 signing
	// Domain separator for EIP-712
	const domain = {
		name: 'TransferWithAuthorization',
		version: requirement.extra?.version || '1',
		chainId: getChainId(requirement.network),
		verifyingContract: requirement.asset.toLowerCase(),
	};

	// Types for EIP-712
	const types = {
		TransferWithAuthorization: [
			{ name: 'from', type: 'address' },
			{ name: 'to', type: 'address' },
			{ name: 'value', type: 'uint256' },
			{ name: 'validAfter', type: 'uint256' },
			{ name: 'validBefore', type: 'uint256' },
			{ name: 'nonce', type: 'bytes32' },
		],
	};

	// Sign the authorization using signTypedData (ethers v6)
	const signature = await wallet.signTypedData(domain, types, authorization);

	// Create payment payload
	const paymentPayload: IPaymentPayload = {
		x402Version: 1,
		scheme: requirement.scheme || 'exact',
		network: requirement.network,
		payload: {
			signature,
			authorization,
		},
	};

	return paymentPayload;
}

function getChainId(network: string): number {
	const networkLower = network.toLowerCase();
	if (networkLower === 'base-sepolia' || networkLower === 'base sepolia') {
		return 84532;
	}
	if (networkLower === 'base') {
		return 8453;
	}
	if (networkLower === 'ethereum' || networkLower === 'mainnet') {
		return 1;
	}
	if (networkLower === 'sepolia') {
		return 11155111;
	}
	// Default to base-sepolia for staging
	return 84532;
}

async function settlePayment(
	paymentPayload: IPaymentPayload,
	requirement: IPaymentRequirements,
	context: IExecuteFunctions,
	itemIndex: number,
): Promise<IDataObject> {
	// Create PaymentRequirements instance
	const paymentRequirements = new PaymentRequirementsClass(
		requirement.scheme,
		requirement.network,
		requirement.maxAmountRequired,
		requirement.resource,
		requirement.description,
		requirement.mimeType,
		requirement.outputSchema,
		requirement.payTo,
		requirement.maxTimeoutSeconds,
		requirement.asset,
		requirement.extra,
	);

	// Convert PaymentRequirements to plain object for JSON serialization
	const paymentRequirementsObj: IPaymentRequirements = {
		scheme: paymentRequirements.scheme,
		network: paymentRequirements.network,
		maxAmountRequired: paymentRequirements.maxAmountRequired,
		resource: paymentRequirements.resource,
		description: paymentRequirements.description,
		mimeType: paymentRequirements.mimeType,
		outputSchema: paymentRequirements.outputSchema,
		payTo: paymentRequirements.payTo,
		maxTimeoutSeconds: paymentRequirements.maxTimeoutSeconds,
		asset: paymentRequirements.asset,
		extra: paymentRequirements.extra,
	};

	const requestBody = {
		x402Version: typeof paymentPayload.x402Version === 'string' ? parseInt(paymentPayload.x402Version, 10) : paymentPayload.x402Version ?? 1,
		paymentPayload: {
			...paymentPayload,
			x402Version: typeof paymentPayload.x402Version === 'string' ? parseInt(paymentPayload.x402Version, 10) : paymentPayload.x402Version ?? 1,
		},
		paymentRequirements: paymentRequirementsObj,
	};

	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
	};

	const CDP_HOST = 'facilitator.corbits.dev';
	const FACILITATOR_SETTLE_PATH = '/settle';

	try {
		const response = await context.helpers.httpRequest({
			method: 'POST',
			url: `https://${CDP_HOST}${FACILITATOR_SETTLE_PATH}`,
			headers,
			body: requestBody,
			json: true,
		});

		return response as IDataObject;
	} catch (error: unknown) {
		throw new NodeApiError(context.getNode(), error as object & { message?: string });
	}
}
