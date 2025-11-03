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

