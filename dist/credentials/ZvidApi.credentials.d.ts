import type { IAuthenticateGeneric, ICredentialTestRequest, ICredentialType, INodeProperties } from 'n8n-workflow';
export declare class ZvidApi implements ICredentialType {
    name: string;
    displayName: string;
    icon: {
        readonly light: "file:../nodes/Zvid/zvid.light.svg";
        readonly dark: "file:../nodes/Zvid/zvid.svg";
    };
    documentationUrl: string;
    properties: INodeProperties[];
    authenticate: IAuthenticateGeneric;
    test: ICredentialTestRequest;
}
