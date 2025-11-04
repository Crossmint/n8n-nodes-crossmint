import { IHttpRequestOptions, IDataObject } from 'n8n-workflow';

export interface CrossmintCredentials {
	apiKey: string;
	environment: 'production' | 'staging';
}

export interface ApiRequestOptions extends Omit<IHttpRequestOptions, 'headers' | 'url'> {
	endpoint: string;
	version?: string;
	headers?: Record<string, string>;
}

export interface WalletCreateRequest {
	type: string;
	chainType: string;
	config: {
		adminSigner: {
			type: string;
			address: string;
		};
	};
	owner?: string;
}

export interface TransferTokenRequest {
	recipient: string;
	amount: string;
}

export interface ApprovalRequest {
	approvals: Array<{
		signer: string;
		signature: string;
	}>;
}

export interface OrderCreateRequest {
	recipient: {
		email: string;
		physicalAddress: {
			name: string;
			line1: string;
			line2?: string;
			city: string;
			state?: string;
			postalCode: string;
			country: string;
		};
	};
	payment: {
		receiptEmail: string;
		method: string;
		currency: string;
		payerAddress?: string;
	};
	lineItems: Array<{
		productLocator: string;
	}>;
}


export interface TransactionCreateRequest {
	params: {
		transaction?: string;
		calls?: Array<{
			transaction: string;
		}>;
		chain?: string;
	};
}

export interface WalletLocatorData {
	mode: string;
	value: string;
}

// EVM exact scheme payload structure (EIP-3009)
export interface IPaymentPayload {
	x402Version: string;
	scheme: string;
	network: string;
	payload: {
		signature: string;
		authorization: {
			from: string;
			to: string;
			value: string;
			validAfter: string;
			validBefore: string;
			nonce: string;
		};
	};
}

export interface IPaymentRequirements {
	scheme: string;
	network: string;
	maxAmountRequired: string; // Amount in smallest unit (e.g., wei for ERC20 tokens)
	resource: string;
	description: string;
	mimeType: string;
	outputSchema: any;
	payTo: string; // EVM wallet address (0x...)
	maxTimeoutSeconds: number;
	asset: string; // ERC20 token contract address (0x...)
	extra: {
		version: string; // EIP-712 domain version
		name: string; // Token name (e.g., "USDC")
	};
}

export class PaymentRequirements implements IPaymentRequirements {
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
		version: string;
		name: string;
	},
	) {}
}



// API Response types
export type ApiResponse = IDataObject;

// Error type for NodeApiError compatibility
export type NodeApiErrorData = Record<string, string | number | boolean | null>;
