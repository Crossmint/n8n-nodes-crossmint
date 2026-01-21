import { INodeProperties } from 'n8n-workflow';

/**
 * Owner Type Properties
 *
 * Reusable property builders for wallet owner identification fields.
 * Used in wallet creation operations to specify who owns the wallet.
 */

/**
 * Creates the owner type selector and all conditional owner input fields.
 * This returns an array of properties that work together to capture owner information.
 *
 * @param operation - The operation this applies to
 * @param required - Whether owner specification is required (default: false for "Optional")
 * @returns Array of INodeProperties for owner type selection and inputs
 */
export function createOwnerTypeFields(operation: string, required: boolean = false): INodeProperties[] {
	return [
		{
			displayName: required ? 'Owner Type' : 'Owner Type (Optional)',
			name: 'ownerType',
			type: 'options',
			displayOptions: { show: { resource: ['wallet'], operation: [operation] } },
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
			displayOptions: {
				show: {
					resource: ['wallet'],
					operation: [operation],
					ownerType: ['email'],
				},
			},
			default: '',
			placeholder: 'user@example.com',
			description: 'Email address of the wallet owner',
			required: true,
		},
		{
			displayName: 'Owner User ID',
			name: 'ownerUserId',
			type: 'string',
			displayOptions: {
				show: {
					resource: ['wallet'],
					operation: [operation],
					ownerType: ['userId'],
				},
			},
			default: '',
			placeholder: 'user-123',
			description: 'User ID of the wallet owner',
			required: true,
		},
		{
			displayName: 'Owner Phone Number',
			name: 'ownerPhoneNumber',
			type: 'string',
			displayOptions: {
				show: {
					resource: ['wallet'],
					operation: [operation],
					ownerType: ['phoneNumber'],
				},
			},
			default: '',
			placeholder: '+1234567890',
			description: 'Phone number of the wallet owner (with country code)',
			required: true,
		},
		{
			displayName: 'Owner Twitter Handle',
			name: 'ownerTwitterHandle',
			type: 'string',
			displayOptions: {
				show: {
					resource: ['wallet'],
					operation: [operation],
					ownerType: ['twitter'],
				},
			},
			default: '',
			placeholder: 'username',
			description: 'Twitter handle of the wallet owner (without @)',
			required: true,
		},
		{
			displayName: 'Owner X Handle',
			name: 'ownerXHandle',
			type: 'string',
			displayOptions: {
				show: {
					resource: ['wallet'],
					operation: [operation],
					ownerType: ['x'],
				},
			},
			default: '',
			placeholder: 'username',
			description: 'X handle of the wallet owner (without @)',
			required: true,
		},
	] as INodeProperties[];
}
