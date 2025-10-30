export type EChain =
	| 1
	| 11155111
	| 42
	| 137
	| 43114
	| 43113
	| 80002
	| 100
	| 56
	| 1284
	| 42161
	| 10
	| 592
	| 81
	| 97
	| 101
	| 324
	| 8453
	| 84532
	| 88888
	| 11297108109
	| 42220
	| 130
	| 480
	| 81457;

export type ETransactionStatus = 'Pending' | 'Submitted' | 'Completed' | 'Retrying' | 'Failed';
export type ESolidityStateMutability = 'nonpayable' | 'payable' | 'view' | 'pure';
export type ESolidityAbiParameterType =
	| 'address'
	| 'bool'
	| 'bytes'
	| 'int'
	| 'string'
	| 'uint'
	| 'struct';

export type JSONValue =
	| string
	| number
	| boolean
	| null
	| JSONValue[]
	| { [key: string]: JSONValue };

export interface EntityBookKeeping {
	deleted: boolean;
	updated: number;
	created: number;
}

export interface EntityBookKeepingWithoutDeleted {
	updated: number;
	created: number;
}

export class PagedResponse<T> {
	public constructor(
		public response: T[],
		public page: number,
		public pageSize: number,
		public totalResults: number,
	) {}
}

export class ChainInfo {
	public constructor(
		public name: string,
		public chainId: number,
		public averageBlockMiningTime: number,
		public nativeCurrency: NativeCurrencyInformation,
		public type: string,
	) {}
}

export class NativeCurrencyInformation {
	public constructor(
		public name: string,
		public symbol: string,
		public decimals: number,
	) {}
}

export interface AccountBalanceDetails {
	type: number;
	ticker: string;
	chainId: EChain;
	tokenAddress: string;
	accountAddress: string;
	balance: string;
	decimals: number;
}

export interface Wallet {
	id: string;
	accountAddress: string;
	businessId: string | null;
	userId: string | null;
	chainId: EChain;
	name: string;
	description: string;
	isAdmin: boolean;
	accountBalanceDetails: AccountBalanceDetails | null;
	updated: number;
	created: number;
}

export interface SolidityStructParam {
	id: string;
	structId: string;
	name: string;
	description?: string;
	type: ESolidityAbiParameterType;
	index: number;
	staticValue?: string;
	typeSize?: number;
	typeSize2?: number;
	isArray?: boolean;
	arraySize?: number;
	typeStructId?: string;
	typeStruct?: SolidityStruct;
}

export interface SolidityStruct {
	id: string;
	businessId: string;
	name: string;
	params: SolidityStructParam[];
	updated: number;
	created: number;
}

export interface ContractMethod {
	id: string;
	businessId: string;
	chainId: EChain;
	contractAddress: string;
	walletId: string;
	name: string;
	description: string;
	functionName: string;
	inputs: SolidityStructParam[];
	outputs: SolidityStructParam[];
	stateMutability: ESolidityStateMutability;
	promptId: string | null;
	callbackUrl: string | null;
	publicKey: string | null;
	deleted: boolean;
	updated: number;
	created: number;
}

export interface Transaction {
	id: string;
	contractMethodId: string;
	apiCredentialId: string | null;
	apiKey: string | null;
	userId: string | null;
	status: ETransactionStatus;
	transactionHash: string | null;
	name: string;
	functionName: string;
	chainId: EChain;
	memo: string | null;
	completed: number | null;
	deleted: boolean;
	updated: number;
	created: number;
}

export interface ContractMethodEstimate {
	chainId: EChain;
	contractAddress: string;
	functionName: string;
	gasAmount: string;
	maxFeePerGas: string | null;
	maxPriorityFeePerGas: string | null;
	gasPrice: string | null;
}

export interface ContractMethodTestResult {
	success: boolean;
	result: any | null;
	error: any | null;
}

export interface ContractFunctionParamPrompt {
	index: number;
	name: string;
	description: string;
	tags: string[];
}

export interface ContractFunctionPrompt {
	name: string;
	description: string;
	tags: string[];
	inputs: ContractFunctionParamPrompt[];
	outputs: ContractFunctionParamPrompt[];
}

export interface Prompt {
	id: string;
	userId: string;
	chainId: EChain;
	contractAddress: string;
	name: string;
	description: string;
	tags: string[];
	updated: number;
	created: number;
}

export interface FullPrompt extends Prompt {
	functions: ContractFunctionPrompt[];
}

export interface ERC7702Authorization {
	address: string;
	nonce: string;
	chainId: EChain;
	signature: string;
}

export interface SolidityStructParamUpdate {
	name?: string;
	description?: string;
	type?: ESolidityAbiParameterType;
	index?: number;
	staticValue?: string;
	typeSize?: number;
	typeSize2?: number;
	isArray?: boolean;
	arraySize?: number;
	typeStructId?: string;
	typeStruct?: NewSolidityStruct;
}

export interface NewSolidityStructParam extends SolidityStructParamUpdate {
	name: string;
	type: ESolidityAbiParameterType;
	index: number;
}

export interface NewSolidityStruct {
	name?: string;
	params: NewSolidityStructParam[];
}

export interface EncodeContractMethodResult {
	data: string;
}

export interface Topic {
	name: string;
	indexed: boolean;
}

export interface ContractEvent {
	id: string;
	businessId: string;
	chainId: EChain;
	contractAddress: string;
	name: string;
	description: string;
	eventName: string;
	topicHash: string;
	topics: Topic[];
	updated: number;
	created: number;
}

export interface ContractEventLog {
	eventName: string;
	blockNumber: number;
	transactionHash: string;
	logIndex: number;
	removed: boolean;
	topics: { [key: string]: string };
}

export type EX402Network = 'mainnet' | 'sepolia';

export interface X402SupportedResponse {
	kinds: Array<{
		scheme: string;
		network: EX402Network;
		tokens: Array<{
			contractAddress: string;
			name: string;
			symbol: string;
			decimals: number;
			version: string;
		}>;
	}>;
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

export interface X402VerifyRequest {
	x402Version: number;
	paymentPayload: IPaymentPayload;
	paymentRequirements: IPaymentRequirements;
}

export interface X402VerifyResponse {
	isValid: boolean;
	invalidReason: string;
}

export interface X402SettleRequest {
	x402Version: number;
	paymentPayload: IPaymentPayload;
	paymentRequirements: IPaymentRequirements;
}

export interface X402SettleResponse {
	success: boolean;
	error: string;
	txHash: string;
	networkId: EX402Network;
}
