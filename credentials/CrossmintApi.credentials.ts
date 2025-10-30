import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class CrossmintApi implements ICredentialType {
	name = 'crossmintApi';
	displayName = 'Crossmint API';

	documentationUrl = 'https://docs.crossmint.com/';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key (Server-side)',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
		},
		{
			displayName: 'Environment',
			name: 'environment',
			type: 'options',
			options: [
				{
					name: 'Production',
					value: 'production',
				},
				{
					name: 'Staging',
					value: 'staging',
				},
			],
			default: 'staging',
			required: true,
		},
		{
			displayName: 'Coinbase API Key ID',
			name: 'apiKeyId',
			type: 'string',
			default: '',
			required: false,
			description: 'Your Coinbase CDP API Key ID (name)',
		},
		{
			displayName: 'Coinbase API Key Secret',
			name: 'apiKeySecret',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: false,
			description:
				'Your Coinbase CDP API Key private key. Supports Ed25519 (base64-encoded PKCS#8 DER string) or ES256 (PEM string starting with -----BEGIN EC PRIVATE KEY-----)',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'X-API-KEY': '={{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL:
				'={{$credentials.environment === "production" ? "https://www.crossmint.com/api/2022-06-09/collections/" : "https://staging.crossmint.com/api/2022-06-09/collections/"}}',
			url: '/',
			method: 'GET',
			headers: {
				'X-API-KEY': '={{$credentials.apiKey}}',
				accept: 'text/html',
			},
		},
	};
}