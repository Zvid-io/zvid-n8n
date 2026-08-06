// Smoke tests over the compiled output (run `npm run build` first).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const { Zvid } = require('../dist/nodes/Zvid/Zvid.node.js');
const { ZvidTrigger } = require('../dist/nodes/ZvidTrigger/ZvidTrigger.node.js');
const { ZvidApi } = require('../dist/credentials/ZvidApi.credentials.js');
const packageJson = require('../package.json');

const agentWorkflow = JSON.parse(
	readFileSync(join(__dirname, '..', 'workflows', 'zvid-ai-agent.json'), 'utf8'),
);

function hasConnection(source, type, target) {
	return agentWorkflow.connections[source]?.[type]?.[0]?.some(
		(connection) => connection.node === target && connection.type === type,
	);
}

test('one-click AI Agent template stores a concrete creator profile', () => {
	assert.equal(agentWorkflow.name, 'Zvid AI Agent - Creator');
	assert.equal(agentWorkflow.active, false);
	assert.ok(packageJson.files.includes('workflows'));

	const nodeNames = agentWorkflow.nodes.map((node) => node.name);
	const nodeIds = agentWorkflow.nodes.map((node) => node.id);
	assert.equal(new Set(nodeNames).size, nodeNames.length);
	assert.equal(new Set(nodeIds).size, nodeIds.length);
	assert.ok(agentWorkflow.nodes.every((node) => node.credentials === undefined));

	const mcp = agentWorkflow.nodes.find((node) => node.name === 'Zvid MCP Tools');
	assert.equal(mcp.type, '@n8n/n8n-nodes-langchain.mcpClientTool');
	assert.equal(mcp.typeVersion, 1.4);
	assert.equal(
		mcp.parameters.endpointUrl,
		'https://mcp.zvid.io/mcp?profile=creator&maxRenderCredits=120',
	);
	assert.equal(mcp.parameters.serverTransport, 'httpStreamable');
	assert.equal(mcp.parameters.authentication, 'mcpOAuth2Api');
	assert.equal(mcp.parameters.include, 'all');

	assert.ok(hasConnection('When chat message received', 'main', 'Zvid AI Agent'));
	assert.ok(hasConnection('OpenRouter Chat Model', 'ai_languageModel', 'Zvid AI Agent'));
	assert.ok(hasConnection('Conversation Memory', 'ai_memory', 'Zvid AI Agent'));
	assert.ok(hasConnection('Zvid MCP Tools', 'ai_tool', 'Zvid AI Agent'));
});

test('one-click AI Agent prompt follows the quality-first creator workflow', () => {
	const agent = agentWorkflow.nodes.find((node) => node.name === 'Zvid AI Agent');
	const prompt = agent.parameters.options.systemMessage;
	assert.match(prompt, /create_media/);
	assert.match(prompt, /QUALITY-FIRST CREATOR WORKFLOW/);
	assert.match(prompt, /plan_creative_video/);
	assert.match(prompt, /exact validated payload/);
	assert.match(prompt, /revise_media/);
	assert.match(prompt, /render_media only after the user approves/);
	assert.match(prompt, /never attempt to change the profile yourself/);
});

test('Zvid node description is wired correctly', () => {
	const node = new Zvid();
	const d = node.description;
	assert.equal(d.name, 'zvid');
	assert.equal(d.credentials[0].name, 'zvidApi');

	const renderOps = d.properties.find(
		(p) => p.name === 'operation' && p.displayOptions.show.resource[0] === 'render',
	);
	const values = renderOps.options.map((o) => o.value).sort();
	assert.deepEqual(values, ['create', 'createBulk', 'get', 'getAll', 'validate']);

	const create = renderOps.options.find((o) => o.value === 'create');
	assert.match(create.routing.request.url, /\/api\/render/);
	assert.equal(typeof create.routing.send.preSend[0], 'function');
	assert.equal(typeof create.routing.output.postReceive[0], 'function');
});

test('validate operation hits the validation endpoint without failing the workflow', () => {
	const node = new Zvid();
	const renderOps = node.description.properties.find(
		(p) => p.name === 'operation' && p.displayOptions.show.resource[0] === 'render',
	);
	const validate = renderOps.options.find((o) => o.value === 'validate');
	assert.equal(validate.routing.request.url, '/api/render/validate/api-key');
	assert.equal(validate.routing.request.ignoreHttpStatusErrors, true);
	assert.equal(typeof validate.routing.send.preSend[0], 'function');
	assert.equal(typeof validate.routing.output.postReceive[0], 'function');

	// the shared render input fields are shown for the validate operation too
	const source = node.description.properties.find((p) => p.name === 'source');
	assert.ok(source.displayOptions.show.operation.includes('validate'));
});

test('authoring resource exposes creative planning, schema, docs, examples, and repair to AI agents', () => {
	const node = new Zvid();
	assert.equal(node.description.usableAsTool, true);
	const authoringOps = node.description.properties.find(
		(p) => p.name === 'operation' && p.displayOptions.show.resource[0] === 'authoring',
	);
	const values = authoringOps.options.map((o) => o.value).sort();
	assert.deepEqual(values, [
		'getElementDocs',
		'getExample',
		'getSchema',
		'listElements',
		'planCreativeVideo',
		'repair',
	]);
	assert.equal(
		authoringOps.options.find((o) => o.value === 'planCreativeVideo').routing.request.url,
		'/api/render/creative-plan/api-key',
	);
	assert.equal(
		authoringOps.options.find((o) => o.value === 'getSchema').routing.request.url,
		'/api/render/schema/api-key',
	);
	assert.equal(
		authoringOps.options.find((o) => o.value === 'repair').routing.request.url,
		'/api/render/repair/api-key',
	);
});

test('creative library and stock media resources expose discovery operations', () => {
	const node = new Zvid();
	const libraryOps = node.description.properties.find(
		(p) => p.name === 'operation' && p.displayOptions.show.resource[0] === 'creativeLibrary',
	);
	assert.deepEqual(libraryOps.options.map((o) => o.value).sort(), [
		'getContent',
		'getMetadata',
		'search',
	]);
	assert.equal(
		libraryOps.options.find((o) => o.value === 'getContent').routing.request.url,
		'=/api/library/{{$parameter.libraryKind}}/{{$parameter.librarySlug}}/content',
	);

	const stockOps = node.description.properties.find(
		(p) => p.name === 'operation' && p.displayOptions.show.resource[0] === 'stockMedia',
	);
	assert.deepEqual(stockOps.options.map((o) => o.value).sort(), ['listProviders', 'search']);
	assert.equal(
		stockOps.options.find((o) => o.value === 'search').routing.request.url,
		'/api/stock/search',
	);
});

test('creative plan helper builds variation and brand inputs', async () => {
	const { buildCreativePlanBody } = require('../dist/nodes/Zvid/GenericFunctions.js');
	const params = {
		creativeBrief: 'Launch an AI analytics product',
		variationMode: 'explore',
		variationSeed: 'campaign-7',
		exploreCount: 3,
		creativeAspectRatio: '9:16',
		creativeDuration: 20,
		creativeStyle: 'modern-saas',
		motionIntensity: 'balanced',
		preferredMedia: 'video',
		recentAssetSlugs: ['old-one', 'old-two'],
		brandKit: { name: 'Acme', primaryColor: '#6633ff' },
	};
	const result = await buildCreativePlanBody.call(
		{
			getNodeParameter: (name, fallback) => params[name] ?? fallback,
			getNode: () => ({ name: 'Zvid' }),
		},
		{},
	);
	assert.deepEqual(result.body, {
		brief: 'Launch an AI analytics product',
		variationMode: 'explore',
		variationSeed: 'campaign-7',
		exploreCount: 3,
		aspectRatio: '9:16',
		duration: 20,
		style: 'modern-saas',
		motionIntensity: 'balanced',
		preferredMedia: 'video',
		recentAssetSlugs: ['old-one', 'old-two'],
		brand: { name: 'Acme', primaryColor: '#6633ff' },
	});
});

test('template resource exposes the complete CRUD and render workflow', () => {
	const node = new Zvid();
	const templateOps = node.description.properties.find(
		(p) => p.name === 'operation' && p.displayOptions.show.resource[0] === 'template',
	);
	const values = templateOps.options.map((o) => o.value).sort();
	assert.deepEqual(values, [
		'create',
		'delete',
		'duplicate',
		'get',
		'getAll',
		'preview',
		'render',
		'update',
	]);
	assert.equal(
		templateOps.options.find((o) => o.value === 'create').routing.request.url,
		'/api/templates',
	);
	assert.equal(
		templateOps.options.find((o) => o.value === 'delete').routing.request.method,
		'DELETE',
	);
});

test('template write helpers build safe API envelopes', async () => {
	const {
		buildTemplateCreateBody,
		buildTemplateUpdateBody,
	} = require('../dist/nodes/Zvid/GenericFunctions.js');
	const project = {
		duration: 5,
		visuals: [{ type: 'TEXT', text: '{{title}}' }],
		variables: { title: 'Hi' },
	};
	const created = await buildTemplateCreateBody.call(
		{
			getNodeParameter: (name) =>
				({ templateName: 'Promo', templateDescription: 'Reusable', templateProjectJson: project })[
					name
				],
			getNode: () => ({ name: 'Zvid' }),
		},
		{},
	);
	assert.deepEqual(created.body, { name: 'Promo', description: 'Reusable', payload: project });

	const updated = await buildTemplateUpdateBody.call(
		{
			getNodeParameter: () => ({ name: 'Promo 2', ignored: true }),
			getNode: () => ({ name: 'Zvid' }),
		},
		{},
	);
	assert.deepEqual(updated.body, { name: 'Promo 2' });
});

test('repair wraps the AI-authored project in the API envelope', async () => {
	const { buildRepairBody } = require('../dist/nodes/Zvid/GenericFunctions.js');
	const project = { duration: 5, visuals: [{ type: 'TEXT', text: 'Hello' }] };
	const result = await buildRepairBody.call(
		{
			getNodeParameter: () => project,
			getNode: () => ({ name: 'Zvid' }),
		},
		{},
	);
	assert.deepEqual(result.body, { payload: project });
});

test('normalizeValidationResponse maps 200 and 400 into a branchable item', async () => {
	const { normalizeValidationResponse } = require('../dist/nodes/Zvid/GenericFunctions.js');

	const ok = await normalizeValidationResponse.call(
		{},
		[{ json: { valid: true, creditsRequired: 3, payload: { type: 'video' } } }],
		{ statusCode: 200 },
	);
	assert.equal(ok[0].json.valid, true);
	assert.equal(ok[0].json.creditsRequired, 3);

	const bad = await normalizeValidationResponse.call(
		{},
		[
			{
				json: {
					error: 'Validation failed',
					message: 'Please check your input and try again',
					details: [{ field: 'visuals[0].src', message: '"src" is required' }],
					planLimits: { maxDuration: 300 },
				},
			},
		],
		{ statusCode: 400 },
	);
	assert.equal(bad[0].json.valid, false);
	assert.equal(bad[0].json.errors.length, 1);
	assert.equal(bad[0].json.errors[0].field, 'visuals[0].src');
	assert.equal(bad[0].json.planLimits.maxDuration, 300);
});

test('credentials send X-Api-Key and test against /api/credits/balance', () => {
	const cred = new ZvidApi();
	assert.equal(cred.name, 'zvidApi');
	assert.equal(cred.authenticate.properties.headers['X-Api-Key'], '={{$credentials.apiKey}}');
	assert.equal(cred.test.request.url, '/api/credits/balance');
});

test('trigger registers webhook lifecycle methods', () => {
	const trigger = new ZvidTrigger();
	assert.equal(trigger.description.name, 'zvidTrigger');
	const methods = trigger.webhookMethods.default;
	for (const fn of ['checkExists', 'create', 'delete']) {
		assert.equal(typeof methods[fn], 'function');
	}
});

function triggerContext({ secret, body, signature, timestamp, events }) {
	const raw = JSON.stringify(body);
	const statusCalls = [];
	return {
		ctx: {
			getRequestObject: () => ({
				headers: {
					'x-zvid-signature': signature,
					'x-zvid-timestamp': timestamp,
				},
				rawBody: Buffer.from(raw, 'utf8'),
			}),
			getResponseObject: () => ({
				status: (code) => {
					statusCalls.push(code);
					return { send: () => {} };
				},
			}),
			getBodyData: () => body,
			getNodeParameter: (name, fallback) => {
				if (name === 'verifySignature') return true;
				if (name === 'events') return events;
				return fallback;
			},
			getWorkflowStaticData: () => ({ webhookId: 'whk_x', webhookSecret: secret }),
			helpers: { returnJsonArray: (data) => [{ json: data }] },
		},
		statusCalls,
	};
}

test('trigger accepts a correctly signed delivery', async () => {
	const secret = 'whsec_test';
	const timestamp = '1700000000';
	const body = { event: 'render.completed', jobId: 'j1', data: { url: 'https://cdn/x.mp4' } };
	const signature =
		'sha256=' +
		createHmac('sha256', secret)
			.update(`${timestamp}.${JSON.stringify(body)}`)
			.digest('hex');

	const { ctx, statusCalls } = triggerContext({
		secret,
		body,
		signature,
		timestamp,
		events: ['render.completed'],
	});
	const result = await new ZvidTrigger().webhook.call(ctx);
	assert.equal(statusCalls.length, 0);
	assert.equal(result.workflowData[0][0].json.jobId, 'j1');
});

test('trigger rejects a tampered delivery with 401', async () => {
	const secret = 'whsec_test';
	const timestamp = '1700000000';
	const body = { event: 'render.completed', jobId: 'j1' };
	const signature =
		'sha256=' +
		createHmac('sha256', 'wrong-secret')
			.update(`${timestamp}.${JSON.stringify(body)}`)
			.digest('hex');

	const { ctx, statusCalls } = triggerContext({
		secret,
		body,
		signature,
		timestamp,
		events: ['render.completed'],
	});
	const result = await new ZvidTrigger().webhook.call(ctx);
	assert.deepEqual(statusCalls, [401]);
	assert.equal(result.noWebhookResponse, true);
});

test('trigger rejects a malformed signature with 401', async () => {
	const { ctx, statusCalls } = triggerContext({
		secret: 'whsec_test',
		body: { event: 'render.completed', jobId: 'j1' },
		signature: `sha256=${'z'.repeat(64)}`,
		timestamp: '1700000000',
		events: ['render.completed'],
	});

	const result = await new ZvidTrigger().webhook.call(ctx);
	assert.deepEqual(statusCalls, [401]);
	assert.equal(result.noWebhookResponse, true);
});

test('trigger drops events the node is not subscribed to', async () => {
	const secret = 'whsec_test';
	const timestamp = '1700000000';
	const body = { event: 'render.failed', jobId: 'j2' };
	const signature =
		'sha256=' +
		createHmac('sha256', secret)
			.update(`${timestamp}.${JSON.stringify(body)}`)
			.digest('hex');

	const { ctx } = triggerContext({
		secret,
		body,
		signature,
		timestamp,
		events: ['render.completed'],
	});
	const result = await new ZvidTrigger().webhook.call(ctx);
	assert.equal(result.workflowData, undefined);
});
