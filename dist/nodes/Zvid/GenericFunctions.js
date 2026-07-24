"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.zvidApiRequest = zvidApiRequest;
exports.parseJsonParameter = parseJsonParameter;
exports.buildRenderBody = buildRenderBody;
exports.buildBulkRenderBody = buildBulkRenderBody;
exports.normalizeValidationResponse = normalizeValidationResponse;
exports.addRenderListQuery = addRenderListQuery;
exports.buildPreviewBody = buildPreviewBody;
exports.buildRepairBody = buildRepairBody;
exports.buildCreativePlanBody = buildCreativePlanBody;
exports.buildTemplateCreateBody = buildTemplateCreateBody;
exports.buildTemplateUpdateBody = buildTemplateUpdateBody;
exports.waitForRenderCompletion = waitForRenderCompletion;
const n8n_workflow_1 = require("n8n-workflow");
async function zvidApiRequest(method, endpoint, body, qs) {
    var _a;
    const credentials = await this.getCredentials('zvidApi');
    const baseUrl = String((_a = credentials.baseUrl) !== null && _a !== void 0 ? _a : 'https://api.zvid.io').replace(/\/+$/, '');
    const options = {
        method,
        url: `${baseUrl}${endpoint}`,
        qs,
        body,
        json: true,
    };
    if (body === undefined)
        delete options.body;
    try {
        return (await this.helpers.httpRequestWithAuthentication.call(this, 'zvidApi', options));
    }
    catch (error) {
        throw new n8n_workflow_1.NodeApiError(this.getNode(), error);
    }
}
function parseJsonParameter(context, value, parameterName) {
    if (value === undefined || value === null || value === '')
        return undefined;
    if (typeof value === 'object')
        return value;
    try {
        const parsed = JSON.parse(String(value));
        if (typeof parsed !== 'object' || parsed === null) {
            throw new Error('not an object');
        }
        return parsed;
    }
    catch {
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `Parameter "${parameterName}" must be valid JSON (an object)`);
    }
}
async function buildRenderBody(requestOptions) {
    const source = this.getNodeParameter('source', 'template');
    const body = {};
    if (source === 'json') {
        body.payload = parseJsonParameter(this, this.getNodeParameter('projectJson', '{}'), 'Project JSON');
    }
    else {
        body.template = this.getNodeParameter('templateId', '');
        const variables = parseJsonParameter(this, this.getNodeParameter('variables', '{}'), 'Variables');
        if (variables && Object.keys(variables).length > 0)
            body.variables = variables;
    }
    const additional = this.getNodeParameter('additionalFields', {});
    if (additional.overrides) {
        body.overrides = parseJsonParameter(this, additional.overrides, 'Overrides');
    }
    if (additional.webhookUrl)
        body.webhookUrl = additional.webhookUrl;
    requestOptions.body = body;
    return requestOptions;
}
async function buildBulkRenderBody(requestOptions) {
    const requestBody = (await buildRenderBody.call(this, requestOptions)).body;
    const itemsJson = this.getNodeParameter('items', '[]');
    let items;
    try {
        items = typeof itemsJson === 'object' ? itemsJson : JSON.parse(String(itemsJson));
    }
    catch {
        items = undefined;
    }
    if (!Array.isArray(items) || items.length === 0) {
        throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Items must be a JSON array with one entry per render, e.g. [{"variables": {"name": "Alice"}}]');
    }
    requestBody.items = items;
    const additional = this.getNodeParameter('additionalFields', {});
    if (additional.batchName)
        requestBody.name = additional.batchName;
    requestOptions.body = requestBody;
    return requestOptions;
}
async function normalizeValidationResponse(items, response) {
    var _a;
    const status = (_a = response.statusCode) !== null && _a !== void 0 ? _a : 0;
    return items.map((item) => {
        var _a, _b, _c;
        const body = item.json;
        if (status >= 200 && status < 300) {
            return { json: { valid: true, ...body }, pairedItem: item.pairedItem };
        }
        return {
            json: {
                valid: false,
                error: (_a = body.error) !== null && _a !== void 0 ? _a : 'Validation failed',
                message: (_b = body.message) !== null && _b !== void 0 ? _b : 'The payload was rejected by the Zvid API',
                errors: (_c = body.details) !== null && _c !== void 0 ? _c : [],
                planLimits: body.planLimits,
            },
            pairedItem: item.pairedItem,
        };
    });
}
async function addRenderListQuery(requestOptions) {
    const qs = { ...requestOptions.qs };
    qs.limit = this.getNodeParameter('limit', 50);
    qs.page = this.getNodeParameter('page', 1);
    const filterType = this.getNodeParameter('filterType', 'all');
    if (filterType !== 'all')
        qs.type = filterType;
    requestOptions.qs = qs;
    return requestOptions;
}
async function buildPreviewBody(requestOptions) {
    const body = {};
    const variables = parseJsonParameter(this, this.getNodeParameter('variables', '{}'), 'Variables');
    if (variables && Object.keys(variables).length > 0)
        body.variables = variables;
    requestOptions.body = body;
    return requestOptions;
}
async function buildRepairBody(requestOptions) {
    requestOptions.body = {
        payload: parseJsonParameter(this, this.getNodeParameter('projectJson', '{}'), 'Project JSON'),
    };
    return requestOptions;
}
async function buildCreativePlanBody(requestOptions) {
    const brief = String(this.getNodeParameter('creativeBrief', '')).trim();
    if (!brief) {
        throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Creative Brief is required');
    }
    const parseArray = (value, name) => {
        let parsed = value;
        if (typeof value === 'string') {
            try {
                parsed = JSON.parse(value);
            }
            catch {
                parsed = undefined;
            }
        }
        if (!Array.isArray(parsed) || parsed.some((entry) => typeof entry !== 'string')) {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), `${name} must be a JSON array of strings`);
        }
        return parsed;
    };
    const variationMode = this.getNodeParameter('variationMode', 'fresh');
    const variationSeed = String(this.getNodeParameter('variationSeed', '')).trim();
    const motionIntensity = this.getNodeParameter('motionIntensity', 'auto');
    const recentAssetSlugs = parseArray(this.getNodeParameter('recentAssetSlugs', '[]'), 'Recent Asset Slugs');
    const brand = parseJsonParameter(this, this.getNodeParameter('brandKit', '{}'), 'Brand Kit');
    requestOptions.body = {
        brief,
        variationMode,
        ...(variationSeed ? { variationSeed } : {}),
        ...(variationMode === 'explore'
            ? { exploreCount: this.getNodeParameter('exploreCount', 3) }
            : {}),
        aspectRatio: this.getNodeParameter('creativeAspectRatio', '16:9'),
        duration: this.getNodeParameter('creativeDuration', 15),
        style: this.getNodeParameter('creativeStyle', 'auto'),
        ...(motionIntensity !== 'auto' ? { motionIntensity } : {}),
        preferredMedia: this.getNodeParameter('preferredMedia', 'mixed'),
        recentAssetSlugs,
        ...(brand && Object.keys(brand).length > 0 ? { brand } : {}),
    };
    return requestOptions;
}
async function buildTemplateCreateBody(requestOptions) {
    const name = String(this.getNodeParameter('templateName', '')).trim();
    if (!name) {
        throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Template Name is required');
    }
    const description = String(this.getNodeParameter('templateDescription', '')).trim();
    requestOptions.body = {
        name,
        ...(description ? { description } : {}),
        payload: parseJsonParameter(this, this.getNodeParameter('templateProjectJson', '{}'), 'Template Project JSON'),
    };
    return requestOptions;
}
async function buildTemplateUpdateBody(requestOptions) {
    const changes = parseJsonParameter(this, this.getNodeParameter('templateChanges', '{}'), 'Template Changes');
    const body = {};
    for (const key of ['name', 'description', 'payload']) {
        if (changes[key] !== undefined)
            body[key] = changes[key];
    }
    if (Object.keys(body).length === 0) {
        throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Template Changes must include name, description, or payload');
    }
    requestOptions.body = body;
    return requestOptions;
}
async function waitForRenderCompletion(items, _response) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const wait = this.getNodeParameter('waitForCompletion', false);
    if (!wait)
        return items;
    const waitOptions = this.getNodeParameter('waitOptions', {});
    const intervalSeconds = Number((_a = waitOptions.pollInterval) !== null && _a !== void 0 ? _a : 5);
    const maxWaitSeconds = Number((_b = waitOptions.maxWaitTime) !== null && _b !== void 0 ? _b : 600);
    const deadline = Date.now() + maxWaitSeconds * 1000;
    const result = [];
    for (const item of items) {
        const jobId = ((_c = item.json.jobId) !== null && _c !== void 0 ? _c : item.json.id);
        if (!jobId) {
            result.push(item);
            continue;
        }
        let job = item.json;
        let state = String((_e = (_d = job.state) !== null && _d !== void 0 ? _d : job.status) !== null && _e !== void 0 ? _e : '');
        while (state !== 'completed' && state !== 'failed') {
            if (Date.now() > deadline) {
                throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Render ${jobId} did not finish within ${maxWaitSeconds} seconds (last state: "${state}"). Increase Max Wait Time or use the Zvid Trigger node instead.`);
            }
            await (0, n8n_workflow_1.sleep)(intervalSeconds * 1000);
            job = await zvidApiRequest.call(this, 'GET', `/api/jobs/${jobId}`);
            state = String((_g = (_f = job.state) !== null && _f !== void 0 ? _f : job.status) !== null && _g !== void 0 ? _g : '');
        }
        if (state === 'failed') {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Render ${jobId} failed: ${String((_h = job.failedReason) !== null && _h !== void 0 ? _h : 'unknown reason')}`);
        }
        result.push({ json: job, pairedItem: item.pairedItem });
    }
    return result;
}
//# sourceMappingURL=GenericFunctions.js.map