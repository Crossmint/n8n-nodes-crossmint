export interface IPaymentPayload {
	x402Version: string;
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
			name: string;
			version: string;
		},
	) {}
}

