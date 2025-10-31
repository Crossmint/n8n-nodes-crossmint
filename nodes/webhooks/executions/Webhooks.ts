import {
	IDataObject,
	INodeExecutionData,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';
import { setupOutputConnection } from '../utils/webhookUtils';
// import { rm, } from 'fs/promises';
import type * as express from 'express';
import { createPrivateKey, sign as cryptoSign, randomBytes } from 'crypto';
import { signAsync as ed25519SignAsync } from './crypto/ED25519';

export interface IPaymentPayload {
	x402Version: number;
	scheme: string;
	network: string;
	payload: {
		authorization: {
			from: string;
			to: string;
			value: string;
			validAfter: string;
			validBefore: string;
			nonce: string;
		};
		signature: string;
	};
}

export interface IPaymentRequirements {
	scheme: string;
	network: string;
	maxAmountRequired: string; // BigNumberString
	resource: string;
	description: string;
	mimeType: string;
	outputSchema: any;
	payTo: string; // EVM Account Address
	maxTimeoutSeconds: number;
	asset: string; // EVM Contract Address
	extra: {
		name: string;
		version: string;
	};
}


export async function webhookTrigger(this: IWebhookFunctions): Promise<IWebhookResponseData> {
	const body = this.getBodyData();
	return await handleX402Webhook.call(this, body);
}

async function handleX402Webhook(
	this: IWebhookFunctions,
	_body: IDataObject,
): Promise<IWebhookResponseData> {
	const responseMode = this.getNodeParameter('responseMode', 'onReceived') as string;

	const headers = this.getHeaderData();
	const req = this.getRequestObject();
	const resp = this.getResponseObject();
	const requestMethod = this.getRequestObject().method;

	const prepareOutput = setupOutputConnection(this, requestMethod, {
		// jwtPayload: validationData,
	});

	// Get the credential data (always available since it's required at node level)
	const credentials = await this.getCredentials('crossmintApi');
	if (!credentials) {
		// This is an example of direct response with Express
		resp.writeHead(403);
		resp.end('crossmintApi credential not found');
		return { noWebhookResponse: true };
	}

	// Coinbase credentials (apiKeyId/apiKeySecret) are required for x402 processing
	const coinbaseKeyId = (credentials as any).apiKeyId as string | undefined;
	const coinbaseKeySecret = (credentials as any).apiKeySecret as string | undefined;
	if (!coinbaseKeyId || !coinbaseKeySecret) {
		resp.writeHead(403);
		resp.end('crossmintApi credential missing Coinbase apiKeyId or apiKeySecret');
		return { noWebhookResponse: true };
	}

	const supportedTokens = getSupportedTokens();

	// We need to figure out which of the tokens have been configured for this node
	const configuredTokens = this.getNodeParameter('tokens') as {
		paymentToken: { paymentToken: string; payToAddress: string; paymentAmount: number }[];
	};

	const resourceDescription = ''; // By default (No options in node)
	const mimeType = 'application/json'; // By default (No options in node)

	const responseData = this.getNodeParameter('responseData') as string;

	const webhookUrl = this.getNodeWebhookUrl('default');
	if (webhookUrl == null) {
		resp.writeHead(403);
		resp.end('webhookUrl not found');
		return { noWebhookResponse: true };
	}

	// Build normalized payment requirements, enforcing uniqueness per network
	const paymentRequirements = buildPaymentRequirements(
		configuredTokens.paymentToken,
		supportedTokens,
		webhookUrl,
		resourceDescription,
		mimeType,
		resp,
	);
	if (paymentRequirements == null) return { noWebhookResponse: true };

	// If there's no x-payment header, return a 402 error with payment details
	const xPaymentHeader = headers['x-payment'];
	if (xPaymentHeader == null || typeof xPaymentHeader !== 'string') {
		return generateX402Error(resp, 'No x-payment header provided', paymentRequirements);
	}

	// try to decode the x-payment header if it exists
	try {
		const decodedXPaymentJson = parseXPaymentHeader(xPaymentHeader);

		const validation = validateXPayment(decodedXPaymentJson);
		if (validation != 'valid') {
			resp.writeHead(402, { 'Content-Type': 'application/json' });
			resp.end(
				JSON.stringify({
					error: {
						errorMessage: 'x-payment header is not valid',
						paymentConfigs: paymentRequirements,
					},
				}),
			);
			return { noWebhookResponse: true };
		}

		const verification = verifyPaymentDetails(decodedXPaymentJson, paymentRequirements);
		if (!verification.valid) {
			return generateX402Error(
				resp,
				`x-payment header is not valid for reasons: ${verification.errors}`,
				paymentRequirements,
			);
		}

		// Looks like everything is valid, now we'll verify the payment via Crossmint API.
		// We need to get the actual payment config- there's only one per network.
		// Problem with the x402 spec is that they don't send the actual token address.
		// So we need to find the config that matches the network, there should be only 1,
		// and we use that.

		const verifyResponse = await verifyX402Payment(
			coinbaseKeyId!,
			coinbaseKeySecret!,
			decodedXPaymentJson,
			verification.paymentRequirements!,
		);

		if (!verifyResponse.isValid) {
			return generateX402Error(
				resp,
				`x-payment verification failed: ${verifyResponse.invalidReason}`,
				paymentRequirements,
			);
		}

		// If the verification is valid, we are going to be a little optimistic about the settlement. Since this can take a while, if the method errors,
		// (such as from a Cloudflare 502), we'll move on and assume it's successful.

		try {
			const settleResponse = await settleX402Payment(
				coinbaseKeyId!,
				coinbaseKeySecret!,
				decodedXPaymentJson,
				verification.paymentRequirements!,
			);

			if (!settleResponse.success) {
				resp.writeHead(402, { 'Content-Type': 'application/json' });
				resp.end(
					JSON.stringify({
						error: {
							errorMessage: `x-payment settlement failed: ${settleResponse.error}`,
						},
					}),
				);
				return { noWebhookResponse: true };
			}

			// Payment is settled, now we need to return the workflow data
			return generateResponse(
				this,
				req,
				responseMode,
				responseData,
				settleResponse.txHash ?? 'UNKNOWN_TX',
				prepareOutput,
			);
		} catch (error) {
			this.logger.error('Error in x402 webhook settlement, moving on...', error);
			return generateResponse(this, req, responseMode, responseData, 'TBD', prepareOutput);
		}
	} catch (error) {
		this.logger.error('Error in x402 webhook', error);
		// Return an error object if the token format is invalid
		return generateX402Error(
			resp,
			`No x-payment header provided: ${error.message}`,
			paymentRequirements,
		);
	}
}

function generateResponse(
	context: IWebhookFunctions,
	req: express.Request,
	responseMode: string,
	responseData: string,
	txHash: string,
	prepareOutput: (data: INodeExecutionData) => INodeExecutionData[][],
) {
	const response: INodeExecutionData = {
		json: {
			headers: req.headers,
			params: req.params,
			query: req.query,
			body: req.body,
			txHash: txHash,
		},
	};
	if (responseMode === 'streaming') {
		const res = context.getResponseObject();

		// Set up streaming response headers
		res.writeHead(200, {
			'Content-Type': 'application/json; charset=utf-8',
			'Transfer-Encoding': 'chunked',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive',
		});

		// Flush headers immediately
		res.flushHeaders();

		return {
			noWebhookResponse: true,
			workflowData: prepareOutput(response),
		};
	}

	return {
		webhookResponse: responseData,
		workflowData: prepareOutput(response),
	};
}

function generateX402Error(
	resp: express.Response,
	errorMessage: string,
	paymentRequirements: IPaymentRequirements[],
): IWebhookResponseData {
	resp.writeHead(402, { 'Content-Type': 'application/json' });
	resp.end(
		JSON.stringify({
			error: {
				errorMessage,
				paymentConfigs: paymentRequirements,
			},
		}),
	);
	return { noWebhookResponse: true };
}

// Helpers

// (Intentionally inlined credential checks above to preserve original logic)

function getSupportedTokens(): {
	kinds: Array<{
		scheme: string;
		network: string;
		tokens: Array<{ name: string; contractAddress: string; version: string }>;
	}>;
} {
	return {
		kinds: [
			{
				scheme: 'eip3009',
				network: 'solana',
				tokens: [
					{ name: 'USDC', contractAddress: 'usdc', version: '1' },
					{ name: 'SOL', contractAddress: 'sol', version: '1' },
				],
			},
		],
	};
}

function buildPaymentRequirements(
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

	for (const configuredToken of configured ?? []) {
		const [network, contractAddress] = (configuredToken.paymentToken || '').split(':');

		if (!network || !contractAddress) {
			resp.writeHead(403);
			resp.end('Misconfiguration: paymentToken must be in the form "network:contractAddress"');
			return null;
		}

		if (configuredNetworks.includes(network)) {
			resp.writeHead(403);
			resp.end(
				`Misconfiguration: Network ${network} has multiple configured tokens. You may only have one payment token per network.`,
			);
			return null;
		}
		configuredNetworks.push(network);

		const kind = supportedTokens.kinds.find((k) => k.network === network);
		if (kind == null) throw new Error(`Supported network ${network} not found`);

		const supportedToken = kind.tokens.find((t) => t.contractAddress === contractAddress);
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

function parseXPaymentHeader(xPaymentHeader: string): IPaymentPayload {
	const decoded = Buffer.from(xPaymentHeader, 'base64').toString('utf-8');
	return JSON.parse(decoded) as IPaymentPayload;
}

// Coinbase CDP facilitator integration
const CDP_HOST = 'api.cdp.coinbase.com';
const FACILITATOR_VERIFY_PATH = '/platform/v2/x402/verify';
const FACILITATOR_SETTLE_PATH = '/platform/v2/x402/settle';

function base64UrlEncode(input: Buffer | string): string {
	const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
	return buf
		.toString('base64')
		.replace(/=/g, '')
		.replace(/\+/g, '-')
		.replace(/\//g, '_');
}

function toKeyObjectFromSecret(secret: string) {
	if (secret.startsWith('-----BEGIN')) {
		return createPrivateKey({ key: secret });
	}
	return createPrivateKey({ key: Buffer.from(secret, 'base64'), format: 'der', type: 'pkcs8' });
}

function detectSigningAlg(keyObj: ReturnType<typeof createPrivateKey>): {
	algHeader: 'EdDSA' | 'ES256';
	signAlg: null | 'sha256';
} {
	const type = (keyObj as any).asymmetricKeyType as string;
	if (type === 'ed25519') return { algHeader: 'EdDSA', signAlg: null };
	if (type === 'ec') return { algHeader: 'ES256', signAlg: 'sha256' };
	throw new Error(`Unsupported key type: ${type}. Use Ed25519 or EC P-256.`);
}

async function buildCdpJwtAsync(params: {
	apiKeyId: string;
	apiKeySecret: string;
	method: string;
	host: string;
	path: string;
	expiresInSec?: number;
}): Promise<string> {
	const { apiKeyId, apiKeySecret, method, host, path, expiresInSec = 120 } = params;

	let algHeader: 'EdDSA' | 'ES256';
	let signAlg: null | 'sha256' = null;
	let keyObj: ReturnType<typeof createPrivateKey> | undefined;
	let useEd25519Noble = false;

	if (apiKeySecret.startsWith('-----BEGIN')) {
		keyObj = toKeyObjectFromSecret(apiKeySecret);
		const det = detectSigningAlg(keyObj);
		algHeader = det.algHeader;
		signAlg = det.signAlg;
	} else {
		// Sign exactly like our ED25519.ts usage: expect base64-encoded 32-byte Ed25519 secret
		useEd25519Noble = true;
		algHeader = 'EdDSA';
	}

	const now = Math.floor(Date.now() / 1000);
	const header = {
		alg: algHeader,
		typ: 'JWT',
		kid: apiKeyId,
		nonce: randomBytes(16).toString('hex'),
	} as const;
	const payload = {
		iss: 'cdp',
		sub: apiKeyId,
		nbf: now,
		exp: now + expiresInSec,
		uri: `${method.toUpperCase()} ${host}${path}`,
	};

	const encHeader = base64UrlEncode(JSON.stringify(header));
	const encPayload = base64UrlEncode(JSON.stringify(payload));
	const signingInput = Buffer.from(`${encHeader}.${encPayload}`);

	let signature: Buffer;
	if (useEd25519Noble) {
		// Expect raw 32-byte Ed25519 secret in base64
		const raw = Buffer.from(apiKeySecret, 'base64');
		if (raw.length !== 32) {
			throw new Error('Invalid Ed25519 secret: expected base64-encoded 32-byte key');
		}
		const sig = await ed25519SignAsync(signingInput, raw);
		signature = Buffer.from(sig);
	} else {
		// Use Node crypto with either Ed25519 (signAlg null) or ES256
		signature = cryptoSign(signAlg as any, signingInput, keyObj!);
	}
	const encSig = base64UrlEncode(signature);
	return `${encHeader}.${encPayload}.${encSig}`;
}

async function verifyX402Payment(
	apiKeyId: string,
	apiKeySecret: string,
	paymentPayload: IPaymentPayload,
	paymentRequirements: PaymentRequirements,
): Promise<{ isValid: boolean; invalidReason?: string }>
{
const token = await buildCdpJwtAsync({ apiKeyId, apiKeySecret, method: 'POST', host: CDP_HOST, path: FACILITATOR_VERIFY_PATH });
	const res = await fetch(`https://${CDP_HOST}${FACILITATOR_VERIFY_PATH}`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json',
			Accept: 'application/json',
		},
		body: JSON.stringify({ x402Version: paymentPayload.x402Version ?? 1, paymentPayload, paymentRequirements }),
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`/verify ${res.status}: ${text}`);
	}
	return (await res.json()) as { isValid: boolean; invalidReason?: string };
}

async function settleX402Payment(
	apiKeyId: string,
	apiKeySecret: string,
	paymentPayload: IPaymentPayload,
	paymentRequirements: PaymentRequirements,
): Promise<{ success: boolean; txHash?: string; error?: string }>
{
const token = await buildCdpJwtAsync({ apiKeyId, apiKeySecret, method: 'POST', host: CDP_HOST, path: FACILITATOR_SETTLE_PATH });
	const res = await fetch(`https://${CDP_HOST}${FACILITATOR_SETTLE_PATH}`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json',
			Accept: 'application/json',
		},
		body: JSON.stringify({ x402Version: paymentPayload.x402Version ?? 1, paymentPayload, paymentRequirements }),
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`/settle ${res.status}: ${text}`);
	}
	const data = (await res.json()) as { success: boolean; transaction?: { hash?: string } } & Record<string, any>;
	return { success: data.success, txHash: data.transaction?.hash, error: data['errorReason'] };
}

// ED-25519 signature verification
/*async function verify1ShotSignature(
	publicKey: string,
	signature: string,
	payload: any,
): Promise<boolean> {
	try {
		// Convert the public key from base64 to bytes
		const publicKeyBytes = Buffer.from(publicKey, 'base64');

		// Convert the signature from base64 to bytes
		const signatureBytes = Buffer.from(signature, 'base64');

		// Sort all object keys recursively and create a canonical JSON string
		const sortedData = sortObjectKeys(payload);
		const message = JSON.stringify(sortedData);

		// Convert the message to UTF-8 bytes
		const messageBytes = new TextEncoder().encode(message);

		// Verify the signature
		return await verifyAsync(signatureBytes, messageBytes, publicKeyBytes);
	} catch (error) {
		// If any error occurs during validation, return false
		return false;
	}
}*/

/**
 * Recursively sorts object keys alphabetically
 * @param obj - The object to sort
 * @returns A new object with sorted keys
 */
/*function sortObjectKeys(obj: Record<string, any>): Record<string, any> {
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
}*/

// this will make sure our x-payment header contains all necessary components
function validateXPayment(payment: IPaymentPayload): string {
	// Define the expected structure and types
	const requiredShape = {
		x402Version: 'number',
		scheme: 'string',
		network: 'string',
		payload: {
			authorization: {
				from: 'string',
				to: 'string',
				value: 'string',
				validAfter: 'string',
				validBefore: 'string',
				nonce: 'string',
			},
			signature: 'string',
		},
	};

	const missing = checkShape(requiredShape, payment, '');

	if (missing.length > 0) {
		return missing.join('; ');
	}
	return 'valid';
}

function checkShape(
	expected: Record<string, any>,
	actual: Record<string, any>,
	path: string,
): string[] {
	const missing = new Array<string>();
	for (const key in expected) {
		const currentPath = path ? path + '.' + key : key;

		if (!(key in actual)) {
			missing.push('Missing field: ' + currentPath);
		} else if (typeof expected[key] === 'object') {
			if (typeof actual[key] !== 'object' || actual[key] === null) {
				missing.push('Invalid type at ' + currentPath + ': expected object');
			} else {
				checkShape(expected[key], actual[key], currentPath);
			}
		} else {
			if (typeof actual[key] !== expected[key]) {
				missing.push(
					'Invalid type at ' +
						currentPath +
						': expected ' +
						expected[key] +
						', got ' +
						typeof actual[key],
				);
			}
		}
	}
	return missing;
}

// this function will ensure the x-payment header is for one of our supported
// networks, is for the correct amount, and pays the right address
function verifyPaymentDetails(
	header: IPaymentPayload,
	paymentRequirements: PaymentRequirements[],
): { valid: boolean; errors: string; paymentRequirements: PaymentRequirements | undefined } {
	const errors = [];

	// 1. Check that network exists in config
	const network = header.network;
	const configEntry = paymentRequirements.find(
		(pc) => pc.network.toLowerCase() == (network || '').toLowerCase(),
	);

	if (configEntry == null) {
		errors.push('Invalid or unsupported network: ' + network);
	}

	// 2. Check value >= maxAmountRequired
	if (configEntry) {
		try {
			const required = BigInt(configEntry.maxAmountRequired);
			let actual;

			actual = BigInt(header.payload.authorization.value);
			if (typeof actual !== 'undefined' && actual < required) {
				errors.push(`Value too low: got ${actual}, requires at least ${required}`);
			}
		} catch (e) {
			errors.push('Invalid value: must be numeric string');
		}

		// 3. Check 'to' matches payTo (case-insensitive)
		const toAddr = header.payload?.authorization?.to;
		if (toAddr == null) {
			errors.push("Missing 'to' field in authorization");
		} else if (toAddr.toLowerCase() != configEntry.payTo.toLowerCase()) {
			errors.push(`Invalid 'to' address: expected ${configEntry.payTo}, got ${toAddr}`);
		}

		// 4. Check the validBefore and validAfer timestamps.
		const now = Math.floor(Date.now() / 1000);
		try {
			const validAfter = Number(header.payload.authorization.validAfter);
			const validBefore = Number(header.payload.authorization.validBefore);

			if (validAfter > now) {
				errors.push(
					`Payment has not activated, validAfter is ${validAfter} but the server time is ${now}`,
				);
			}
			if (validBefore < now) {
				errors.push(
					`Payment has expired, validBefore is ${validBefore} but the server time is ${now}`,
				);
			}
		} catch (e) {
			errors.push(`Invalid validAfter or validBefore timestamps`);
		}
	}

	return {
		valid: errors.length == 0,
		errors: errors.join('; '),
		paymentRequirements: configEntry,
	};
}

class PaymentRequirements implements IPaymentRequirements {
	public constructor(
		public scheme: string,
		public network: string,
		public maxAmountRequired: string,
		public resource: string,
		public description: string,
		public mimeType: string,
		public outputSchema: any,
		public payTo: string,
		public maxTimeoutSeconds: number,
		public asset: string,
		public extra: {
			name: string;
			version: string;
		},
	) {}
}
