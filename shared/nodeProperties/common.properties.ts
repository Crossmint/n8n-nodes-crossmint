import { INodeProperties } from 'n8n-workflow';

/**
 * Common Properties
 *
 * Reusable property builders for fields shared across multiple nodes.
 * These are node-agnostic and can be used in any Crossmint node.
 */

/**
 * Creates a resource selector property.
 * This is typically the first property in a node.
 *
 * @param resources - Array of resource options
 * @param defaultResource - The default selected resource
 * @returns INodeProperties for resource selection
 */
export function createResourceProperty(
	resources: Array<{ name: string; value: string; description: string }>,
	defaultResource: string = 'wallet',
): INodeProperties {
	return {
		displayName: 'Resource',
		name: 'resource',
		type: 'options',
		noDataExpression: true,
		options: resources,
		default: defaultResource,
	} as INodeProperties;
}

/**
 * Creates an operation selector property.
 * This is typically the second property in a node, shown after resource selection.
 *
 * @param resource - The resource this operation selector belongs to
 * @param operations - Array of operation options
 * @param defaultOperation - The default selected operation
 * @returns INodeProperties for operation selection
 */
export function createOperationProperty(
	resource: string,
	operations: Array<{ name: string; value: string; description: string; action: string }>,
	defaultOperation: string,
): INodeProperties {
	return {
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: [resource],
			},
		},
		options: operations,
		default: defaultOperation,
	} as INodeProperties;
}

/**
 * Wallet operations for the operation selector.
 * Exported as a constant for reuse.
 */
export const WALLET_OPERATIONS = [
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
];
