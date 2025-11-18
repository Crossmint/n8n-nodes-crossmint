import { IExecuteFunctions, IDataObject, NodeOperationError } from 'n8n-workflow';
import type { CrossmintCredentials } from '../../transport/types';

const EMPTY_BODY: IDataObject = {};

export async function paywallRequest(
	context: IExecuteFunctions,
	itemIndex: number,
): Promise<IDataObject> {
	const credentials = await context.getCredentials<CrossmintCredentials>('crossmintApi');
	const resourceUrl = context.getNodeParameter('resourceUrl', itemIndex) as string;
	const smartWalletAddress = context.getNodeParameter('smartWalletAddress', itemIndex) as string;

	if (!smartWalletAddress || smartWalletAddress.trim() === '') {
		throw new NodeOperationError(context.getNode(), 'Smart wallet address is required to complete the payment', { itemIndex });
	}

	// Lazy load dependencies to avoid n8n module loader issues
	// Use computed module names that can't be statically analyzed by n8n's module loader
	const walletModuleName = '@' + 'faremeter' + '/' + 'wallet-crossmint';
	const settlementModuleName = '@' + 'faremeter' + '/' + 'x-solana-settlement';
	const fetchModuleName = '@' + 'faremeter' + '/' + 'fetch';
	
	let walletCrossmintModule: any;
	let xSolanaSettlementModule: any;
	let fetchModule: any;
	
	try {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		walletCrossmintModule = require(walletModuleName);
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		xSolanaSettlementModule = require(settlementModuleName);
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		fetchModule = require(fetchModuleName);
	} catch (error) {
		throw new NodeOperationError(
			context.getNode(),
			`Failed to load @faremeter dependencies. Please install them: npm install @faremeter/fetch @faremeter/wallet-crossmint @faremeter/x-solana-settlement`,
			{ itemIndex },
		);
	}
	
	const { createCrossmintWallet } = walletCrossmintModule;
	const { createPaymentHandler } = xSolanaSettlementModule;
	const { internal: fetchInternal } = fetchModule;

	const cluster = resolveCluster(credentials.environment);
	const wallet = await createCrossmintWallet(cluster, credentials.apiKey, smartWalletAddress.trim());
	const paymentHandler = createPaymentHandler(wallet);

	const initialResponse = await executeResourceRequest(context, resourceUrl, EMPTY_BODY, itemIndex);
	if (initialResponse.response.status !== 402) {
		return {
			statusCode: initialResponse.response.status,
			resourceResponse: initialResponse.body,
		};
	}

	const paymentContext = await fetchInternal.processPaymentRequiredResponse(
		{ request: resourceUrl },
		initialResponse.body,
		{ handlers: [paymentHandler] },
	);

	const settlementResponse = await executeResourceRequest(context, resourceUrl, EMPTY_BODY, itemIndex, paymentContext.paymentHeader);

	return {
		x402Version: initialResponse.body.x402Version ?? 1,
		accepts: extractAccepts(initialResponse.body),
		requirement: paymentContext.payer.requirements,
		payment: paymentContext.paymentPayload,
		paymentHeader: paymentContext.paymentHeader,
		resourceResponse: settlementResponse.body,
		smartWalletAddress,
	};
}

function resolveCluster(environment?: string): 'devnet' | 'mainnet-beta' {
	return environment === 'production' ? 'mainnet-beta' : 'devnet';
}

async function executeResourceRequest(
	context: IExecuteFunctions,
	url: string,
	body: IDataObject,
	itemIndex: number,
	paymentHeader?: string,
): Promise<{ response: Response; body: IDataObject }> {
	try {
		const headers: Record<string, string> = {
			Accept: 'application/json',
			'Content-Type': 'application/json',
		};

		if (paymentHeader) {
			headers['x-payment'] = paymentHeader;
		}

		const response = await fetch(url, {
			method: 'POST',
			headers,
			body: JSON.stringify(body),
		});

		const parsed = await parseResponseBody(response);
		return { response, body: parsed };
	} catch (error) {
		throw new NodeOperationError(
			context.getNode(),
			`Failed to call resource URL: ${(error as Error).message}`,
			{ itemIndex },
		);
	}
}

async function parseResponseBody(response: Response): Promise<IDataObject> {
	const text = await response.text();
	if (!text) {
		return {};
	}

	try {
		return JSON.parse(text) as IDataObject;
	} catch {
		return { raw: text };
	}
}

function extractAccepts(body: IDataObject): IDataObject[] {
	if (Array.isArray(body.accepts)) {
		return body.accepts as IDataObject[];
	}

	const errorConfigs = (body.error as IDataObject | undefined)?.paymentConfigs;
	if (Array.isArray(errorConfigs)) {
		return errorConfigs as IDataObject[];
	}

	return [];
}