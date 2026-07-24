import type { IExecuteFunctions, ILoadOptionsFunctions, INodeExecutionData, INodePropertyOptions, INodeType, INodeTypeDescription, ISupplyDataFunctions, SupplyData } from 'n8n-workflow';
type ZvidProfile = 'readonly' | 'creator' | 'automation' | 'developer';
type ToolFilterMode = 'all' | 'selected' | 'except';
interface McpToolDefinition {
    name: string;
    description?: string;
    inputSchema: Record<string, unknown>;
}
export declare function buildProfileEndpoint(endpointUrl: string, profile: ZvidProfile, maxRenderCredits?: number): URL;
export declare function filterTools(tools: McpToolDefinition[], mode: ToolFilterMode, includeTools: string[], excludeTools: string[]): McpToolDefinition[];
export declare function originalChatInput(item: INodeExecutionData, workflowDataProxy?: Record<string, unknown>): string | undefined;
export declare function recoverSafeToolArguments(tool: string, args: Record<string, unknown>, chatInput?: string): Record<string, unknown>;
export declare function missingRequiredToolArguments(inputSchema: Record<string, unknown>, args: Record<string, unknown>): string[];
export declare function loadZvidTools(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]>;
export declare class ZvidAgentTools implements INodeType {
    description: INodeTypeDescription;
    methods: {
        loadOptions: {
            getTools: typeof loadZvidTools;
        };
    };
    supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData>;
    execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]>;
}
export {};
