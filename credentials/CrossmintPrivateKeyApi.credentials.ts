import type {
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class CrossmintPrivateKeyApi implements ICredentialType {
	name = 'crossmintPrivateKeyApi';

	displayName = 'Crossmint Private Key API';

	documentationUrl = 'https://docs.crossmint.com/';

	properties: INodeProperties[] = [
		{
			displayName: 'Private Key',
			name: 'privateKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'Private key for signing transactions (32-byte hex string for EVM, base58 for Solana)',
		},
		{
			displayName: 'Chain Type',
			name: 'chainType',
			type: 'options',
			options: [
				{
					name: 'EVM',
					value: 'evm',
					description: 'Ethereum Virtual Machine compatible chains',
				},
				{
					name: 'Solana',
					value: 'solana',
					description: 'Solana blockchain',
				},
			],
			default: 'evm',
			required: true,
			description: 'Blockchain type for the private key',
		},
	];
}
