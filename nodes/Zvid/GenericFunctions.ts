import type {
	IDataObject,
	IExecuteSingleFunctions,
	IHookFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	IN8nHttpFullResponse,
	INodeExecutionData,
	IWebhookFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError, sleep } from 'n8n-workflow';

type ZvidContext = IExecuteSingleFunctions | IHookFunctions | IWebhookFunctions;

/** Authenticated request against the Zvid API using the stored credentials. */
export async function zvidApiRequest(
	this: ZvidContext,
	method: IHttpRequestMethods,
	endpoint: string,
	body?: IDataObject,
	qs?: IDataObject,
): Promise<IDataObject> {
	const credentials = await this.getCredentials('zvidApi');
	const baseUrl = String(credentials.baseUrl ?? 'https://api.zvid.io').replace(/\/+$/, '');

	const options: IHttpRequestOptions = {
		method,
		url: `${baseUrl}${endpoint}`,
		qs,
		body,
		json: true,
	};
	if (body === undefined) delete options.body;

	try {
		return (await this.helpers.httpRequestWithAuthentication.call(
			this,
			'zvidApi',
			options,
		)) as IDataObject;
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject);
	}
}

/** Parse a JSON-type node parameter that may arrive as a string or an object. */
export function parseJsonParameter(
	context: IExecuteSingleFunctions,
	value: unknown,
	parameterName: string,
): IDataObject | undefined {
	if (value === undefined || value === null || value === '') return undefined;
	if (typeof value === 'object') return value as IDataObject;
	try {
		const parsed = JSON.parse(String(value)) as IDataObject;
		if (typeof parsed !== 'object' || parsed === null) {
			throw new Error('not an object');
		}
		return parsed;
	} catch {
		throw new NodeOperationError(
			context.getNode(),
			`Parameter "${parameterName}" must be valid JSON (an object)`,
		);
	}
}

/**
 * preSend: build the render submission envelope ({payload}|{template,variables},
 * plus overrides/webhookUrl) from the node parameters.
 */
export async function buildRenderBody(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const source = this.getNodeParameter('source', 'template') as string;
	const body: IDataObject = {};

	if (source === 'json') {
		body.payload = parseJsonParameter(
			this,
			this.getNodeParameter('projectJson', '{}'),
			'Project JSON',
		);
		const validationVariables = parseJsonParameter(
			this,
			this.getNodeParameter('validationVariables', '{}'),
			'Validation Variables',
		);
		if (validationVariables && Object.keys(validationVariables).length > 0) {
			body.variables = validationVariables;
		}
	} else {
		body.template = this.getNodeParameter('templateId', '') as string;
		const variables = parseJsonParameter(
			this,
			this.getNodeParameter('variables', '{}'),
			'Variables',
		);
		if (variables && Object.keys(variables).length > 0) body.variables = variables;
	}

	const additional = this.getNodeParameter('additionalFields', {}) as IDataObject;
	if (additional.overrides) {
		body.overrides = parseJsonParameter(this, additional.overrides, 'Overrides');
	}
	if (additional.webhookUrl) body.webhookUrl = additional.webhookUrl;

	requestOptions.body = body;
	return requestOptions;
}

/** preSend: create an editable dashboard/editor project from validated JSON. */
export async function buildProjectCreateBody(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	requestOptions.body = {
		name: this.getNodeParameter('projectName', '') as string,
		payload: parseJsonParameter(this, this.getNodeParameter('projectJson', '{}'), 'Project JSON'),
	};
	return requestOptions;
}

/** preSend: build the bulk render envelope (template/payload + items[]). */
export async function buildBulkRenderBody(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const requestBody = (await buildRenderBody.call(this, requestOptions)).body as IDataObject;

	const itemsJson = this.getNodeParameter('items', '[]');
	let items: unknown;
	try {
		items = typeof itemsJson === 'object' ? itemsJson : JSON.parse(String(itemsJson));
	} catch {
		items = undefined;
	}
	if (!Array.isArray(items) || items.length === 0) {
		throw new NodeOperationError(
			this.getNode(),
			'Items must be a JSON array with one entry per render, e.g. [{"variables": {"name": "Alice"}}]',
		);
	}
	requestBody.items = items;

	const additional = this.getNodeParameter('additionalFields', {}) as IDataObject;
	if (additional.batchName) requestBody.name = additional.batchName;

	requestOptions.body = requestBody;
	return requestOptions;
}

/**
 * postReceive: normalize POST /api/render/validate/api-key responses (2xx or
 * 400 — the request is sent with ignoreHttpStatusErrors) into one
 * { valid, errors, planLimits } item so workflows can branch on `valid`
 * instead of failing on invalid payloads.
 */
export async function normalizeValidationResponse(
	this: IExecuteSingleFunctions,
	items: INodeExecutionData[],
	response: IN8nHttpFullResponse,
): Promise<INodeExecutionData[]> {
	const status = response.statusCode ?? 0;
	return items.map((item) => {
		const body = item.json as IDataObject;
		if (status >= 200 && status < 300) {
			return { json: { valid: true, ...body }, pairedItem: item.pairedItem };
		}
		return {
			json: {
				valid: false,
				error: body.error ?? 'Validation failed',
				message: body.message ?? 'The payload was rejected by the Zvid API',
				// field-level problems: [{ field, message }]
				errors: body.details ?? [],
				// the caller's effective plan limits (echoed by the API on 400)
				planLimits: body.planLimits,
			},
			pairedItem: item.pairedItem,
		};
	});
}

/** preSend: attach pagination and type filter to render list requests. */
export async function addRenderListQuery(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const qs: IDataObject = { ...(requestOptions.qs as IDataObject) };
	qs.limit = this.getNodeParameter('limit', 50) as number;
	qs.page = this.getNodeParameter('page', 1) as number;
	const filterType = this.getNodeParameter('filterType', 'all') as string;
	if (filterType !== 'all') qs.type = filterType;
	requestOptions.qs = qs;
	return requestOptions;
}

/** preSend: build the template preview body ({variables} only). */
export async function buildPreviewBody(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const body: IDataObject = {};
	const variables = parseJsonParameter(this, this.getNodeParameter('variables', '{}'), 'Variables');
	if (variables && Object.keys(variables).length > 0) body.variables = variables;
	requestOptions.body = body;
	return requestOptions;
}

/** preSend: wrap an AI-authored project for the conservative repair endpoint. */
export async function buildRepairBody(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	requestOptions.body = {
		payload: parseJsonParameter(this, this.getNodeParameter('projectJson', '{}'), 'Project JSON'),
	};
	return requestOptions;
}

/** Build the free creative-planning request used before project JSON authoring. */
export async function buildCreativePlanBody(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const brief = String(this.getNodeParameter('creativeBrief', '')).trim();
	if (!brief) {
		throw new NodeOperationError(this.getNode(), 'Creative Brief is required');
	}

	const parseArray = (value: unknown, name: string): string[] => {
		let parsed = value;
		if (typeof value === 'string') {
			try {
				parsed = JSON.parse(value);
			} catch {
				parsed = undefined;
			}
		}
		if (!Array.isArray(parsed) || parsed.some((entry) => typeof entry !== 'string')) {
			throw new NodeOperationError(this.getNode(), `${name} must be a JSON array of strings`);
		}
		return parsed;
	};

	const variationMode = this.getNodeParameter('variationMode', 'fresh') as string;
	const variationSeed = String(this.getNodeParameter('variationSeed', '')).trim();
	const motionIntensity = this.getNodeParameter('motionIntensity', 'auto') as string;
	const recentAssetSlugs = parseArray(
		this.getNodeParameter('recentAssetSlugs', '[]'),
		'Recent Asset Slugs',
	);
	const brand = parseJsonParameter(this, this.getNodeParameter('brandKit', '{}'), 'Brand Kit');

	requestOptions.body = {
		brief,
		variationMode,
		...(variationSeed ? { variationSeed } : {}),
		...(variationMode === 'explore'
			? { exploreCount: this.getNodeParameter('exploreCount', 3) as number }
			: {}),
		aspectRatio: this.getNodeParameter('creativeAspectRatio', '16:9') as string,
		duration: this.getNodeParameter('creativeDuration', 15) as number,
		style: this.getNodeParameter('creativeStyle', 'auto') as string,
		...(motionIntensity !== 'auto' ? { motionIntensity } : {}),
		preferredMedia: this.getNodeParameter('preferredMedia', 'mixed') as string,
		recentAssetSlugs,
		...(brand && Object.keys(brand).length > 0 ? { brand } : {}),
	};
	return requestOptions;
}

/** preSend: build POST /api/templates from explicit AI-tool parameters. */
export async function buildTemplateCreateBody(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const name = String(this.getNodeParameter('templateName', '')).trim();
	if (!name) {
		throw new NodeOperationError(this.getNode(), 'Template Name is required');
	}
	const description = String(this.getNodeParameter('templateDescription', '')).trim();
	requestOptions.body = {
		name,
		...(description ? { description } : {}),
		payload: parseJsonParameter(
			this,
			this.getNodeParameter('templateProjectJson', '{}'),
			'Template Project JSON',
		),
	};
	return requestOptions;
}

/** preSend: whitelist and validate PUT /api/templates/:id changes. */
export async function buildTemplateUpdateBody(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const changes = parseJsonParameter(
		this,
		this.getNodeParameter('templateChanges', '{}'),
		'Template Changes',
	) as IDataObject;
	const body: IDataObject = {};
	for (const key of ['name', 'description', 'payload'] as const) {
		if (changes[key] !== undefined) body[key] = changes[key];
	}
	if (Object.keys(body).length === 0) {
		throw new NodeOperationError(
			this.getNode(),
			'Template Changes must include name, description, or payload',
		);
	}
	requestOptions.body = body;
	return requestOptions;
}

/**
 * postReceive: when "Wait for Completion" is enabled, poll GET /api/jobs/:id
 * until the render completes or fails (or the wait budget runs out) and
 * replace the queued-job response with the final job.
 */
export async function waitForRenderCompletion(
	this: IExecuteSingleFunctions,
	items: INodeExecutionData[],
): Promise<INodeExecutionData[]> {
	const wait = this.getNodeParameter('waitForCompletion', false) as boolean;
	if (!wait) return items;

	const waitOptions = this.getNodeParameter('waitOptions', {}) as IDataObject;
	const intervalSeconds = Number(waitOptions.pollInterval ?? 5);
	const maxWaitSeconds = Number(waitOptions.maxWaitTime ?? 600);
	const deadline = Date.now() + maxWaitSeconds * 1000;

	const result: INodeExecutionData[] = [];
	for (const item of items) {
		const jobId = (item.json.jobId ?? item.json.id) as string | undefined;
		if (!jobId) {
			result.push(item);
			continue;
		}

		let job = item.json as IDataObject;
		let state = String(job.state ?? job.status ?? '');
		while (state !== 'completed' && state !== 'failed') {
			if (Date.now() > deadline) {
				throw new NodeOperationError(
					this.getNode(),
					`Render ${jobId} did not finish within ${maxWaitSeconds} seconds (last state: "${state}"). Increase Max Wait Time or use the Zvid Trigger node instead.`,
				);
			}
			await sleep(intervalSeconds * 1000);
			job = await zvidApiRequest.call(this, 'GET', `/api/jobs/${jobId}`);
			state = String(job.state ?? job.status ?? '');
		}

		if (state === 'failed') {
			throw new NodeOperationError(
				this.getNode(),
				`Render ${jobId} failed: ${String(job.failedReason ?? 'unknown reason')}`,
			);
		}
		result.push({ json: job, pairedItem: item.pairedItem });
	}
	return result;
}
