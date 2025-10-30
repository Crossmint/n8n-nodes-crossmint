import { IAdditionalCredentialOptions } from 'n8n-workflow';

export const oneshotApiBaseUrl = 'https://api.1shotapi.com/v0';
export const additionalCredentialOptions: IAdditionalCredentialOptions = {
	oauth2: {
		tokenType: 'Bearer',
		keepBearer: true,
		includeCredentialsOnRefreshOnBody: true,
		property: 'access_token',
		tokenExpiredStatusCode: 401,
	},
};
