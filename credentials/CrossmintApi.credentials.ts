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
