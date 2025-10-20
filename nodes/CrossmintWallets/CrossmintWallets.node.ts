import {
	IDataObject,
	IExecuteFunctions,
	INodeType,
	INodeTypeDescription,
	INodeExecutionData,
	INodeProperties,
	NodeOperationError,
	NodeConnectionTypes,
} from 'n8n-workflow';
import { CrossmintApi } from '../../shared/transport/CrossmintApi';
import { CrossmintCredentials } from '../../shared/transport/types';
import { createWallet } from '../../shared/actions/wallet/createWallet.operation';
import { getWallet } from '../../shared/actions/wallet/getWallet.operation';
import { getBalance } from '../../shared/actions/wallet/getBalance.operation';
import { transferToken } from '../../shared/actions/wallet/transferToken.operation';
import { signTransaction } from '../../shared/actions/wallet/signTransaction.operation';

export class CrossmintWallets implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Crossmint Wallets',
		name: 'crossmintWallets',
		icon: 'file:crossmint-wallet.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Interact with Crossmint Wallet APIs',
		defaults: {
			name: 'Crossmint Wallets',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
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
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Wallet',
						value: 'wallet',
						description: 'Crossmint wallet operations',
					},
				],
				default: 'wallet',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['wallet'],
					},
				},
				options: [
					{
						name: 'Create Transfer',
						value: 'createTransfer',
						description: 'Create Transfer from Crossmint wallet to any address',
						action: 'Create transfer',
					},
					{
						name: 'Get Balance',
						value: 'getBalance',
						description: 'Get balance of any wallet',
						action: 'Get balance',
					},
					{
						name: 'Get or Create Wallet',
						value: 'getOrCreateWallet',
						description: 'Get or Create Crossmint wallet for company or user',
						action: 'Get or create wallet',
					},
					{
						name: 'Get Wallet',
						value: 'getWallet',
						description: 'Retrieve a wallet by its locator',
						action: 'Get wallet',
					},
					{
						name: 'Sign Transaction',
						value: 'signTransaction',
						description: 'Sign transaction with private key and submit signature in one step',
						action: 'Sign transaction',
					},
				],
				default: 'getOrCreateWallet',
			},

			// ---- Get or Create Wallet fields
			{
				displayName: 'Chain Type',
				name: 'chainType',
				type: 'options',
				displayOptions: { show: { resource: ['wallet'], operation: ['getOrCreateWallet'] } },
				options: [
					{ name: 'Solana', value: 'solana', description: 'Solana blockchain' },
				],
				default: 'solana',
				description: 'Blockchain type',
			},
			{
				displayName: 'Owner Type (Optional)',
				name: 'ownerType',
				type: 'options',
				displayOptions: { show: { resource: ['wallet'], operation: ['getOrCreateWallet'] } },
				options: [
					{ name: 'Email', value: 'email', description: 'Use email address as owner' },
					{ name: 'None', value: 'none', description: 'No owner specified' },
					{ name: 'Phone Number', value: 'phoneNumber', description: 'Use phone number as owner' },
					{ name: 'Twitter Handle', value: 'twitter', description: 'Use Twitter handle as owner' },
					{ name: 'User ID', value: 'userId', description: 'Use user ID as owner' },
					{ name: 'X Handle', value: 'x', description: 'Use X handle as owner' },
				],
				default: 'none',
				description: 'Type of user locator to identify the wallet owner',
			},
			{
				displayName: 'Owner Email',
				name: 'ownerEmail',
				type: 'string',
				displayOptions: { show: { resource: ['wallet'], operation: ['getOrCreateWallet'], ownerType: ['email'] } },
				default: '',
				placeholder: 'user@example.com',
				description: 'Email address of the wallet owner',
				required: true,
			},
			{
				displayName: 'Owner User ID',
				name: 'ownerUserId',
				type: 'string',
				displayOptions: { show: { resource: ['wallet'], operation: ['getOrCreateWallet'], ownerType: ['userId'] } },
				default: '',
				placeholder: 'user-123',
				description: 'User ID of the wallet owner',
				required: true,
			},
			{
				displayName: 'Owner Phone Number',
				name: 'ownerPhoneNumber',
				type: 'string',
				displayOptions: { show: { resource: ['wallet'], operation: ['getOrCreateWallet'], ownerType: ['phoneNumber'] } },
				default: '',
				placeholder: '+1234567890',
				description: 'Phone number of the wallet owner (with country code)',
				required: true,
			},
			{
				displayName: 'Owner Twitter Handle',
				name: 'ownerTwitterHandle',
				type: 'string',
				displayOptions: { show: { resource: ['wallet'], operation: ['getOrCreateWallet'], ownerType: ['twitter'] } },
				default: '',
				placeholder: 'username',
				description: 'Twitter handle of the wallet owner (without @)',
				required: true,
			},
			{
				displayName: 'Owner X Handle',
				name: 'ownerXHandle',
				type: 'string',
				displayOptions: { show: { resource: ['wallet'], operation: ['getOrCreateWallet'], ownerType: ['x'] } },
				default: '',
				placeholder: 'username',
				description: 'X handle of the wallet owner (without @)',
				required: true,
			},
			{
				displayName: 'Admin Signer',
				name: 'externalSignerDetails',
				type: 'string',
				typeOptions: { password: true },
				displayOptions: { show: { resource: ['wallet'], operation: ['getOrCreateWallet'] } },
				default: '',
				placeholder: 'Enter private key (base58 for Solana)',
				description: 'Private key that authorizes all transactions from this wallet. Use this link to generate them: https://www.val.town/x/Crossmint/crypto-address-generator.',
				required: true,
			},

			// ---- Get Wallet fields
			{
				displayName: 'Wallet',
				name: 'getWalletLocator',
				type: 'resourceLocator',
				default: { mode: 'address', value: '' },
				description: 'Select the wallet to retrieve',
				displayOptions: { show: { resource: ['wallet'], operation: ['getWallet'] } },
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
				name: 'getWalletChainType',
				type: 'options',
				displayOptions: { show: { resource: ['wallet'], operation: ['getWallet'] } },
				options: [
					{ name: 'Solana', value: 'solana', description: 'Solana blockchain' },
				],
				default: 'solana',
				description: 'Blockchain type for the wallet locator (only needed for email, userId, phoneNumber, twitter, x modes)',
			},

			// ---- Create Transfer fields
			{
				displayName: 'Blockchain Type',
				name: 'blockchainType',
				type: 'options',
				displayOptions: { show: { resource: ['wallet'], operation: ['createTransfer'] } },
				options: [
					{ name: 'Solana', value: 'solana', description: 'Solana blockchain' },
				],
				default: 'solana',
				description: 'Blockchain type for both origin and recipient wallets',
				required: true,
			},
			{
				displayName: 'Origin Wallet',
				name: 'originWallet',
				type: 'resourceLocator',
				default: { mode: 'address', value: '' },
				description: 'Select the origin wallet for the transfer',
				displayOptions: { show: { resource: ['wallet'], operation: ['createTransfer'] } },
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
				displayName: 'Recipient Wallet',
				name: 'recipientWallet',
				type: 'resourceLocator',
				default: { mode: 'address', value: '' },
				description: 'Select the recipient wallet for the transfer',
				displayOptions: { show: { resource: ['wallet'], operation: ['createTransfer'] } },
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
				displayName: 'Chain',
				name: 'tknChain',
				type: 'string',
				displayOptions: { show: { resource: ['wallet'], operation: ['createTransfer'] } },
				default: '',
				placeholder: 'solana or solana-devnet',
				description: 'Blockchain network for the token',
				required: true,
			},
			{
				displayName: 'Token Name (Locator ID)',
				name: 'tknName',
				type: 'string',
				displayOptions: { show: { resource: ['wallet'], operation: ['createTransfer'] } },
				default: '',
				placeholder: 'sol or usdc',
				description: 'Token symbol or name',
				required: true,
			},
			{
				displayName: 'Amount',
				name: 'amount',
				type: 'string',
				displayOptions: { show: { resource: ['wallet'], operation: ['createTransfer'] } },
				default: '',
				placeholder: '10.50',
				description: 'Amount of tokens to send (decimal format)',
				required: true,
			},

			// ---- Get balance fields
			{
				displayName: 'Wallet',
				name: 'walletLocator',
				type: 'resourceLocator',
				default: { mode: 'address', value: '' },
				description: 'Select the wallet to get balance for',
				displayOptions: { show: { resource: ['wallet'], operation: ['getBalance'] } },
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
				displayOptions: { show: { resource: ['wallet'], operation: ['getBalance'] } },
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
				displayOptions: { show: { resource: ['wallet'], operation: ['getBalance'] } },
				default: 'solana',
				placeholder: 'solana or solana-devnet',
				description: 'Comma-separated list of blockchain chains to query',
				required: true,
			},
			{
				displayName: 'Tokens',
				name: 'tkn',
				type: 'string',
				displayOptions: { show: { resource: ['wallet'], operation: ['getBalance'] } },
				default: 'sol,usdc',
				placeholder: 'sol,usdc,usdt',
				description: 'Comma-separated list of tokens to query',
				required: true,
			},
			// Sign Transaction fields
			{
				displayName: 'Chain',
				name: 'signSubmitChain',
				type: 'options',
				displayOptions: { show: { resource: ['wallet'], operation: ['signTransaction'] } },
				options: [
					{ name: 'Solana', value: 'solana', description: 'Solana blockchain' },
				],
				default: 'solana',
				description: 'Blockchain network for transaction signing',
				required: true,
			},
			{
				displayName: 'Origin Wallet Address',
				name: 'signSubmitWalletAddress',
				type: 'string',
				displayOptions: { show: { resource: ['wallet'], operation: ['signTransaction'] } },
				default: '',
				placeholder: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
				description: 'Wallet address for the API endpoint (from Create Transfer response)',
				required: true,
			},
			{
				displayName: 'Transaction ID',
				name: 'signSubmitTransactionId',
				type: 'string',
				displayOptions: { show: { resource: ['wallet'], operation: ['signTransaction'] } },
				default: '',
				placeholder: '782ffd15-4946-4e0d-8e21-023134b3d243',
				description: 'The transaction ID that needs approval (from Create Transfer response)',
				required: true,
			},
			{
				displayName: 'Transaction Data',
				name: 'signSubmitTransactionData',
				type: 'string',
				displayOptions: { show: { resource: ['wallet'], operation: ['signTransaction'] } },
				default: '',
				placeholder: 'Hash or message to sign from Create Transfer response',
				description: 'Transaction message/hash to sign (from Create Transfer approvals.pending[0].message)',
				required: true,
			},
			{
				displayName: 'Signer Address',
				name: 'signSubmitSignerAddress',
				type: 'string',
				displayOptions: { show: { resource: ['wallet'], operation: ['signTransaction'] } },
				default: '',
				placeholder: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
				description: 'Address of the external signer (from Create Transfer response)',
				required: true,
			},
			{
				displayName: 'Signer Private Key',
				name: 'signSubmitPrivateKey',
				type: 'string',
				typeOptions: { password: true },
				displayOptions: { show: { resource: ['wallet'], operation: ['signTransaction'] } },
				default: '',
				placeholder: 'base58 encoded private key',
				description: 'Private key to sign with (base58 for Solana)',
				required: true,
			},
			{
				displayName: 'Wait Until Transaction Is Completed',
				name: 'waitForCompletion',
				type: 'boolean',
				displayOptions: { show: { resource: ['wallet'], operation: ['signTransaction'] } },
				default: false,
				description: 'Whether to wait until the transaction reaches final status (success or failed) before completing the node execution',
			},
		] as INodeProperties[],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const credentials = await this.getCredentials<CrossmintCredentials>('crossmintApi');
		const api = new CrossmintApi(this, credentials);

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const operation = this.getNodeParameter('operation', itemIndex) as string;
				let result: IDataObject;

				switch (operation) {
					case 'getOrCreateWallet':
						result = await createWallet(this, api, itemIndex);
						break;
					case 'getWallet':
						result = await getWallet(this, api, itemIndex);
						break;
					case 'getBalance':
						result = await getBalance(this, api, itemIndex);
						break;
					case 'createTransfer':
						result = await transferToken(this, api, itemIndex);
						break;
					case 'signTransaction':
						result = await signTransaction(this, api, itemIndex);
						break;
					default:
						throw new NodeOperationError(this.getNode(), `Unknown wallet operation: ${operation}`, {
							itemIndex,
						});
				}

				const executionData: INodeExecutionData = {
					json: result,
					pairedItem: { item: itemIndex },
				};

				returnData.push(executionData);
			} catch (error) {
				if (this.continueOnFail()) {
					const executionData: INodeExecutionData = {
						json: { error: error.message },
						pairedItem: { item: itemIndex },
					};
					returnData.push(executionData);
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}
