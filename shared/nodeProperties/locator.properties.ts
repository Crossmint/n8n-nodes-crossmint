import { INodeProperties } from 'n8n-workflow';
import { ChainFactory } from '../chains/ChainFactory';

/**
 * Validation patterns for non-address locator types
 */
export const LOCATOR_VALIDATION = {
	email: {
		regex: '^[^@]+@[^@]+\\.[^@]+$',
		errorMessage: 'Please enter a valid email address',
	},
	phoneNumber: {
		regex: '^\\+[1-9]\\d{1,14}$',
		errorMessage: 'Please enter a valid phone number with country code',
	},
};

/**
 * Creates a resource locator property for wallet selection.
 * This eliminates the duplication of wallet locator definitions across the node.
 * Uses ChainFactory to dynamically get validation rules for the specified chain.
 *
 * @param name - The parameter name (e.g., 'walletLocator', 'originWallet', 'recipientWallet')
 * @param operation - The operation this locator is used for
 * @param description - Optional custom description
 * @param chainType - The blockchain type for validation (default: 'solana')
 * @returns INodeProperties configuration for a wallet resource locator
 */
export function createWalletLocatorProperty(
	name: string,
	operation: string,
	description: string = 'Select the wallet',
	chainType: string = 'solana',
): INodeProperties {
	// Get chain provider for validation rules
	const provider = ChainFactory.createProvider(chainType);

	if (!provider) {
		// Fallback to basic validation if chain provider not found
		console.warn(`Chain type '${chainType}' is not supported. Using basic address validation.`);
		return {
			displayName: 'Wallet',
			name,
			type: 'resourceLocator',
			default: { mode: 'address', value: '' },
			description,
			displayOptions: { show: { resource: ['wallet'], operation: [operation] } },
			modes: [
				{
					displayName: 'Address',
					name: 'address',
					type: 'string',
					hint: 'Enter wallet address',
					placeholder: 'Enter wallet address',
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
								regex: LOCATOR_VALIDATION.email.regex,
								errorMessage: LOCATOR_VALIDATION.email.errorMessage,
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
								regex: LOCATOR_VALIDATION.phoneNumber.regex,
								errorMessage: LOCATOR_VALIDATION.phoneNumber.errorMessage,
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
		} as INodeProperties;
	}

	return {
		displayName: 'Wallet',
		name,
		type: 'resourceLocator',
		default: { mode: 'address', value: '' },
		description,
		displayOptions: { show: { resource: ['wallet'], operation: [operation] } },
		modes: [
			{
				displayName: 'Address',
				name: 'address',
				type: 'string',
				hint: 'Enter wallet address',
				placeholder: provider.getExampleAddress(),
				validation: [
					{
						type: 'regex',
						properties: {
							regex: provider.getAddressValidationRegex(),
							errorMessage: provider.getAddressValidationError(),
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
							regex: LOCATOR_VALIDATION.email.regex,
							errorMessage: LOCATOR_VALIDATION.email.errorMessage,
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
							regex: LOCATOR_VALIDATION.phoneNumber.regex,
							errorMessage: LOCATOR_VALIDATION.phoneNumber.errorMessage,
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
	} as INodeProperties;
}

/**
 * Creates a chain type selector property for wallet locators.
 * Used when the locator mode requires a chain specification (email, userId, phone, twitter, x).
 * Dynamically populates options from ChainFactory.
 *
 * @param name - The parameter name
 * @param operation - The operation this is used for
 * @param description - Optional custom description
 * @returns INodeProperties configuration for chain type selection
 */
export function createChainTypeSelectorProperty(
	name: string,
	operation: string,
	description: string = 'Blockchain type for the wallet locator (only needed for email, userId, phoneNumber, twitter, x modes)',
): INodeProperties {
	// Get chain options dynamically from registry
	const options = ChainFactory.getChainOptions();

	return {
		displayName: 'Chain Type',
		name,
		type: 'options',
		displayOptions: { show: { resource: ['wallet'], operation: [operation] } },
		options,
		default: options.length > 0 ? options[0].value : 'solana',
		description,
	} as INodeProperties;
}
