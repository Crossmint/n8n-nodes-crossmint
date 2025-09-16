import { IHttpRequestOptions } from 'n8n-workflow';

export interface CrossmintCredentials {
	apiKey: string;
	environment: 'Production' | 'Staging';
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

export interface NFTMintRequest {
	recipient: string;
	sendNotification: boolean;
	locale: string;
	reuploadLinkedFiles: boolean;
	compressed: boolean;
	templateId?: string;
	metadata?: string | {
		name: string;
		image: string;
		description: string;
		animation_url?: string;
		symbol?: string;
		attributes?: Array<{
			trait_type: string;
			value: string | number;
		}>;
	};
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
