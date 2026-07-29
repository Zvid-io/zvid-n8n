import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class ZvidApi implements ICredentialType {
	name = 'zvidApi';

	displayName = 'Zvid API';

	icon = {
		light: 'file:../nodes/Zvid/zvid.light.svg',
		dark: 'file:../nodes/Zvid/zvid.svg',
	} as const;

	documentationUrl = 'https://docs.zvid.io';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description:
				'Zvid API key (zvid_…), created at https://app.zvid.io/api-keys',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://api.zvid.io',
			description: 'Zvid API base URL. Only change this for self-hosted or local instances.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'X-Api-Key': '={{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/api/credits/balance',
			method: 'GET',
		},
	};
}
