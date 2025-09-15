import { IExecuteFunctions, IHttpRequestOptions, NodeApiError } from 'n8n-workflow';
import { API_ENDPOINTS, API_VERSIONS } from '../utils/constants';
import { CrossmintCredentials, ApiRequestOptions } from './types';

export class CrossmintApi {
	private context: IExecuteFunctions;
	private credentials: CrossmintCredentials;
	private baseUrl: string;

	constructor(context: IExecuteFunctions, credentials: CrossmintCredentials) {
		this.context = context;
		this.credentials = credentials;
		this.baseUrl = credentials.environment === 'Production' 
			? API_ENDPOINTS.PRODUCTION 
			: API_ENDPOINTS.STAGING;
	}

	async request(options: ApiRequestOptions): Promise<any> {
		const { endpoint, version, headers = {}, ...requestOptions } = options;
		
		const url = version 
			? `${this.baseUrl}/${version}/${endpoint}`
			: `${this.baseUrl}/${endpoint}`;

		const requestHeaders = {
			'X-API-KEY': this.credentials.apiKey,
			'Content-Type': 'application/json',
			...headers,
		};

		const httpOptions: IHttpRequestOptions = {
			...requestOptions,
			url,
			headers: requestHeaders,
			json: true,
		};

		try {
			return await this.context.helpers.httpRequest(httpOptions);
		} catch (error: any) {
			throw new NodeApiError(this.context.getNode(), error);
		}
	}

	async get(endpoint: string, version?: string, headers?: Record<string, string>): Promise<any> {
		return this.request({
			method: 'GET',
			endpoint,
			version,
			headers,
		});
	}

	async post(endpoint: string, body: any, version?: string, headers?: Record<string, string>): Promise<any> {
		return this.request({
			method: 'POST',
			endpoint,
			body,
			version,
			headers,
		});
	}

	getBaseUrl(): string {
		return this.baseUrl;
	}

	getCredentials(): CrossmintCredentials {
		return this.credentials;
	}
}
