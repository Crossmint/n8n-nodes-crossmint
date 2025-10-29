import type {
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class CoinbaseApi implements ICredentialType {
	name = 'coinbaseApi';
	displayName = 'Coinbase CDP API';

	documentationUrl = 'https://docs.cdp.coinbase.com/';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key ID',
			name: 'apiKeyId',
			type: 'string',
			default: '',
			required: true,
			description: 'Your Coinbase CDP API Key ID (name)',
		},
		{
			displayName: 'API Key Secret',
			name: 'apiKeySecret',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'Your Coinbase CDP API Key private key. Supports Ed25519 (base64-encoded PKCS#8 DER string) or ES256 (PEM string starting with -----BEGIN EC PRIVATE KEY-----)',
		},
	];
}

