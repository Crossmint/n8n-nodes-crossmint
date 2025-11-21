import { IExecuteFunctions, IDataObject, NodeOperationError } from 'n8n-workflow';
import { CrossmintApi } from '../../transport/CrossmintApi';
import { getSupportedTokens } from '../../utils/x402/helpers/paymentHelpers';
import type { CrossmintCredentials, IPaymentRequirements, IPaymentPayload } from '../../transport/types';
import { getBalanceByLocator } from '../wallet/getBalance.operation';

import { ethers } from 'ethers';
import * as crypto from 'crypto';



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
	const initialRequestBody: IDataObject = {};

	const supportedTokens = getSupportedTokens(environment);
	const expectedNetwork = supportedTokens.kinds[0]?.network;
	if (!expectedNetwork) {
		throw new NodeOperationError(context.getNode(), 'No supported payment networks available for the selected environment', { itemIndex });
	}

	const paywallBody = await fetchPaywallRequirements(context, resourceUrl, initialRequestBody, itemIndex);
	const paymentConfigs = extractPaymentRequirementConfigs(paywallBody, context, itemIndex);
	const normalizedRequirements = normalizeRequirements(paymentConfigs, itemIndex, context);

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

	const paymentPayload = await signPayment(
		selectedRule.walletAddress,
		selectedRule.privateKey,
		selectedRule.requirement,
		selectedRule.required,
		context,
		itemIndex,
	);

	const resourceResponse = await sendPaymentToResource(
		context,
		resourceUrl,
		initialRequestBody,
		paymentPayload,
		selectedRule.requirement,
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
		resourceResponse,
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
	requestBody: IDataObject,
	itemIndex: number,
): Promise<IDataObject> {
	try {
		return (await context.helpers.httpRequest({
			method: 'POST',
			url: resourceUrl,
			headers: { Accept: 'application/json' },
			body: requestBody,
			json: true,
			ignoreHttpStatusErrors: true,
		})) as IDataObject;
	} catch (error) {
		throw new NodeOperationError(context.getNode(), 'Failed to retrieve payment requirements from the paywall resource', {
			itemIndex,
		});
	}
}

function extractPaymentRequirementConfigs(
	paywallBody: IDataObject,
	context: IExecuteFunctions,
	itemIndex: number,
): IPaymentRequirements[] {
	const accepts = Array.isArray(paywallBody.accepts) ? (paywallBody.accepts as IPaymentRequirements[]) : undefined;
	const errorConfigs = Array.isArray((paywallBody.error as IDataObject | undefined)?.paymentConfigs)
		? (((paywallBody.error as IDataObject | undefined)?.paymentConfigs as IPaymentRequirements[]) ?? undefined)
		: undefined;

	const configs = accepts ?? errorConfigs;

	if (!configs || configs.length === 0) {
		throw new NodeOperationError(
			context.getNode(),
			'The paywall resource did not return any payment requirements (accepts or error.paymentConfigs)',
			{ itemIndex },
		);
	}

	return configs;
}

function normalizeRequirements(
	configs: IPaymentRequirements[],
	itemIndex: number,
	context: IExecuteFunctions,
): NormalizedRequirement[] {
	if (!Array.isArray(configs) || configs.length === 0) {
		throw new NodeOperationError(context.getNode(), 'The paywall resource did not return any payment requirements', {
			itemIndex,
		});
	}

	return configs.map((requirement) => ({
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

		// Use the wallet address from the rule (preserve original casing for EVM addresses)
		const walletAddress = rule.fromWallet.trim();

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

			console.log("BALANCE ---------->" + JSON.stringify(balanceResponse));

			if (context) {
				context.logger?.debug(`Balance response received: ${JSON.stringify(balanceResponse)}`);
			}

			const available = extractAvailableBalance(balanceResponse);
			console.log("AVAILABLE = " + available);

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

export function extractAvailableBalance(balanceResponse: any): bigint | undefined {
	if (!Array.isArray(balanceResponse)) return undefined;

	const raw = balanceResponse[0]?.rawAmount;
	if (!raw) return undefined;

	return BigInt(raw); // <-- convert to BigInt
}



async function sendPaymentToResource(
	context: IExecuteFunctions,
	resourceUrl: string,
	requestBody: IDataObject,
	paymentPayload: IPaymentPayload,
	requirement: IPaymentRequirements,
): Promise<IDataObject> {
	const headers: Record<string, string> = {
		Accept: 'application/json',
		'Content-Type': 'application/json',
		'x-payment': Buffer.from(JSON.stringify(paymentPayload)).toString('base64'),
	};

	return (await context.helpers.httpRequest({
		method: 'POST',
		url: resourceUrl,
		headers,
		body: requestBody,
		json: true,
		ignoreHttpStatusErrors: true,
	})) as IDataObject;
}

function generateNonce(): string {
	const nonce20 = crypto.randomBytes(20);
	// Pad to 32 bytes (12 bytes of zeros + 20 bytes nonce)
	return '0x' + Buffer.concat([Buffer.alloc(12), nonce20]).toString('hex');
}

async function signPayment(
	payerWalletAddress: string,
	payerPrivateKey: string,
	requirement: IPaymentRequirements,
	requiredAmount: bigint,
	context: IExecuteFunctions,
	itemIndex: number,
): Promise<IPaymentPayload> {
	const { ethers } = await import('ethers');
	const wallet = new ethers.Wallet(payerPrivateKey);

	const now = Math.floor(Date.now() / 1000);
	const validAfter = now - 60;
	const validBefore = now + (requirement.maxTimeoutSeconds || 3600);
	const nonce = generateNonce();

	const value = requirement.maxAmountRequired ?? requiredAmount.toString();
	const signature = await generateEIP3009Signature(
		wallet,
		requirement.asset,
		requirement.payTo,
		value,
		validAfter,
		validBefore,
		nonce,
		requirement.network,
		requirement.extra,
	);

	const paymentPayload: IPaymentPayload = {
		x402Version: 1,
		scheme: requirement.scheme || 'exact',
		network: requirement.network,
		payload: {
			signature,
			authorization: {
				from: wallet.address,
				to: requirement.payTo,
				value,
				validAfter: validAfter.toString(),
				validBefore: validBefore.toString(),
				nonce,
			},
		},
	};

	return paymentPayload;
}

async function generateEIP3009Signature(
	wallet: ethers.Wallet,
	tokenAddress: string,
	to: string,
	value: string,
	validAfter: number,
	validBefore: number,
	nonce: string,
	network: string,
	extra?: { name?: string; version?: string }
): Promise<string> {
	// EIP-712 domain for USDC contract
	// Use values from extra if provided, otherwise defaults
	const domain = {
		name: extra?.name || 'USD Coin',
		version: extra?.version || '2',
		chainId: network === 'base' ? 8453 : 84532, // Base mainnet or Base Sepolia
		verifyingContract: tokenAddress,
	};

	// EIP-712 types for transferWithAuthorization
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

	// Message to sign
	const message = {
		from: wallet.address,
		to: to,
		value: value,
		validAfter: validAfter.toString(),
		validBefore: validBefore.toString(),
		nonce: nonce,
	};

	// Sign the typed data
	const signature = await wallet._signTypedData(domain, types, message);

	return signature;
}