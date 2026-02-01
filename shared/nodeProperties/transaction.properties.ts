import { INodeProperties } from 'n8n-workflow';
import { ChainFactory } from '../chains/ChainFactory';

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
 * @returns Array of INodeProperties for transaction signing
 */
export function createTransactionSigningFields(operation: string): INodeProperties[] {
	// Get chain type options
	const chainOptions = ChainFactory.getChainOptions();

	return [
		{
			displayName: 'Blockchain Type',
			name: 'signSubmitChainType',
			type: 'options',
			displayOptions: { show: { resource: ['wallet'], operation: [operation] } },
			options: chainOptions,
			default: chainOptions[0]?.value || 'solana',
			description: 'Blockchain type for transaction signing',
			required: true,
		},
		// Solana network selector - shown when signSubmitChainType is 'solana'
		{
			displayName: 'Network',
			name: 'signSubmitChainSolana',
			type: 'options',
			displayOptions: {
				show: {
					resource: ['wallet'],
					operation: [operation],
					signSubmitChainType: ['solana'],
				},
			},
			typeOptions: {
				loadOptionsMethod: 'getSolanaNetworkOptions',
			},
			default: '',
			description: 'Solana network (filtered by credential environment)',
			required: true,
		},
		// EVM network selector - shown when signSubmitChainType is 'evm'
		{
			displayName: 'Network',
			name: 'signSubmitChainEvm',
			type: 'options',
			displayOptions: {
				show: {
					resource: ['wallet'],
					operation: [operation],
					signSubmitChainType: ['evm'],
				},
			},
			typeOptions: {
				loadOptionsMethod: 'getEvmNetworkOptions',
			},
			default: '',
			description: 'EVM network (filtered by credential environment)',
			required: true,
		},
		{
			displayName: 'Origin Wallet Address',
			name: 'signSubmitWalletAddress',
			type: 'string',
			displayOptions: { show: { resource: ['wallet'], operation: [operation] } },
			default: '',
			placeholder: 'Enter wallet address',
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
			placeholder: 'Enter signer address',
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
			placeholder: 'Enter private key',
			description: 'Private key to sign with (format depends on selected chain)',
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
