import { IExecuteFunctions, IHttpRequestOptions, NodeApiError, IDataObject } from 'n8n-workflow';
import { API_ENDPOINTS } from '../utils/constants';
import { CrossmintCredentials, ApiRequestOptions, ApiResponse } from './types';

export class CrossmintApi {
	private context: IExecuteFunctions;
	private credentials: CrossmintCredentials;
	private baseUrl: string;

	constructor(context: IExecuteFunctions, credentials: CrossmintCredentials) {
		this.context = context;
		this.credentials = credentials;
		this.baseUrl = credentials.environment === 'production'
			? API_ENDPOINTS.PRODUCTION
			: API_ENDPOINTS.STAGING;
	}

	async request(options: ApiRequestOptions): Promise<ApiResponse> {
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
		} catch (error: unknown) {
			throw new NodeApiError(this.context.getNode(), error as object & { message?: string });
		}
	}

	async get(endpoint: string, version?: string, headers?: Record<string, string>): Promise<ApiResponse> {
		return this.request({
			method: 'GET',
			endpoint,
			version,
			headers,
		});
	}

	async post(endpoint: string, body: IDataObject, version?: string, headers?: Record<string, string>): Promise<ApiResponse> {
		return this.request({
			method: 'POST',
			endpoint,
			body,
			version,
			headers,
		});
	}

	async delete(endpoint: string, version?: string, headers?: Record<string, string>): Promise<ApiResponse> {
		return this.request({
			method: 'DELETE',
			endpoint,
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
