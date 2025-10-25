import type {
	IDataObject,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IPollFunctions,
} from 'n8n-workflow';
import { NodeConnectionType, NodeApiError } from 'n8n-workflow';
import { CrossmintApi } from '../../shared/transport/CrossmintApi';
import { CrossmintCredentials } from '../../shared/transport/types';
import { API_VERSIONS } from '../../shared/utils/constants';
import { buildWalletLocator } from '../../shared/utils/locators';

interface WalletStaticData {
	lastBalances?: { [key: string]: string };
	lastTransactionHashes?: Set<string>;
	lastTimeChecked?: number;
}

/**
 * Poll for wallet balance changes
 */
async function pollBalanceChanges(
	context: IPollFunctions,
	api: CrossmintApi,
	workflowStaticData: WalletStaticData,
): Promise<INodeExecutionData[]> {
	const responseData: INodeExecutionData[] = [];

	const walletResource = context.getNodeParameter('walletLocator', 0) as any;
	const chains = context.getNodeParameter('chains', 0) as string;
	const tkn = context.getNodeParameter('tkn', 0) as string;
	const chainType = context.getNodeParameter('balanceWalletChainType', 0) as string;

	const walletLocator = buildWalletLocator(walletResource, chainType, context, 0);
	const endpoint = `wallets/${walletLocator}/balances?chains=${encodeURIComponent(chains)}&tokens=${encodeURIComponent(tkn)}`;

	const balanceResponse = await api.get(endpoint, API_VERSIONS.WALLETS);

	const currentBalances: { [key: string]: string } = {};

	// Process balance data - API returns an array of token balances
	if (Array.isArray(balanceResponse)) {
		for (const balanceInfo of balanceResponse) {
			if (balanceInfo && typeof balanceInfo === 'object') {
				const tokenData = balanceInfo as IDataObject;
				const tokenSymbol = String(tokenData.symbol || '').toLowerCase();

				// Use 'amount' field which contains the decimal representation
				const currentBalance = tokenData.amount ? String(tokenData.amount) : '0';

				currentBalances[tokenSymbol] = currentBalance;
				const lastBalance = workflowStaticData.lastBalances?.[tokenSymbol];

				// In manual mode, always return at least 1 result for testing
				if (context.getMode() === 'manual') {
					responseData.push({
						json: {
							wallet: walletLocator,
							token: tokenSymbol,
							balance: currentBalance,
							previousBalance: lastBalance || '0',
							changed: lastBalance !== undefined && lastBalance !== currentBalance,
							timestamp: new Date().toISOString(),
							...tokenData,
						},
					});
					// In manual mode, only return first result
					break;
				}

				// In automatic mode, only add if balance changed
				if (lastBalance !== undefined && lastBalance !== currentBalance) {
					responseData.push({
						json: {
							wallet: walletLocator,
							token: tokenSymbol,
							balance: currentBalance,
							previousBalance: lastBalance,
							changed: true,
							timestamp: new Date().toISOString(),
							...tokenData,
						},
					});
				}
			}
		}
	}

	// Update stored balances
	workflowStaticData.lastBalances = currentBalances;

	return responseData;
}

/**
 * Poll for wallet transaction changes
 */
async function pollTransactionChanges(
	context: IPollFunctions,
	api: CrossmintApi,
	workflowStaticData: WalletStaticData,
): Promise<INodeExecutionData[]> {
	const responseData: INodeExecutionData[] = [];

	const walletResource = context.getNodeParameter('walletLocator', 0) as any;
	const chainType = context.getNodeParameter('balanceWalletChainType', 0) as string;

	const walletLocator = buildWalletLocator(walletResource, chainType, context, 0);
	const endpoint = `wallets/${walletLocator}/activity?chain=${encodeURIComponent(chainType)}`;

	const activityResponse = await api.get(endpoint, 'unstable');

	// Initialize transaction hash set if not exists
	if (!workflowStaticData.lastTransactionHashes) {
		workflowStaticData.lastTransactionHashes = new Set<string>();
	}

	const currentTransactionHashes = new Set<string>();

	// Process activity data - API returns an object with 'events' array
	const activities = (activityResponse as IDataObject).events;

	if (Array.isArray(activities)) {
		for (const transaction of activities) {
			if (transaction && typeof transaction === 'object') {
				const txData = transaction as IDataObject;
				const txHash = String(txData.transaction_hash || '');

				if (txHash) {
					currentTransactionHashes.add(txHash);

					// In manual mode, always return at least 1 result for testing
					if (context.getMode() === 'manual') {
						responseData.push({
							json: {
								wallet: walletLocator,
								transactionHash: txHash,
								isNew: !workflowStaticData.lastTransactionHashes.has(txHash),
								timestamp: new Date().toISOString(),
								...txData,
							},
						});
						// In manual mode, only return first result
						break;
					}

					// In automatic mode, only add if transaction is new
					if (!workflowStaticData.lastTransactionHashes.has(txHash)) {
						responseData.push({
							json: {
								wallet: walletLocator,
								transactionHash: txHash,
								isNew: true,
								timestamp: new Date().toISOString(),
								...txData,
							},
						});
					}
				}
			}
		}
	}

	// Update stored transaction hashes add new hashes to the existing set
	currentTransactionHashes.forEach((hash) => {      
		workflowStaticData.lastTransactionHashes!.add(hash);
	});

	return responseData;
}

export class CrossmintWalletsTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Crossmint Wallets Trigger',
		name: 'crossmintWalletsTrigger',
		icon: 'file:crossmint-wallet.svg',
		group: ['trigger'],
		version: 1,
		description: 'Triggers when wallet balance or transaction changes are detected',
		subtitle: '={{"Crossmint Wallets Trigger"}}',
		defaults: {
			name: 'Crossmint Wallets Trigger',
		},
		inputs: [],
		outputs: [NodeConnectionType.Main],
		credentials: [
			{
				name: 'crossmintApi',
				required: true,
			},
		],
		requestDefaults: {
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
		},
		polling: true,
        hints: [
			{
				type: 'info',
				message:
					'Multiple items will be returned if multiple messages are received within the polling interval. Make sure your workflow can handle multiple items.',
				whenToDisplay: 'beforeExecution',
				location: 'outputPane',
			},
		],
		properties: [
			{
				displayName: 'Trigger On',
				name: 'updates',
				type: 'multiOptions',
				options: [
                    {
						name: '*',
						value: '*',
						description: 'All updates',
					},
					{
						name: 'Wallet Balance Change',
						value: 'walletBalance',
						description: 'Trigger when wallet balance changes',
					},
					{
						name: 'Wallet Transactions Change',
						value: 'walletTransactions',
						description: 'Trigger when wallet transactions occur',
					},
				],
				required: true,
				default: ['walletBalance'],
			},
			{
				displayName: 'Wallet',
				name: 'walletLocator',
				type: 'resourceLocator',
				default: { mode: 'address', value: '' },
				description: 'Select the wallet to monitor',
				displayOptions: { show: { updates: ['walletBalance', '*', 'walletTransactions'] } },
				modes: [
					{
						displayName: 'Address',
						name: 'address',
						type: 'string',
						hint: 'Enter wallet address',
						placeholder: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
						validation: [
							{
								type: 'regex',
								properties: {
									regex: '^[1-9A-HJ-NP-Za-km-z]{32,44}$',
									errorMessage: 'Please enter a valid Solana wallet address',
								},
							},
						],
					},
					{
						displayName: 'Email',
						name: 'email',
						type: 'string',
						hint: 'Enter email address',
						placeholder: 'user@example.com',
						validation: [
							{
								type: 'regex',
								properties: {
									regex: '^[^@]+@[^@]+\\.[^@]+$',
									errorMessage: 'Please enter a valid email address',
								},
							},
						],
					},
					{
						displayName: 'User ID',
						name: 'userId',
						type: 'string',
						hint: 'Enter user ID',
						placeholder: 'user-123',
					},
					{
						displayName: 'Phone',
						name: 'phoneNumber',
						type: 'string',
						hint: 'Enter phone number with country code',
						placeholder: '+1234567890',
						validation: [
							{
								type: 'regex',
								properties: {
									regex: '^\\+[1-9]\\d{1,14}$',
									errorMessage: 'Please enter a valid phone number with country code',
								},
							},
						],
					},
					{
						displayName: 'Twitter',
						name: 'twitter',
						type: 'string',
						hint: 'Enter Twitter handle (without @)',
						placeholder: 'username',
					},
					{
						displayName: 'X',
						name: 'x',
						type: 'string',
						hint: 'Enter X handle (without @)',
						placeholder: 'username',
					},
				],
			},
			{
				displayName: 'Chain Type',
				name: 'balanceWalletChainType',
				type: 'options',
				displayOptions: { show: { updates: ['walletBalance', '*', 'walletTransactions'] } },
				options: [
					{ name: 'Solana', value: 'solana', description: 'Solana blockchain' },
				],
				default: 'solana',
				description: 'Blockchain type for the wallet locator (only needed for email, userId, phoneNumber, twitter, x modes)',
			},
			{
				displayName: 'Chains',
				name: 'chains',
				type: 'string',
				displayOptions: { show: { updates: ['walletBalance', '*'] } },
				default: 'solana',
				placeholder: 'solana or solana-devnet',
				description: 'Comma-separated list of blockchain chains to query',
				required: true,
			},
			{
				displayName: 'Tokens',
				name: 'tkn',
				type: 'string',
				displayOptions: { show: { updates: ['walletBalance', '*'] } },
				default: 'sol,usdc',
				placeholder: 'sol,usdc,usdt',
				description: 'Comma-separated list of tokens to query',
				required: true,
			},
		],
	};

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		const workflowStaticData = this.getWorkflowStaticData('node') as WalletStaticData;
		const node = this.getNode();

		const updates = this.getNodeParameter('updates', 0) as string[];
		const shouldMonitorBalance = updates.includes('walletBalance') || updates.includes('*');
		const shouldMonitorTransactions = updates.includes('walletTransactions') || updates.includes('*');

		if (!shouldMonitorBalance && !shouldMonitorTransactions) {
			return null;
		}

		// Initialize static data
		if (!workflowStaticData.lastBalances) {
			workflowStaticData.lastBalances = {};
		}
		if (!workflowStaticData.lastTransactionHashes) {
			workflowStaticData.lastTransactionHashes = new Set<string>();
		}

		const now = Date.now();
		let responseData: INodeExecutionData[] = [];

		try {
			const credentials = await this.getCredentials<CrossmintCredentials>('crossmintApi');
			const api = new CrossmintApi(this as any, credentials);

			// Route to appropriate polling method based on trigger type
			if (shouldMonitorBalance) {
				const balanceData = await pollBalanceChanges(this, api, workflowStaticData);
				responseData.push(...balanceData);
			}

			if (shouldMonitorTransactions) {
				const transactionData = await pollTransactionChanges(this, api, workflowStaticData);
				responseData.push(...transactionData);
			}

		} catch (error: unknown) {
			if (this.getMode() === 'manual' || !workflowStaticData.lastTimeChecked) {
				throw new NodeApiError(this.getNode(), error as object & { message?: string });
			}

			const workflow = this.getWorkflow();
			this.logger.error(
				`Error in '${node.name}' node in workflow '${workflow.id}': ${(error as Error).message}`,
				{
					node: node.name,
					workflowId: workflow.id,
					error,
				},
			);
		}

		// If no data, update timestamp and return null
		if (!responseData.length) {
			workflowStaticData.lastTimeChecked = now;
			return null;
		}

		// Update timestamp
		workflowStaticData.lastTimeChecked = now;

		if (Array.isArray(responseData) && responseData.length) {
			return [responseData];
		}

		return null;
	}
}