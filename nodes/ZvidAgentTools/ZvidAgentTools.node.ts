import { DynamicStructuredTool } from '@langchain/core/tools';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { CompatibilityCallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';
import type {
	ICredentialDataDecryptedObject,
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	ISupplyDataFunctions,
	SupplyData,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError, UnexpectedError } from 'n8n-workflow';

type ZvidProfile = 'readonly' | 'creator' | 'automation' | 'developer';
type ToolFilterMode = 'all' | 'selected' | 'except';
type McpContext = ISupplyDataFunctions | ILoadOptionsFunctions | IExecuteFunctions;

interface McpToolDefinition {
	name: string;
	description?: string;
	inputSchema: Record<string, unknown>;
}

const PROFILES = new Set<ZvidProfile>([
	'readonly',
	'creator',
	'automation',
	'developer',
]);
const DEFAULT_MAX_RENDER_CREDITS = 120;
const MAX_CONFIGURABLE_RENDER_CREDITS = 10_000;

function nodeParameter(
	ctx: McpContext,
	name: string,
	fallback?: unknown,
	itemIndex?: number,
): unknown {
	if (itemIndex !== undefined) {
		const getParameter = (ctx as ISupplyDataFunctions).getNodeParameter as unknown as (
			name: string,
			itemIndex: number,
			fallback?: unknown,
		) => unknown;
		return getParameter.call(ctx, name, itemIndex, fallback);
	}
	const getParameter = (ctx as ILoadOptionsFunctions).getNodeParameter as unknown as (
		name: string,
		fallback?: unknown,
	) => unknown;
	return getParameter.call(ctx, name, fallback);
}

function selectedProfile(ctx: McpContext, itemIndex?: number): ZvidProfile {
	const storedValue = String(nodeParameter(ctx, 'profile', 'creator', itemIndex));
	// Old imported workflows may still contain Advanced. It is now Creator.
	const value = (storedValue === 'advanced' ? 'creator' : storedValue) as ZvidProfile;
	if (!PROFILES.has(value)) {
		throw new NodeOperationError(
			ctx.getNode(),
			`Invalid Zvid profile "${storedValue}". Choose a profile from the node dropdown.`,
		);
	}
	return value;
}

function selectedMaxRenderCredits(ctx: McpContext, itemIndex?: number): number {
	const value = Number(
		nodeParameter(ctx, 'maxRenderCredits', DEFAULT_MAX_RENDER_CREDITS, itemIndex),
	);
	if (!Number.isSafeInteger(value) || value < 1 || value > MAX_CONFIGURABLE_RENDER_CREDITS) {
		throw new NodeOperationError(
			ctx.getNode(),
			`Max Render Credits must be an integer from 1 to ${MAX_CONFIGURABLE_RENDER_CREDITS}.`,
		);
	}
	return value;
}

export function buildProfileEndpoint(
	endpointUrl: string,
	profile: ZvidProfile,
	maxRenderCredits = DEFAULT_MAX_RENDER_CREDITS,
): URL {
	const endpoint = new URL(endpointUrl);
	if (!['http:', 'https:'].includes(endpoint.protocol)) {
		throw new UnexpectedError('The Zvid MCP endpoint must use HTTP or HTTPS');
	}
	if (endpoint.username || endpoint.password) {
		throw new UnexpectedError('The Zvid MCP endpoint must not contain credentials');
	}

	const localHosts = new Set(['localhost', '127.0.0.1', '[::1]', 'host.docker.internal']);
	const isHostedZvid = endpoint.protocol === 'https:' && endpoint.hostname === 'mcp.zvid.io';
	if (!isHostedZvid && !localHosts.has(endpoint.hostname.toLowerCase())) {
		throw new UnexpectedError(
			'Use https://mcp.zvid.io/mcp, or a local Zvid MCP host while developing',
		);
	}
	if (endpoint.pathname.replace(/\/+$/, '') !== '/mcp') {
		throw new UnexpectedError('The Zvid MCP endpoint path must be /mcp');
	}
	endpoint.searchParams.set('profile', profile);
	endpoint.searchParams.set('maxRenderCredits', String(maxRenderCredits));
	return endpoint;
}

function accessTokenFrom(credentials: ICredentialDataDecryptedObject): string {
	const tokenData = credentials.oauthTokenData as IDataObject | undefined;
	const accessToken = tokenData?.access_token;
	if (typeof accessToken !== 'string' || !accessToken) {
		throw new UnexpectedError('The MCP OAuth2 credential is not connected to Zvid');
	}
	return accessToken;
}

async function refreshAccessToken(ctx: McpContext): Promise<string | null> {
	const refresh = ctx.helpers.refreshOAuth2Token as unknown as (
		this: McpContext,
		credentialType: string,
	) => Promise<IDataObject>;
	try {
		const tokenData = await refresh.call(ctx, 'mcpOAuth2Api');
		return typeof tokenData?.access_token === 'string' ? tokenData.access_token : null;
	} catch {
		return null;
	}
}

function withAuthorization(init: RequestInit | undefined, accessToken: string): RequestInit {
	const headers = new Headers(init?.headers);
	headers.set('Authorization', `Bearer ${accessToken}`);
	return { ...init, headers };
}

async function connectMcp(ctx: McpContext, itemIndex?: number) {
	const credentials = await ctx.getCredentials('mcpOAuth2Api');
	let accessToken = accessTokenFrom(credentials);
	const endpoint = buildProfileEndpoint(
		String(nodeParameter(ctx, 'endpointUrl', '', itemIndex)),
		selectedProfile(ctx, itemIndex),
		selectedMaxRenderCredits(ctx, itemIndex),
	);

	const authFetch: typeof fetch = async (input, init) => {
		let response = await fetch(input, withAuthorization(init, accessToken));
		if (response.status !== 401) return response;

		const refreshed = await refreshAccessToken(ctx);
		if (!refreshed) return response;
		accessToken = refreshed;
		response = await fetch(input, withAuthorization(init, accessToken));
		return response;
	};

	const client = new Client(
		{ name: 'n8n-zvid-agent-tools', version: '0.1.0' },
		{ capabilities: {} },
	);
	const transport = new StreamableHTTPClientTransport(endpoint, {
		fetch: authFetch,
	});

	try {
		await client.connect(transport);
		return client;
	} catch (error) {
		await client.close().catch(() => undefined);
		throw error;
	}
}

async function getAllTools(client: Client, cursor?: string): Promise<McpToolDefinition[]> {
	const page = await client.listTools(cursor ? { cursor } : undefined);
	const tools = page.tools as McpToolDefinition[];
	return page.nextCursor ? tools.concat(await getAllTools(client, page.nextCursor)) : tools;
}

export function filterTools(
	tools: McpToolDefinition[],
	mode: ToolFilterMode,
	includeTools: string[],
	excludeTools: string[],
) {
	if (mode === 'selected' && includeTools.length > 0) {
		const selected = new Set(includeTools);
		return tools.filter((tool) => selected.has(tool.name));
	}
	if (mode === 'except') {
		const excluded = new Set(excludeTools);
		return tools.filter((tool) => !excluded.has(tool.name));
	}
	return tools;
}

function toolName(nodeName: string, mcpToolName: string) {
	const prefix = nodeName.replace(/[^a-zA-Z0-9]/g, '_');
	const fullName = `${prefix}_${mcpToolName}`;
	if (fullName.length <= 64) return fullName;
	const prefixLength = 63 - mcpToolName.length;
	return prefixLength > 0 ? `${prefix.slice(0, prefixLength)}_${mcpToolName}` : mcpToolName;
}

function errorText(result: unknown): string {
	if (!result || typeof result !== 'object' || !('content' in result)) {
		return 'The Zvid MCP tool returned an error';
	}
	const content = (result as { content?: unknown }).content;
	if (!Array.isArray(content)) return 'The Zvid MCP tool returned an error';
	const text = content.find(
		(item) => item && typeof item === 'object' && 'text' in item && typeof item.text === 'string',
	) as { text?: string } | undefined;
	return text?.text || 'The Zvid MCP tool returned an error';
}

function resultValue(result: {
	structuredContent?: unknown;
	content?: unknown;
	toolResult?: unknown;
}) {
	if (
		result.structuredContent &&
		typeof result.structuredContent === 'object' &&
		!Array.isArray(result.structuredContent)
	) {
		return result.structuredContent;
	}
	if (result.toolResult !== undefined) return result.toolResult;
	return result.content ?? result;
}

function isStructuredContent(value: unknown): value is IDataObject {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function toolArguments(
	item: INodeExecutionData,
	inputSchema: Record<string, unknown>,
): Record<string, unknown> {
	const { tool: _tool, ...input } = item.json;
	if (inputSchema.additionalProperties === true) return input;

	const properties = inputSchema.properties;
	if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
		return input;
	}
	const allowed = new Set(Object.keys(properties));
	return Object.fromEntries(Object.entries(input).filter(([name]) => allowed.has(name)));
}

function nonEmptyText(value: unknown): string | undefined {
	if (typeof value !== 'string') return undefined;
	const text = value.trim();
	return text.length > 0 ? text : undefined;
}

/**
 * n8n Agent V3 invokes toolkit nodes through execute() and only forwards the
 * arguments generated by the model. Weak models occasionally omit create_media's
 * brief even though the original chat message is still available in the workflow
 * data proxy. Recovering it is safe because create_media only saves a draft and
 * never spends render credits.
 */
export function originalChatInput(
	item: INodeExecutionData,
	workflowDataProxy?: Record<string, unknown>,
): string | undefined {
	const direct = nonEmptyText(item.json.chatInput);
	if (direct) return direct;

	const pairedItem = Array.isArray(item.pairedItem) ? item.pairedItem[0] : item.pairedItem;
	const sourceNode =
		pairedItem && typeof pairedItem === 'object'
			? pairedItem.sourceOverwrite?.previousNode
			: undefined;
	if (!sourceNode || !workflowDataProxy) return undefined;

	try {
		const nodeProxy = workflowDataProxy.$node as
			| Record<string, { json?: Record<string, unknown> }>
			| undefined;
		return nonEmptyText(nodeProxy?.[sourceNode]?.json?.chatInput);
	} catch {
		return undefined;
	}
}

export function recoverSafeToolArguments(
	tool: string,
	args: Record<string, unknown>,
	chatInput?: string,
): Record<string, unknown> {
	const suppliedBrief = nonEmptyText(args.brief);
	if (tool !== 'create_media' || (suppliedBrief && suppliedBrief.length >= 3)) return args;
	const brief = nonEmptyText(chatInput);
	return brief && brief.length >= 3 ? { ...args, brief: brief.slice(0, 5000) } : args;
}

export function missingRequiredToolArguments(
	inputSchema: Record<string, unknown>,
	args: Record<string, unknown>,
): string[] {
	if (!Array.isArray(inputSchema.required)) return [];
	return inputSchema.required
		.filter((name): name is string => typeof name === 'string')
		.filter((name) => {
			const value = args[name];
			if (value === undefined || value === null) return true;
			if (typeof value !== 'string') return false;
			const property =
				inputSchema.properties &&
				typeof inputSchema.properties === 'object' &&
				!Array.isArray(inputSchema.properties)
					? (inputSchema.properties as Record<string, unknown>)[name]
					: undefined;
			const minLength =
				property && typeof property === 'object' && !Array.isArray(property)
					? Number((property as Record<string, unknown>).minLength ?? 1)
					: 1;
			return value.trim().length < minLength;
		});
}

function retryableInputResult(tool: string, missing: string[]): IDataObject {
	const qualityGuidance =
		tool === 'create_media' && missing.includes('payload')
			? ' Creator does not compose from a brief alone. First use plan_creative_video, examples or creative-library assets, validate the complete project JSON, then retry with that exact payload.'
			: '';
	return {
		error: 'ZVID_TOOL_INPUT_REQUIRED',
		retryable: true,
		tool,
		missingArguments: missing,
		message: `Retry ${tool} and include these required arguments: ${missing.join(', ')}. Use the user's original request; do not call the tool with an empty argument object.${qualityGuidance}`,
	};
}

function selectedToolNames(
	ctx: McpContext,
	name: 'includeTools' | 'excludeTools',
	itemIndex?: number,
) {
	const value = nodeParameter(ctx, name, [], itemIndex);
	return Array.isArray(value) ? value.map(String) : [];
}

async function getToolsForNode(ctx: McpContext, itemIndex?: number) {
	const client = await connectMcp(ctx, itemIndex);
	try {
		const allTools = await getAllTools(client);
		const mode = String(nodeParameter(ctx, 'include', 'all', itemIndex)) as ToolFilterMode;
		return {
			client,
			tools: filterTools(
				allTools,
				mode,
				selectedToolNames(ctx, 'includeTools', itemIndex),
				selectedToolNames(ctx, 'excludeTools', itemIndex),
			),
		};
	} catch (error) {
		await client.close().catch(() => undefined);
		throw error;
	}
}

export async function loadZvidTools(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const { client, tools } = await getToolsForNode(this);
	try {
		return tools.map((tool) => ({
			name: tool.name,
			value: tool.name,
			description: tool.description,
		}));
	} finally {
		await client.close();
	}
}

export class ZvidAgentTools implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Zvid Agent Tools',
		name: 'zvidAgentTools',
		icon: 'file:../Zvid/zvid.svg',
		group: ['output'],
		version: 1,
		description: 'Connect a profile-filtered Zvid MCP toolkit to an AI Agent',
		defaults: { name: 'Zvid Agent Tools' },
		inputs: [],
		outputs: [{ type: NodeConnectionTypes.AiTool, displayName: 'Tools' }],
		credentials: [{ name: 'mcpOAuth2Api', required: true }],
		properties: [
			{
				displayName:
					'The selected profile and credit limit are stored in this workflow. Dashboard changes do not modify existing workflows, but the dashboard MCP credit limit, when set, still caps every render server-side.',
				name: 'profileSnapshotNotice',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'MCP Endpoint',
				name: 'endpointUrl',
				type: 'string',
				typeOptions: { url: true },
				default: 'https://mcp.zvid.io/mcp',
				required: true,
				description:
					'Use the hosted endpoint, or http://host.docker.internal:8080/mcp when n8n runs in Docker and Zvid MCP runs on the host',
			},
			{
				displayName: 'Tool Profile',
				name: 'profile',
				type: 'options',
				noDataExpression: true,
				default: 'creator',
				description:
					'Changing this value affects only this workflow and never updates the dashboard default',
				options: [
					{
						name: 'Creator (Recommended)',
						value: 'creator',
						description:
							'Quality-first authoring with planning, examples, libraries, stock media, validation, projects, templates, and approval-aware rendering',
					},
					{
						name: 'Automation',
						value: 'automation',
						description: 'Creator tools plus direct renders, capped bulk rendering, and webhooks',
					},
					{
						name: 'Developer',
						value: 'developer',
						description:
							'Trusted development only: every enabled MCP tool, including direct renders and automation; update/delete remain disabled',
					},
					{
						name: 'Read Only',
						value: 'readonly',
						description: 'Inspect media and account usage without creating or rendering',
					},
				],
			},
			{
				displayName: 'Max Render Credits',
				name: 'maxRenderCredits',
				type: 'number',
				noDataExpression: true,
				typeOptions: {
					minValue: 1,
					maxValue: MAX_CONFIGURABLE_RENDER_CREDITS,
					numberPrecision: 0,
				},
				default: DEFAULT_MAX_RENDER_CREDITS,
				required: true,
				description:
					'Maximum credits allowed for one approval-aware render in this workflow. The AI agent cannot change it, and the dashboard MCP credit limit, when set, is a hard ceiling on top of it.',
			},
			{
				displayName: 'Tools to Include',
				name: 'include',
				type: 'options',
				default: 'all',
				description: 'Optionally narrow the tools already allowed by the selected profile',
				options: [
					{ name: 'All Profile Tools', value: 'all' },
					{ name: 'Selected', value: 'selected' },
					{ name: 'All Except', value: 'except' },
				],
			},
			{
				displayName: 'Selected Tool Names or IDs',
				name: 'includeTools',
				type: 'multiOptions',
				default: [],
				typeOptions: {
					loadOptionsMethod: 'getTools',
					loadOptionsDependsOn: ['endpointUrl', 'profile'],
				},
				displayOptions: { show: { include: ['selected'] } },
				description:
					'Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
			},
			{
				displayName: 'Excluded Tool Names or IDs',
				name: 'excludeTools',
				type: 'multiOptions',
				default: [],
				typeOptions: {
					loadOptionsMethod: 'getTools',
					loadOptionsDependsOn: ['endpointUrl', 'profile'],
				},
				displayOptions: { show: { include: ['except'] } },
				description:
					'Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Timeout',
						name: 'timeout',
						type: 'number',
						typeOptions: { minValue: 1 },
						default: 60000,
						description: 'Maximum milliseconds for each MCP tool call',
					},
				],
			},
		],
	};

	methods = { loadOptions: { getTools: loadZvidTools } };

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		const node = this.getNode();
		let toolkit;
		try {
			toolkit = await getToolsForNode(this, itemIndex);
		} catch (error) {
			throw new NodeOperationError(node, error as Error, {
				itemIndex,
				description:
					'Could not connect to Zvid MCP. Check the endpoint and reconnect the MCP OAuth2 credential.',
			});
		}

		if (toolkit.tools.length === 0) {
			await toolkit.client.close();
			throw new NodeOperationError(node, 'Zvid MCP returned no tools for this selection', {
				itemIndex,
			});
		}

		const timeout = Number(nodeParameter(this, 'options.timeout', 60000, itemIndex));
		const signal = this.getExecutionCancelSignal();
		const tools = toolkit.tools.map(
			(tool) =>
				new DynamicStructuredTool({
					name: toolName(node.name, tool.name),
					description: tool.description || '',
					schema: tool.inputSchema as never,
					metadata: { isFromToolkit: true, sourceNodeName: node.name },
					func: async (args: Record<string, unknown>) => {
						if (signal?.aborted) {
							throw new NodeOperationError(node, 'Execution was cancelled', { itemIndex });
						}
						const result = await toolkit.client.callTool(
							{ name: tool.name, arguments: args },
							CompatibilityCallToolResultSchema,
							{ timeout, signal },
						);
						if (result.isError) {
							throw new NodeOperationError(node, errorText(result), { itemIndex });
						}
						return resultValue(result);
					},
				}),
		);

		// n8n accepts an array of LangChain tools from an AI-tool sub-node and
		// flattens it with other connected toolkits. Keeping the MCP client open
		// lets those tools execute throughout the parent agent run.
		return {
			response: tools,
			closeFunction: async () => await toolkit.client.close(),
		};
	}

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const node = this.getNode();
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			const item = items[itemIndex];
			const requestedTool = item.json.tool;
			if (typeof requestedTool !== 'string' || !requestedTool) {
				throw new NodeOperationError(node, 'Tool name was not provided by the AI Agent', {
					itemIndex,
				});
			}

			let toolkit;
			try {
				toolkit = await getToolsForNode(this, itemIndex);
			} catch (error) {
				throw new NodeOperationError(node, error as Error, {
					itemIndex,
					description:
						'Could not connect to Zvid MCP. Check the endpoint and reconnect the MCP OAuth2 credential.',
				});
			}

			try {
				const mcpTool = toolkit.tools.find(
					(tool) => toolName(node.name, tool.name) === requestedTool,
				);
				if (!mcpTool) {
					throw new NodeOperationError(
						node,
						`Tool "${requestedTool}" is not available in the selected Zvid profile`,
						{ itemIndex },
					);
				}

				let args = toolArguments(item, mcpTool.inputSchema);
				let chatInput = originalChatInput(item);
				try {
					chatInput = originalChatInput(
						item,
						this.getWorkflowDataProxy(itemIndex) as Record<string, unknown>,
					);
				} catch {
					// A missing workflow proxy should produce a retryable tool result below,
					// never turn an omitted model argument into a node execution failure.
				}
				args = recoverSafeToolArguments(mcpTool.name, args, chatInput);
				const missing = missingRequiredToolArguments(mcpTool.inputSchema, args);
				if (missing.length > 0) {
					const retry = retryableInputResult(mcpTool.name, missing);
					returnData.push({
						json: {
							response: [{ type: 'text', text: JSON.stringify(retry) }],
							structuredContent: retry,
						},
						pairedItem: { item: itemIndex },
					});
					continue;
				}

				const timeout = Number(nodeParameter(this, 'options.timeout', 60000, itemIndex));
				const result = await toolkit.client.callTool(
					{
						name: mcpTool.name,
						arguments: args,
					},
					CompatibilityCallToolResultSchema,
					{ timeout, signal: this.getExecutionCancelSignal() },
				);
				if (result.isError) {
					throw new NodeOperationError(node, errorText(result), { itemIndex });
				}

				returnData.push({
					json: {
						response: result.content as IDataObject[],
						...(isStructuredContent(result.structuredContent)
							? { structuredContent: result.structuredContent }
							: {}),
					},
					pairedItem: { item: itemIndex },
				});
			} finally {
				await toolkit.client.close();
			}
		}

		return [returnData];
	}
}
