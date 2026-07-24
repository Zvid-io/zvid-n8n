"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZvidApi = void 0;
class ZvidApi {
    constructor() {
        this.name = 'zvidApi';
        this.displayName = 'Zvid API';
        this.documentationUrl = 'https://zvid.io/docs';
        this.properties = [
            {
                displayName: 'API Key',
                name: 'apiKey',
                type: 'string',
                typeOptions: { password: true },
                default: '',
                description: 'Zvid API key (zvid_…), created in the Zvid dashboard under Settings → API Keys',
            },
            {
                displayName: 'Base URL',
                name: 'baseUrl',
                type: 'string',
                default: 'https://api.zvid.io',
                description: 'Zvid API base URL. Only change this for self-hosted or local instances.',
            },
        ];
        this.authenticate = {
            type: 'generic',
            properties: {
                headers: {
                    'X-Api-Key': '={{$credentials.apiKey}}',
                },
            },
        };
        this.test = {
            request: {
                baseURL: '={{$credentials.baseUrl}}',
                url: '/api/credits/balance',
                method: 'GET',
            },
        };
    }
}
exports.ZvidApi = ZvidApi;
//# sourceMappingURL=ZvidApi.credentials.js.map