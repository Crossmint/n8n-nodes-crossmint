import { INodeProperties } from 'n8n-workflow';
import { ChainRegistry } from '../chains/ChainRegistry';

/**
 * Transaction Signing Properties
 *
 * Reusable property builders for transaction signing operations.
 * Used in signTransaction and similar operations.
 */

/**
 * Creates all transaction signing fields.
 * Returns an array of properties needed to sign and submit a transaction.
 *
 * @param operation - The operation this applies to
 * @param chainType - The blockchain type (default: 'solana')
 * @returns Array of INodeProperties for transaction signing
 */
export function createTransactionSigningFields(operation: string, chainType: string = 'solana'): INodeProperties[] {
	const provider = ChainRegistry.getProvider(chainType);
	const networks = provider?.getNetworks() || [];

	return [
		{
			displayName: 'Chain',
			name: 'signSubmitChain',
			type: 'options',
			displayOptions: { show: { resource: ['wallet'], operation: [operation] } },
			options: networks.length > 0
				? networks.map(n => ({
					name: n.name,
					value: n.id,
					description: n.isTestnet ? 'Testnet' : 'Mainnet',
				}))
				: [{ name: 'Solana', value: 'solana', description: 'Solana blockchain' }],
			default: networks[0]?.id || 'solana',
			description: 'Blockchain network for transaction signing',
			required: true,
		},
		{
			displayName: 'Origin Wallet Address',
			name: 'signSubmitWalletAddress',
			type: 'string',
			displayOptions: { show: { resource: ['wallet'], operation: [operation] } },
			default: '',
			placeholder: provider?.getExampleAddress() || '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
			description: 'Wallet address for the API endpoint (from Create Transfer response)',
			required: true,
		},
		{
			displayName: 'Transaction ID',
			name: 'signSubmitTransactionId',
			type: 'string',
			displayOptions: { show: { resource: ['wallet'], operation: [operation] } },
			default: '',
			placeholder: '782ffd15-4946-4e0d-8e21-023134b3d243',
			description: 'The transaction ID that needs approval (from Create Transfer response)',
			required: true,
		},
		{
			displayName: 'Transaction Data',
			name: 'signSubmitTransactionData',
			type: 'string',
			displayOptions: { show: { resource: ['wallet'], operation: [operation] } },
			default: '',
			placeholder: 'Hash or message to sign from Create Transfer response',
			description: 'Transaction message/hash to sign (from Create Transfer approvals.pending[0].message)',
			required: true,
		},
		{
			displayName: 'Signer Address',
			name: 'signSubmitSignerAddress',
			type: 'string',
			displayOptions: { show: { resource: ['wallet'], operation: [operation] } },
			default: '',
			placeholder: provider?.getExampleAddress() || '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
			description: 'Address of the external signer (from Create Transfer response)',
			required: true,
		},
		{
			displayName: 'Signer Private Key',
			name: 'signSubmitPrivateKey',
			type: 'string',
			typeOptions: { password: true },
			displayOptions: { show: { resource: ['wallet'], operation: [operation] } },
			default: '',
			placeholder: chainType === 'solana' ? 'base58 encoded private key' : 'private key',
			description: `Private key to sign with${chainType === 'solana' ? ' (base58 for Solana)' : ''}`,
			required: true,
		},
		{
			displayName: 'Wait Until Transaction Is Completed',
			name: 'waitForCompletion',
			type: 'boolean',
			displayOptions: { show: { resource: ['wallet'], operation: [operation] } },
			default: false,
			description: 'Whether to wait until the transaction reaches final status (success or failed) before completing the node execution',
		},
	] as INodeProperties[];
}
