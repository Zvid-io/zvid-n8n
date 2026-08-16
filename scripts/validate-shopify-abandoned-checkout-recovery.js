const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const workflowPath = path.join(root, 'workflows', 'zvid-shopify-abandoned-checkout-recovery.json');
const raw = fs.readFileSync(workflowPath, 'utf8');
const workflow = JSON.parse(raw);
const nodes = workflow.nodes || [];
const functional = nodes.filter((entry) => entry.type !== 'n8n-nodes-base.stickyNote');
const stickies = nodes.filter((entry) => entry.type === 'n8n-nodes-base.stickyNote');
const nodeByName = new Map(nodes.map((entry) => [entry.name, entry]));

assert.strictEqual(workflow.active, false, 'Workflow must be inactive on import');
assert.deepStrictEqual(workflow.settings, { executionOrder: 'v1' });
assert.strictEqual(new Set(nodes.map((entry) => entry.name)).size, nodes.length, 'Node names must be unique');
assert.strictEqual(new Set(nodes.map((entry) => entry.id)).size, nodes.length, 'Node IDs must be unique');
assert.strictEqual(functional.filter((entry) => entry.credentials).length, 0, 'Publishable JSON must not include credentials');
assert.strictEqual(
  functional.filter((entry) => !(entry.type.startsWith('n8n-nodes-base.') || entry.type === '@zvid/n8n-nodes-zvid.zvid')).length,
  0,
  'Only built-in n8n nodes and the published Zvid action node are allowed',
);
assert(!/CUSTOM\.|(?<!@zvid\/)n8n-nodes-zvid|zvid-2|sagekozan70|menan/i.test(raw), 'Workflow contains a dev node prefix or personal identifier');
assert(!/client_secret\s*[=:]\s*["'][^"']+/i.test(raw), 'Workflow contains a hardcoded client secret');

const expectedZvidOperations = {
  'Validate project (free)': ['render', 'validate'],
  'Save draft to editor': ['project', 'create'],
  'Submit render': ['render', 'create'],
  'Get render status': ['render', 'get'],
};
for (const [name, [resource, operation]] of Object.entries(expectedZvidOperations)) {
  const entry = nodeByName.get(name);
  assert(entry, `Missing official Zvid node: ${name}`);
  assert.strictEqual(entry.type, '@zvid/n8n-nodes-zvid.zvid', `${name} must use the official Zvid node`);
  assert.strictEqual(entry.parameters.resource, resource, `${name} must use resource ${resource}`);
  assert.strictEqual(entry.parameters.operation, operation, `${name} must use operation ${operation}`);
}
const zvidHttpNodes = functional.filter((entry) =>
  entry.type === 'n8n-nodes-base.httpRequest' &&
  /api\.zvid\.io|apiUrl|\/api\/(?:render|projects|jobs)/i.test(JSON.stringify(entry.parameters)),
);
assert.strictEqual(zvidHttpNodes.length, 0, `Zvid API must not use HTTP Request nodes: ${zvidHttpNodes.map((entry) => entry.name).join(', ')}`);

for (const [source, outputs] of Object.entries(workflow.connections || {})) {
  assert(nodeByName.has(source), `Connection source does not exist: ${source}`);
  for (const channel of outputs.main || []) {
    for (const edge of channel || []) assert(nodeByName.has(edge.node), `Broken connection: ${source} -> ${edge.node}`);
  }
}

const triggerNames = functional.filter((entry) => /Trigger$/.test(entry.type)).map((entry) => entry.name);
const reachable = new Set(triggerNames);
const queue = [...triggerNames];
while (queue.length) {
  const name = queue.shift();
  const connection = workflow.connections[name];
  for (const channel of (connection && connection.main) || []) {
    for (const edge of channel || []) {
      if (!reachable.has(edge.node)) {
        reachable.add(edge.node);
        queue.push(edge.node);
      }
    }
  }
}
for (const entry of functional) assert(reachable.has(entry.name), `Functional node is unreachable: ${entry.name}`);

const codeNodes = functional.filter((entry) => entry.type === 'n8n-nodes-base.code');
for (const entry of codeNodes) new Function(entry.parameters.jsCode);

const countWords = (text) => String(text || '').trim().split(/\s+/).filter(Boolean).length;
const overview = stickies.filter((entry) => entry.parameters.color === undefined);
assert.strictEqual(overview.length, 1, 'Exactly one default yellow overview sticky is required');
const overviewWords = countWords(overview[0].parameters.content);
assert(overviewWords >= 100 && overviewWords <= 300, `Overview must be 100-300 words, got ${overviewWords}`);
const sectionNotes = stickies.filter((entry) => /^### \d\./.test(entry.parameters.content));
for (const entry of sectionNotes) assert(countWords(entry.parameters.content) < 50, `${entry.name} must be under 50 words`);

const config = JSON.parse(nodeByName.get('Config').parameters.jsonOutput);
assert.strictEqual(config.shopDomain, 'your-store');
assert.strictEqual(config.shopifyApiVersion, '2026-07');
assert.strictEqual(config.manualFixture, true);
assert.strictEqual(config.dryRun, true);
assert.strictEqual(config.sendEmail, false);
assert.strictEqual(config.testFixture.email, 'alex@example.com');
assert.strictEqual(config.testFixture.items[0].title, 'Clay Pocket Oversized Tee');
assert.strictEqual(config.testFixture.items[0].variantTitle, 'M');
assert.strictEqual(config.testFixture.items[0].price, '35.00');
assert(/^https:\/\/cdn\.shopify\.com\//.test(config.testFixture.items[0].imageUrl), 'Fixture must exercise a Shopify CDN product image');
assert(raw.includes('https://app.zvid.io/api-keys'));
assert(raw.includes('https://api.zvid.io'));
assert(raw.includes('https://editor.zvid.io'));
assert(raw.includes('@zvid/n8n-nodes-zvid'));
assert(raw.includes('Settings -> Community nodes'));
assert(raw.includes('workspace owner or admin'));
assert(raw.includes('read_orders') && raw.includes('read_customers') && raw.includes('read_products'));
assert(raw.includes('abandonedCheckouts(first: $first'));
assert(raw.includes('abandonmentByAbandonedCheckoutId'));
assert(!raw.includes('checkouts.json'));

function executeCode(name, inputItems, lookup = {}, staticData = {}) {
  const entry = nodeByName.get(name);
  assert(entry && entry.type === 'n8n-nodes-base.code', `Missing code node: ${name}`);
  const items = inputItems.map((json) => ({ json }));
  const inputApi = { first: () => items[0], all: () => items };
  const lookupApi = (lookupName) => {
    const value = lookup[lookupName];
    const values = Array.isArray(value) ? value : [value];
    return {
      first: () => ({ json: values[0] }),
      all: () => values.map((json) => ({ json })),
    };
  };
  const fn = new Function('$input', '$', '$getWorkflowStaticData', entry.parameters.jsCode);
  return fn(inputApi, lookupApi, () => staticData);
}

const fixtureResult = executeCode('Create safe test checkout', [{}], { Config: config }, {});
assert.strictEqual(fixtureResult[0].json.found, true);
assert.strictEqual(fixtureResult[0].json.isFixture, true);
assert.strictEqual(fixtureResult[0].json.items.length, 1);
assert.strictEqual(fixtureResult[0].json.items[0].title, 'Clay Pocket Oversized Tee');
assert(/^https:\/\/cdn\.shopify\.com\//.test(fixtureResult[0].json.items[0].imageUrl));

const checkout = {
  id: 'gid://shopify/AbandonedCheckout/123',
  name: '#123',
  createdAt: '2026-08-14T08:00:00Z',
  updatedAt: '2026-08-14T08:00:00Z',
  completedAt: null,
  abandonedCheckoutUrl: 'https://example.myshopify.com/checkouts/recover/123',
  customer: {
    displayName: 'Alex Test',
    firstName: 'Alex',
    defaultEmailAddress: { emailAddress: 'alex@example.com' },
    defaultPhoneNumber: { phoneNumber: '+15555550123' },
  },
  totalPriceSet: { shopMoney: { amount: '35.00', currencyCode: 'USD' } },
  lineItems: { nodes: [{
    id: 'gid://shopify/AbandonedCheckoutLineItem/1',
    title: 'Classic Oversized Tee',
    variantTitle: 'M',
    quantity: 1,
    image: { url: 'https://cdn.example.com/product.png', altText: 'Product' },
    product: { id: 'gid://shopify/Product/1', title: 'Classic Oversized Tee', status: 'ACTIVE' },
    variant: { id: 'gid://shopify/ProductVariant/1', title: 'M', availableForSale: true, sellableOnlineQuantity: 10, price: '35.00' },
    discountedTotalPriceSet: { shopMoney: { amount: '35.00', currencyCode: 'USD' } },
  }] },
};
const apiResponse = { statusCode: 200, body: { data: { abandonedCheckouts: { pageInfo: { hasNextPage: false }, nodes: [checkout] } } } };
const staticData = {};
const picked = executeCode('Pick and lock one checkout', [apiResponse], { Config: config }, staticData)[0].json;
assert.strictEqual(picked.found, true);
assert.strictEqual(picked.checkoutId, checkout.id);
assert.strictEqual(picked.items[0].imageUrl, 'https://cdn.example.com/product.png');
assert(staticData.inFlightCheckouts[checkout.id], 'Checkout must be locked');
const duplicate = executeCode('Pick and lock one checkout', [apiResponse], { Config: config }, staticData)[0].json;
assert.strictEqual(duplicate.found, false, 'A locked checkout must not be selected twice');
assert.throws(() => executeCode('Pick and lock one checkout', [{ statusCode: 401, body: { errors: 'Unauthorized' } }], { Config: config }, {}), /HTTP 401/);

const eligibleConfirmation = {
  statusCode: 200,
  body: { data: { abandonmentByAbandonedCheckoutId: {
    customerHasNoOrderSinceAbandonment: true,
    customerHasNoDraftOrderSinceAbandonment: true,
    inventoryAvailable: true,
    emailSentAt: null,
    emailState: 'NOT_SENT',
    hoursSinceLastAbandonedCheckout: 1.2,
    isMostSignificantAbandonment: true,
    abandonedCheckoutPayload: { completedAt: null },
  } } },
};
const eligible = executeCode('Check conversion and inventory', [eligibleConfirmation], { Config: config, 'Wait before recovery check': picked }, staticData)[0].json;
assert.strictEqual(eligible.eligible, true);
const convertedStatic = { inFlightCheckouts: { [checkout.id]: Date.now() } };
const convertedResponse = JSON.parse(JSON.stringify(eligibleConfirmation));
convertedResponse.body.data.abandonmentByAbandonedCheckoutId.customerHasNoOrderSinceAbandonment = false;
const converted = executeCode('Check conversion and inventory', [convertedResponse], { Config: config, 'Wait before recovery check': picked }, convertedStatic)[0].json;
assert.strictEqual(converted.eligible, false);
assert(converted.eligibilityReasons.some((reason) => /completed an order/.test(reason)));
assert.strictEqual(convertedStatic.inFlightCheckouts[checkout.id], undefined, 'Ineligible checkout lock must be cleared');

const fixtureCart = fixtureResult[0].json;
const built = executeCode('Build personalized recovery video', [fixtureCart], { Config: config }, {})[0].json;
assert.strictEqual(built.payload.scenes.length, 3);
assert.strictEqual(built.meta.email, 'alex@example.com');
assert(!JSON.stringify(built.payload).includes('alex@example.com'), 'Email must never enter the video payload');
assert(!JSON.stringify(built.payload).includes('+15555550123'), 'Phone must never enter the video payload');
assert(!built.payload.name.includes('@'));
const checked = executeCode('Check validation', [{ valid: true, payload: built.payload, creditsRequired: 42, warnings: [], schemaVersion: 'test' }], { 'Build personalized recovery video': built }, {})[0].json;
assert.strictEqual(checked.creditsRequired, 42);
assert.strictEqual(checked.payload, built.payload);
assert.throws(
  () => executeCode('Check validation', [{ valid: false, errors: [{ field: 'scenes[0]', message: 'is invalid' }] }], { 'Build personalized recovery video': built }, {}),
  /scenes\[0\]: is invalid/,
);

const followUpOpen = executeCode('Check follow-up conversion', [eligibleConfirmation], { 'Record initial delivery result': { videoUrl: 'https://cdn.example.com/video.mp4' } }, {})[0].json;
assert.strictEqual(followUpOpen.stillAbandoned, true);
const followUpConverted = executeCode('Check follow-up conversion', [convertedResponse], { 'Record initial delivery result': { videoUrl: 'https://cdn.example.com/video.mp4' } }, {})[0].json;
assert.strictEqual(followUpConverted.stillAbandoned, false);

console.log(JSON.stringify({
  workflow: workflow.name,
  totalNodes: nodes.length,
  functionalNodes: functional.length,
  stickyNotes: stickies.length,
  codeNodesCompiled: codeNodes.length,
  overviewWords,
  sectionWordCounts: sectionNotes.map((entry) => countWords(entry.parameters.content)),
  graphReachable: functional.length,
  credentialsEmbedded: 0,
  nodeTypes: [...new Set(functional.map((entry) => entry.type))].sort(),
  tests: {
    fixtureNormalization: 'passed',
    realProductFixture: 'passed',
    checkoutLocking: 'passed',
    duplicateSuppression: 'passed',
    unauthorizedShopifyError: 'passed',
    conversionAndInventoryGate: 'passed',
    convertedCheckoutStops: 'passed',
    officialZvidNodeOperations: 'passed',
    nativeValidationNormalization: 'passed',
    videoPayloadPrivacy: 'passed',
    followUpConversionGate: 'passed',
  },
}, null, 2));
