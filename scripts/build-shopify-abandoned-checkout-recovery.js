const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, 'workflows', 'zvid-abandoned-cart-video.json');
const outputPath = path.join(root, 'workflows', 'zvid-shopify-abandoned-checkout-recovery.json');
const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));

const cloneNode = (name, newName = name) => {
  const original = source.nodes.find((entry) => entry.name === name);
  if (!original) throw new Error(`Missing source node: ${name}`);
  const copy = JSON.parse(JSON.stringify(original));
  copy.name = newName;
  delete copy.credentials;
  delete copy.webhookId;
  return copy;
};

const node = (name, type, position, parameters, extra = {}) => ({
  parameters,
  type,
  typeVersion: extra.typeVersion || ({
    'n8n-nodes-base.code': 2,
    'n8n-nodes-base.if': 2.2,
    'n8n-nodes-base.httpRequest': 4.2,
    'n8n-nodes-base.set': 3.4,
    'n8n-nodes-base.stickyNote': 1,
    'n8n-nodes-base.wait': 1.1,
  }[type] || 1),
  position,
  id: extra.id,
  name,
  ...Object.fromEntries(Object.entries(extra).filter(([key]) => !['id', 'typeVersion'].includes(key))),
});

const ifNode = (name, position, expression, id) => node(name, 'n8n-nodes-base.if', position, {
  conditions: {
    options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
    conditions: [{
      id: `${id}-condition`,
      leftValue: expression,
      rightValue: '',
      operator: { type: 'boolean', operation: 'true', singleValue: true },
    }],
    combinator: 'and',
  },
  looseTypeValidation: true,
  options: {},
}, { id });

const sticky = (id, name, position, width, height, content, color) => {
  const parameters = { content, height, width };
  if (color !== undefined) parameters.color = color;
  return node(name, 'n8n-nodes-base.stickyNote', position, parameters, { id, typeVersion: 1 });
};

const manual = cloneNode('Test manually');
manual.id = 'zvid-sac-0001';
manual.position = [-1700, 300];

const schedule = cloneNode('Every hour', 'Every 15 minutes');
schedule.id = 'zvid-sac-0002';
schedule.position = [-1700, 500];
schedule.parameters = { rule: { interval: [{ field: 'minutes', minutesInterval: 15 }] } };

const config = node('Config', 'n8n-nodes-base.set', [-1480, 400], {
  mode: 'raw',
  jsonOutput: JSON.stringify({
    editorUrl: 'https://editor.zvid.io',
    shopDomain: 'your-store',
    shopifyApiVersion: '2026-07',
    checkoutQuery: 'recovery_state:not_recovered status:open',
    scanLimit: 20,
    recoveryWaitMinutes: 60,
    followUpEnabled: true,
    followUpWaitMinutes: 720,
    skipIfShopifyAlreadyEmailed: true,
    lockTtlHours: 48,
    brandName: 'YOUR BRAND',
    storeUrl: 'your-store.myshopify.com',
    brandBackground: '#12100E',
    brandAccent: '#E2714B',
    accentSoft: '#F0B08C',
    creamColor: '#F6F1E9',
    mutedColor: '#9C948A',
    headingFont: 'Sora',
    accentFont: 'Fraunces',
    uiFont: 'DM Sans',
    currencySymbol: '$',
    hookLine: 'you left something behind.',
    hookNote: 'Your cart is still saved - for now.',
    cartKicker: 'STILL IN YOUR CART',
    cartNote: 'We saved your cart. Nothing stays reserved forever.',
    totalLabel: 'YOUR CART TOTAL',
    ctaText: 'Complete your order',
    ctaSubline: 'Pick up exactly where you left off.',
    resolution: 'instagram-reel',
    frameRate: 30,
    musicUrl: '',
    musicVolume: 0.16,
    dryRun: true,
    sendEmail: false,
    emailFrom: 'hello@your-store.com',
    emailSubject: '{firstName}, your cart is still saved',
    emailIntro: 'We kept your cart exactly where you left it. Here is a quick look at what is waiting.',
    emailButtonText: 'Complete your order',
    followUpSubject: '{firstName}, one last look at your saved cart',
    followUpIntro: 'Your saved checkout is still open. Complete it while the products are available.',
    pollSeconds: 10,
    timeoutMinutes: 20,
    manualFixture: true,
    testWaitSeconds: 2,
    testFollowUpInFixture: true,
    testFollowUpSeconds: 2,
    testFixtureEligible: true,
    testFixtureRecoveredBeforeFollowUp: true,
    testFixture: {
      checkoutId: 'gid://shopify/AbandonedCheckout/TEST',
      checkoutName: '#TEST',
      firstName: 'Alex',
      email: 'alex@example.com',
      phone: '+15555550123',
      recoveryUrl: 'https://your-store.myshopify.com',
      totalPrice: '35.00',
      items: [{
        title: 'Clay Pocket Oversized Tee',
        variantTitle: 'M',
        quantity: 1,
        price: '35.00',
        imageUrl: 'https://cdn.shopify.com/s/files/1/0738/3888/6956/files/terracotta-pocket-hero.png?v=1786110389',
      }],
    },
  }, null, 2),
  options: {},
}, { id: 'zvid-sac-0003' });

const useFixture = ifNode('Use manual fixture?', [-1260, 400], "={{ $('Config').first().json.manualFixture === true }}", 'zvid-sac-0004');

const fixture = node('Create safe test checkout', 'n8n-nodes-base.code', [-1040, 220], {
  jsCode: String.raw`const cfg = $('Config').first().json;
const fixture = cfg.testFixture || {};
const items = Array.isArray(fixture.items) ? fixture.items : [];
if (!items.length || !items.some((item) => String(item.title || '').trim())) {
  throw new Error('Config.testFixture needs at least one item with a title.');
}
return [{ json: {
  found: true,
  isFixture: true,
  source: 'fixture',
  checkoutId: String(fixture.checkoutId || 'gid://shopify/AbandonedCheckout/TEST'),
  checkoutName: String(fixture.checkoutName || '#TEST'),
  firstName: String(fixture.firstName || 'Alex').slice(0, 24),
  email: String(fixture.email || 'alex@example.com'),
  phone: String(fixture.phone || ''),
  checkoutUrl: String(fixture.recoveryUrl || 'https://your-store.myshopify.com'),
  totalPrice: String(fixture.totalPrice || ''),
  items: items.slice(0, 3).map((item) => ({
    title: String(item.title || '').trim(),
    variantTitle: String(item.variantTitle || '').trim(),
    quantity: Math.max(1, Number(item.quantity || 1)),
    price: String(item.price || '').trim(),
    imageUrl: /^https?:\/\//i.test(String(item.imageUrl || '')) ? String(item.imageUrl) : '',
  })),
  cartRef: 'fixture-' + Date.now(),
  detectedAt: new Date().toISOString(),
} }];`,
}, { id: 'zvid-sac-0005' });

const candidateQuery = `query AbandonedCheckoutCandidates($first: Int!, $query: String!) {
  abandonedCheckouts(first: $first, query: $query, sortKey: CREATED_AT, reverse: true) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id name createdAt updatedAt completedAt abandonedCheckoutUrl
      customer {
        id displayName firstName
        defaultEmailAddress { emailAddress }
        defaultPhoneNumber { phoneNumber }
      }
      totalPriceSet { shopMoney { amount currencyCode } }
      lineItems(first: 5) {
        nodes {
          id title variantTitle quantity
          image { url altText }
          product { id title handle status }
          variant { id title availableForSale sellableOnlineQuantity price }
          discountedTotalPriceSet { shopMoney { amount currencyCode } }
        }
      }
    }
  }
}`;

const findCheckouts = node('Find open abandoned checkouts', 'n8n-nodes-base.httpRequest', [-1040, 560], {
  method: 'POST',
  url: "={{ 'https://' + $('Config').first().json.shopDomain + '.myshopify.com/admin/api/' + $('Config').first().json.shopifyApiVersion + '/graphql.json' }}",
  authentication: 'genericCredentialType',
  genericAuthType: 'httpHeaderAuth',
  sendBody: true,
  specifyBody: 'json',
  jsonBody: `={{ JSON.stringify({ query: ${JSON.stringify(candidateQuery)}, variables: { first: Math.min(50, Math.max(1, Number($('Config').first().json.scanLimit || 20))), query: String($('Config').first().json.checkoutQuery || 'recovery_state:not_recovered status:open') } }) }}`,
  options: { response: { response: { fullResponse: true, neverError: true } }, timeout: 60000 },
}, { id: 'zvid-sac-0006', retryOnFail: true, maxTries: 3, waitBetweenTries: 5000 });

const pickCheckout = node('Pick and lock one checkout', 'n8n-nodes-base.code', [-820, 560], {
  jsCode: String.raw`const cfg = $('Config').first().json;
const response = $input.first().json || {};
const status = Number(response.statusCode || 0);
const body = response.body === undefined ? response : response.body;
if (!status) throw new Error('Shopify returned no HTTP response. Check shopDomain and the Header Auth credential.');
if (status !== 200) {
  const detail = JSON.stringify(body).slice(0, 700);
  if (status === 401) {
    throw new Error('Shopify rejected the access token (HTTP 401). Use the returned access_token, not the Client ID or Client secret. Also set Config.shopDomain to the canonical subdomain shown in Shopify Settings -> Domains; an Admin URL handle or redirecting alias can drop X-Shopify-Access-Token. Response: ' + detail);
  }
  throw new Error('Shopify abandoned checkout query failed (HTTP ' + status + '): ' + detail);
}
if (Array.isArray(body.errors) && body.errors.length) throw new Error('Shopify GraphQL error: ' + body.errors.map((error) => error.message).join('; '));
const connection = body.data && body.data.abandonedCheckouts;
const checkouts = connection && Array.isArray(connection.nodes) ? connection.nodes : [];
const clean = (value) => String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
const store = $getWorkflowStaticData('global');
if (!Array.isArray(store.handledCheckoutIds)) store.handledCheckoutIds = [];
if (!store.inFlightCheckouts || typeof store.inFlightCheckouts !== 'object') store.inFlightCheckouts = {};
const handled = new Set(store.handledCheckoutIds.map(String));
const now = Date.now();
const lockTtl = Math.max(1, Number(cfg.lockTtlHours || 48)) * 3600000;
for (const [id, timestamp] of Object.entries(store.inFlightCheckouts)) {
  if (!Number(timestamp) || now - Number(timestamp) > lockTtl) delete store.inFlightCheckouts[id];
}
const skipped = [];
let selected = null;
for (const checkout of checkouts) {
  const customer = checkout.customer || {};
  const email = clean(customer.defaultEmailAddress && customer.defaultEmailAddress.emailAddress);
  const lines = checkout.lineItems && Array.isArray(checkout.lineItems.nodes) ? checkout.lineItems.nodes : [];
  let reason = null;
  if (checkout.completedAt) reason = 'already completed';
  else if (!email.includes('@')) reason = 'missing customer email';
  else if (!clean(checkout.abandonedCheckoutUrl).startsWith('http')) reason = 'missing recovery URL';
  else if (!lines.length) reason = 'no line items';
  else if (handled.has(String(checkout.id))) reason = 'already handled by this workflow';
  else if (store.inFlightCheckouts[String(checkout.id)]) reason = 'another execution is already waiting on it';
  if (reason) { skipped.push({ checkoutId: checkout.id, checkoutName: checkout.name, reason }); continue; }
  selected = checkout;
  break;
}
if (!selected) return [{ json: { found: false, source: 'shopify', checked: checkouts.length, skipped, morePages: Boolean(connection && connection.pageInfo && connection.pageInfo.hasNextPage) } }];
store.inFlightCheckouts[String(selected.id)] = now;
const customer = selected.customer || {};
const money = selected.totalPriceSet && selected.totalPriceSet.shopMoney || {};
const lines = selected.lineItems.nodes.slice(0, 3);
return [{ json: {
  found: true,
  isFixture: false,
  source: 'shopify',
  checkoutId: selected.id,
  checkoutName: selected.name,
  firstName: clean(customer.firstName || clean(customer.displayName).split(' ')[0]).slice(0, 24),
  email: clean(customer.defaultEmailAddress && customer.defaultEmailAddress.emailAddress),
  phone: clean(customer.defaultPhoneNumber && customer.defaultPhoneNumber.phoneNumber),
  checkoutUrl: clean(selected.abandonedCheckoutUrl),
  totalPrice: clean(money.amount),
  currencyCode: clean(money.currencyCode),
  items: lines.map((line) => {
    const lineMoney = line.discountedTotalPriceSet && line.discountedTotalPriceSet.shopMoney || {};
    return {
      title: clean(line.title || (line.product && line.product.title)),
      variantTitle: clean(line.variantTitle || (line.variant && line.variant.title)),
      quantity: Math.max(1, Number(line.quantity || 1)),
      price: clean(lineMoney.amount || (line.variant && line.variant.price)),
      imageUrl: clean(line.image && line.image.url),
      productId: line.product && line.product.id,
      variantId: line.variant && line.variant.id,
    };
  }),
  cartRef: 'checkout-' + String(selected.id).split('/').pop(),
  detectedAt: new Date().toISOString(),
  checked: checkouts.length,
  skipped,
} }];`,
}, { id: 'zvid-sac-0007' });

const checkoutFound = ifNode('Checkout found?', [-580, 400], '={{ $json.found === true }}', 'zvid-sac-0008');

const nothing = node('Nothing to recover', 'n8n-nodes-base.code', [-360, 620], {
  jsCode: "const result = $input.first().json; return [{ json: { recovered: false, rendered: false, reason: 'No eligible open abandoned checkout was found.', checked: result.checked || 0, skipped: result.skipped || [], morePages: Boolean(result.morePages) } }];",
}, { id: 'zvid-sac-0009' });

const waitRecovery = node('Wait before recovery check', 'n8n-nodes-base.wait', [-360, 220], {
  amount: "={{ $json.isFixture ? $('Config').first().json.testWaitSeconds : Number($('Config').first().json.recoveryWaitMinutes || 60) * 60 }}",
  unit: 'seconds',
}, { id: 'zvid-sac-0010', typeVersion: 1.1 });

const fixtureConfirmation = ifNode('Use fixture confirmation?', [-140, 220], '={{ $json.isFixture === true }}', 'zvid-sac-0011');

const approveFixture = node('Approve checkout test fixture', 'n8n-nodes-base.code', [80, 60], {
  jsCode: "const cfg = $('Config').first().json; return $input.all().map((item) => ({ json: { ...item.json, eligible: cfg.testFixtureEligible !== false, eligibilityReasons: cfg.testFixtureEligible === false ? ['fixture configured as ineligible'] : [] } }));",
}, { id: 'zvid-sac-0012' });

const confirmQuery = `query ConfirmAbandonedCheckout($id: ID!) {
  abandonmentByAbandonedCheckoutId(abandonedCheckoutId: $id) {
    id customerHasNoOrderSinceAbandonment customerHasNoDraftOrderSinceAbandonment
    inventoryAvailable emailSentAt emailState hoursSinceLastAbandonedCheckout
    isMostSignificantAbandonment
    abandonedCheckoutPayload { id completedAt abandonedCheckoutUrl }
  }
}`;

const confirmAbandonment = node('Confirm no purchase and inventory', 'n8n-nodes-base.httpRequest', [80, 360], {
  method: 'POST',
  url: "={{ 'https://' + $('Config').first().json.shopDomain + '.myshopify.com/admin/api/' + $('Config').first().json.shopifyApiVersion + '/graphql.json' }}",
  authentication: 'genericCredentialType',
  genericAuthType: 'httpHeaderAuth',
  sendBody: true,
  specifyBody: 'json',
  jsonBody: `={{ JSON.stringify({ query: ${JSON.stringify(confirmQuery)}, variables: { id: $('Wait before recovery check').first().json.checkoutId } }) }}`,
  options: { response: { response: { fullResponse: true, neverError: true } }, timeout: 60000 },
}, { id: 'zvid-sac-0013', retryOnFail: true, maxTries: 3, waitBetweenTries: 5000 });

const checkEligibility = node('Check conversion and inventory', 'n8n-nodes-base.code', [300, 360], {
  jsCode: String.raw`const cfg = $('Config').first().json;
const candidate = $('Wait before recovery check').first().json;
const response = $input.first().json || {};
const status = Number(response.statusCode || 0);
const body = response.body === undefined ? response : response.body;
if (!status) throw new Error('Shopify returned no confirmation response.');
if (status !== 200) throw new Error('Shopify confirmation failed (HTTP ' + status + '): ' + JSON.stringify(body).slice(0, 700));
if (Array.isArray(body.errors) && body.errors.length) throw new Error('Shopify GraphQL error: ' + body.errors.map((error) => error.message).join('; '));
const abandonment = body.data && body.data.abandonmentByAbandonedCheckoutId;
const reasons = [];
if (!abandonment) reasons.push('abandonment no longer exists or is not accessible');
else {
  if (!abandonment.customerHasNoOrderSinceAbandonment) reasons.push('customer completed an order after abandoning');
  if (!abandonment.customerHasNoDraftOrderSinceAbandonment) reasons.push('customer has a draft order after abandoning');
  if (!abandonment.inventoryAvailable) reasons.push('one or more checkout items are unavailable');
  if (!abandonment.isMostSignificantAbandonment) reasons.push('a newer customer abandonment superseded this checkout');
  if (abandonment.abandonedCheckoutPayload && abandonment.abandonedCheckoutPayload.completedAt) reasons.push('checkout is completed');
  if (cfg.skipIfShopifyAlreadyEmailed === true && abandonment.emailSentAt) reasons.push('Shopify already sent an abandonment email');
}
const eligible = reasons.length === 0;
if (!eligible) {
  const store = $getWorkflowStaticData('global');
  if (store.inFlightCheckouts) delete store.inFlightCheckouts[String(candidate.checkoutId)];
}
return [{ json: { ...candidate, eligible, eligibilityReasons: reasons, confirmation: abandonment ? { inventoryAvailable: abandonment.inventoryAvailable, emailState: abandonment.emailState, emailSentAt: abandonment.emailSentAt, hoursSinceLastAbandonedCheckout: abandonment.hoursSinceLastAbandonedCheckout } : null } }];`,
}, { id: 'zvid-sac-0014' });

const stillEligible = ifNode('Still eligible after the wait?', [540, 220], '={{ $json.eligible === true }}', 'zvid-sac-0015');

const stopBeforeRender = node('Stop recovered or unavailable checkout', 'n8n-nodes-base.code', [760, 500], {
  jsCode: "const item = $input.first().json; return [{ json: { rendered: false, checkoutId: item.checkoutId, checkoutName: item.checkoutName, stoppedSafely: true, reasons: item.eligibilityReasons || ['checkout is no longer eligible'] } }];",
}, { id: 'zvid-sac-0016' });

const sourceBuilder = cloneNode('Build project JSON');
const builderFunction = sourceBuilder.parameters.jsCode.split('// === n8n glue ===')[0];
const buildProject = node('Build personalized recovery video', 'n8n-nodes-base.code', [760, 120], {
  jsCode: builderFunction + String.raw`// === n8n glue ===
const config = $('Config').first().json;
const cart = $input.first().json;
const musicUrl = /^https?:\/\//i.test(String(config.musicUrl || '')) ? String(config.musicUrl) : '';
const built = buildProject(config, {
  firstName: cart.firstName,
  items: cart.items,
  totalPrice: cart.totalPrice,
  checkoutUrl: cart.checkoutUrl,
  cartRef: cart.cartRef,
  music: musicUrl ? { src: musicUrl } : null,
  musicNote: musicUrl ? 'configured' : 'no music configured',
});
Object.assign(built.meta, {
  checkoutId: cart.checkoutId || null,
  checkoutName: cart.checkoutName || null,
  source: cart.source || 'shopify',
  isFixture: Boolean(cart.isFixture),
  email: cart.email || null,
  phone: cart.phone || null,
  detectedAt: cart.detectedAt || null,
});
return [{ json: built }];`,
}, { id: 'zvid-sac-0017' });

const validate = node('Validate project (free)', '@zvid/n8n-nodes-zvid.zvid', [980, 120], {
  resource: 'render',
  operation: 'validate',
  source: 'json',
  projectJson: '={{ $json.payload }}',
  validationVariables: '{}',
  additionalFields: {},
}, { id: 'zvid-sac-0018', typeVersion: 1 });

const checkValidation = cloneNode('Check validation');
checkValidation.id = 'zvid-sac-0019';
checkValidation.position = [1200, 120];
checkValidation.parameters.jsCode = String.raw`const result = $input.first().json || {};
if (!result.valid) {
  const details = Array.isArray(result.errors)
    ? result.errors.map((entry) => '  - ' + (entry.field || 'project') + ': ' + entry.message).join('\n')
    : JSON.stringify(result).slice(0, 500);
  throw new Error('Zvid rejected the project: ' + (result.message || result.error || 'Validation failed') + '\n' + details);
}
const build = $('Build personalized recovery video').first().json;
return [{ json: {
  ...build,
  payload: result.payload || build.payload,
  creditsRequired: Number(result.creditsRequired) || 0,
  warnings: result.warnings || [],
  schemaVersion: result.schemaVersion,
} }];`;

const dryRun = cloneNode('Dry run?');
dryRun.id = 'zvid-sac-0020';
dryRun.position = [1420, 120];

const saveDraft = node('Save draft to editor', '@zvid/n8n-nodes-zvid.zvid', [1640, -40], {
  resource: 'project',
  operation: 'create',
  projectName: "={{ String($json.payload.name || ('Abandoned checkout ' + ($json.meta.checkoutName || $json.meta.checkoutId || 'preview'))).slice(0, 120) }}",
  projectJson: '={{ $json.payload }}',
}, {
  id: 'zvid-sac-0021',
  typeVersion: 1,
  onError: 'continueRegularOutput',
  alwaysOutputData: true,
  retryOnFail: true,
  maxTries: 3,
  waitBetweenTries: 5000,
});

const drySummary = node('Dry run summary', 'n8n-nodes-base.code', [1860, -40], {
  jsCode: String.raw`const cfg = $('Config').first().json;
const checked = $('Check validation').first().json;
const meta = checked.meta;
if (!meta.isFixture && meta.checkoutId) {
  const store = $getWorkflowStaticData('global');
  if (store.inFlightCheckouts) delete store.inFlightCheckouts[String(meta.checkoutId)];
}
let editorLink = null;
let editorDraftError = null;
try {
  const saved = $('Save draft to editor').first().json;
  if (saved.project && saved.project.id) editorLink = String(cfg.editorUrl).replace(/\/+$/, '') + '/?project=' + saved.project.id;
  if (saved.error) editorDraftError = String(saved.error.message || saved.error).slice(0, 500);
} catch (error) { editorDraftError = String(error.message || error).slice(0, 500); }
return [{ json: {
  dryRun: true,
  fixture: meta.isFixture,
  checkoutId: meta.checkoutId,
  checkoutName: meta.checkoutName,
  itemCount: meta.itemCount,
  items: meta.itemTitles,
  cartTotal: meta.totalDisplay,
  layout: meta.layout,
  videoSeconds: meta.totalSeconds,
  creditsRequired: checked.creditsRequired,
  warnings: checked.warnings,
  editorLink,
  editorDraftError,
  customerEmailExcludedFromVideo: true,
  nextStep: 'Review the editor draft and credit quote. Set dryRun to false only when the rendered video and optional email are approved.',
} }];`,
}, { id: 'zvid-sac-0022' });

const submit = node('Submit render', '@zvid/n8n-nodes-zvid.zvid', [1640, 300], {
  resource: 'render',
  operation: 'create',
  renderType: 'video',
  source: 'json',
  projectJson: '={{ $json.payload }}',
  waitForCompletion: false,
}, {
  id: 'zvid-sac-0023',
  typeVersion: 1,
  retryOnFail: true,
  maxTries: 3,
  waitBetweenTries: 5000,
});

const waitRender = cloneNode('Wait', 'Wait for render');
waitRender.id = 'zvid-sac-0024';
waitRender.position = [1860, 300];

const getStatus = node('Get render status', '@zvid/n8n-nodes-zvid.zvid', [2080, 300], {
  resource: 'render',
  operation: 'get',
  jobId: "={{ $('Submit render').first().json.jobId }}",
  waitForCompletion: false,
}, {
  id: 'zvid-sac-0025',
  typeVersion: 1,
  retryOnFail: true,
  maxTries: 3,
  waitBetweenTries: 5000,
});

const renderFinished = cloneNode('Render finished?');
renderFinished.id = 'zvid-sac-0026';
renderFinished.position = [2300, 300];

const stillRendering = cloneNode('Still rendering?');
stillRendering.id = 'zvid-sac-0027';
stillRendering.position = [2300, 520];

const prepareDelivery = node('Prepare private recovery delivery', 'n8n-nodes-base.code', [2520, 220], {
  jsCode: String.raw`const cfg = $('Config').first().json;
const build = $('Check validation').first().json;
const job = $input.first().json;
const meta = build.meta;
const videoUrl = typeof job.result === 'string' ? job.result : (job.result && job.result.url);
if (!videoUrl) throw new Error('The completed render returned no video URL (job ' + String(job.id || 'unknown') + ').');
const esc = (value) => String(value == null ? '' : value).replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
const firstName = String(meta.firstName || 'there');
const fill = (template) => String(template || '')
  .replace(/\{firstName\}/g, firstName)
  .replace(/\{brandName\}/g, String(cfg.brandName || ''))
  .replace(/\{total\}/g, String(meta.totalDisplay || ''))
  .replace(/\{itemCount\}/g, String(meta.itemCount || 0));
const safeCheckout = /^https?:\/\//i.test(String(meta.checkoutUrl || '')) ? String(meta.checkoutUrl) : '';
const bg = String(cfg.brandBackground || '#12100E');
const accent = String(cfg.brandAccent || '#E2714B');
const cream = String(cfg.creamColor || '#F6F1E9');
const muted = String(cfg.mutedColor || '#9C948A');
const rows = (meta.itemTitles || []).map((title) => '<li style="margin:6px 0">' + esc(title) + '</li>').join('');
const makeHtml = (intro) => '<div style="font-family:Arial,sans-serif;background:' + bg + ';color:' + cream + ';padding:36px;border-radius:18px;max-width:560px">' +
  '<p style="letter-spacing:3px;color:' + accent + ';font-size:12px;text-transform:uppercase">' + esc(cfg.brandName || 'Your store') + '</p>' +
  '<h1 style="font-size:28px">' + esc(firstName) + ', your cart is still saved.</h1>' +
  '<p style="color:' + muted + ';line-height:1.6">' + esc(fill(intro)) + '</p><ul>' + rows + '</ul>' +
  (meta.totalDisplay ? '<p style="font-size:22px;font-weight:bold">' + esc(meta.totalDisplay) + '</p>' : '') +
  (safeCheckout ? '<p><a href="' + esc(safeCheckout) + '" style="display:inline-block;background:' + accent + ';color:' + bg + ';padding:14px 28px;border-radius:999px;text-decoration:none;font-weight:bold">' + esc(cfg.emailButtonText || 'Complete your order') + '</a></p>' : '') +
  '<p><a href="' + esc(videoUrl) + '" style="color:' + accent + '">Watch your personalized cart video</a></p></div>';
return [{ json: {
  videoUrl,
  jobId: job.id,
  creditsCharged: build.creditsRequired,
  checkoutId: meta.checkoutId,
  checkoutName: meta.checkoutName,
  isFixture: meta.isFixture,
  email: meta.email,
  phone: meta.phone,
  firstName,
  checkoutUrl: meta.checkoutUrl,
  itemCount: meta.itemCount,
  items: meta.itemTitles,
  cartTotal: meta.totalDisplay,
  emailSubject: fill(cfg.emailSubject || '{firstName}, your cart is still saved'),
  emailHtml: makeHtml(cfg.emailIntro),
  followUpSubject: fill(cfg.followUpSubject || '{firstName}, one last look at your saved cart'),
  followUpHtml: makeHtml(cfg.followUpIntro),
} }];`,
}, { id: 'zvid-sac-0028' });

const sendInitial = ifNode('Send initial recovery email?', [2740, 220], "={{ $('Config').first().json.sendEmail === true && String($json.email || '').includes('@') }}", 'zvid-sac-0029');

const initialEmail = cloneNode('Send recovery email', 'Send initial recovery email');
initialEmail.id = 'zvid-sac-0030';
initialEmail.position = [2960, 60];
initialEmail.parameters.toEmail = "={{ $('Prepare private recovery delivery').first().json.email }}";
initialEmail.parameters.subject = "={{ $('Prepare private recovery delivery').first().json.emailSubject }}";
initialEmail.parameters.html = "={{ $('Prepare private recovery delivery').first().json.emailHtml }}";

const initialResult = node('Record initial delivery result', 'n8n-nodes-base.code', [3180, 220], {
  jsCode: String.raw`const cfg = $('Config').first().json;
const delivery = $('Prepare private recovery delivery').first().json;
let initialEmailSent = false;
let initialEmailError = null;
if (cfg.sendEmail === true && String(delivery.email || '').includes('@')) {
  try {
    const result = $('Send initial recovery email').first().json;
    initialEmailSent = Boolean(result) && !result.error;
    if (result && result.error) initialEmailError = String(result.error.message || result.error).slice(0, 500);
  } catch (error) { initialEmailError = String(error.message || error).slice(0, 500); }
}
return [{ json: { ...delivery, initialEmailAttempted: cfg.sendEmail === true, initialEmailSent, initialEmailError } }];`,
}, { id: 'zvid-sac-0031' });

const followUpEnabled = ifNode('Wait for a follow-up check?', [3400, 220], "={{ $('Config').first().json.followUpEnabled === true && (!$json.isFixture || $('Config').first().json.testFollowUpInFixture === true) }}", 'zvid-sac-0032');

const waitFollowUp = node('Wait before follow-up', 'n8n-nodes-base.wait', [3620, 20], {
  amount: "={{ $json.isFixture ? $('Config').first().json.testFollowUpSeconds : Number($('Config').first().json.followUpWaitMinutes || 720) * 60 }}",
  unit: 'seconds',
}, { id: 'zvid-sac-0033', typeVersion: 1.1 });

const fixtureFollowUp = ifNode('Use fixture follow-up?', [3840, 20], '={{ $json.isFixture === true }}', 'zvid-sac-0034');

const decideFixtureFollowUp = node('Simulate conversion before follow-up', 'n8n-nodes-base.code', [4060, -140], {
  jsCode: "const cfg = $('Config').first().json; const delivery = $('Record initial delivery result').first().json; const recovered = cfg.testFixtureRecoveredBeforeFollowUp === true; return [{ json: { ...delivery, stillAbandoned: !recovered, followUpStopReason: recovered ? 'fixture simulates a completed order' : null } }];",
}, { id: 'zvid-sac-0035' });

const confirmFollowUp = node('Confirm before follow-up', 'n8n-nodes-base.httpRequest', [4060, 220], {
  method: 'POST',
  url: "={{ 'https://' + $('Config').first().json.shopDomain + '.myshopify.com/admin/api/' + $('Config').first().json.shopifyApiVersion + '/graphql.json' }}",
  authentication: 'genericCredentialType',
  genericAuthType: 'httpHeaderAuth',
  sendBody: true,
  specifyBody: 'json',
  jsonBody: `={{ JSON.stringify({ query: ${JSON.stringify(confirmQuery)}, variables: { id: $('Prepare private recovery delivery').first().json.checkoutId } }) }}`,
  options: { response: { response: { fullResponse: true, neverError: true } }, timeout: 60000 },
}, { id: 'zvid-sac-0036', retryOnFail: true, maxTries: 3, waitBetweenTries: 5000 });

const checkFollowUp = node('Check follow-up conversion', 'n8n-nodes-base.code', [4280, 220], {
  jsCode: String.raw`const delivery = $('Record initial delivery result').first().json;
const response = $input.first().json || {};
const status = Number(response.statusCode || 0);
const body = response.body === undefined ? response : response.body;
if (!status) throw new Error('Shopify returned no follow-up confirmation response.');
if (status !== 200) throw new Error('Shopify follow-up confirmation failed (HTTP ' + status + '): ' + JSON.stringify(body).slice(0, 700));
if (Array.isArray(body.errors) && body.errors.length) throw new Error('Shopify GraphQL error: ' + body.errors.map((error) => error.message).join('; '));
const abandonment = body.data && body.data.abandonmentByAbandonedCheckoutId;
const stillAbandoned = Boolean(abandonment && abandonment.customerHasNoOrderSinceAbandonment && abandonment.customerHasNoDraftOrderSinceAbandonment && abandonment.inventoryAvailable && abandonment.isMostSignificantAbandonment && !(abandonment.abandonedCheckoutPayload && abandonment.abandonedCheckoutPayload.completedAt));
return [{ json: { ...delivery, stillAbandoned, followUpStopReason: stillAbandoned ? null : 'conversion, draft order, newer abandonment, or unavailable inventory detected' } }];`,
}, { id: 'zvid-sac-0037' });

const stillAbandoned = ifNode('Still abandoned at follow-up?', [4500, 20], '={{ $json.stillAbandoned === true }}', 'zvid-sac-0038');

const conversionStop = node('Stop follow-up after conversion', 'n8n-nodes-base.code', [4720, 300], {
  jsCode: "const item = $input.first().json; return [{ json: { ...item, followUpAttempted: false, followUpEmailSent: false, followUpStoppedByConversion: true } }];",
}, { id: 'zvid-sac-0039' });

const sendFollowUp = ifNode('Send follow-up email?', [4720, -40], "={{ $('Config').first().json.sendEmail === true && String($json.email || '').includes('@') }}", 'zvid-sac-0040');

const followUpEmail = cloneNode('Send recovery email', 'Send follow-up recovery email');
followUpEmail.id = 'zvid-sac-0041';
followUpEmail.position = [4940, -180];
followUpEmail.parameters.toEmail = "={{ $('Prepare private recovery delivery').first().json.email }}";
followUpEmail.parameters.subject = "={{ $('Prepare private recovery delivery').first().json.followUpSubject }}";
followUpEmail.parameters.html = "={{ $('Prepare private recovery delivery').first().json.followUpHtml }}";

const remember = node('Remember checkout handled', 'n8n-nodes-base.code', [5160, 220], {
  jsCode: String.raw`const delivery = $('Prepare private recovery delivery').first().json;
const initial = $('Record initial delivery result').first().json;
const store = $getWorkflowStaticData('global');
if (!Array.isArray(store.handledCheckoutIds)) store.handledCheckoutIds = [];
if (!store.inFlightCheckouts || typeof store.inFlightCheckouts !== 'object') store.inFlightCheckouts = {};
const id = String(delivery.checkoutId || '');
if (id) delete store.inFlightCheckouts[id];
if (!delivery.isFixture && id && !store.handledCheckoutIds.map(String).includes(id)) store.handledCheckoutIds.push(id);
if (store.handledCheckoutIds.length > 500) store.handledCheckoutIds = store.handledCheckoutIds.slice(-500);
let followUpEmailSent = false;
let followUpEmailError = null;
try {
  const response = $('Send follow-up recovery email').first().json;
  followUpEmailSent = Boolean(response) && !response.error;
  if (response && response.error) followUpEmailError = String(response.error.message || response.error).slice(0, 500);
} catch {}
let followUpStoppedByConversion = false;
let followUpStopReason = null;
try {
  const stopped = $('Stop follow-up after conversion').first().json;
  followUpStoppedByConversion = Boolean(stopped && stopped.followUpStoppedByConversion);
  followUpStopReason = stopped && stopped.followUpStopReason;
} catch {}
return [{ json: {
  ...delivery,
  initialEmailAttempted: initial.initialEmailAttempted,
  initialEmailSent: initial.initialEmailSent,
  initialEmailError: initial.initialEmailError,
  followUpEmailSent,
  followUpEmailError,
  followUpStoppedByConversion,
  followUpStopReason,
  remembered: delivery.isFixture ? null : id,
  rememberedCount: store.handledCheckoutIds.length,
} }];`,
}, { id: 'zvid-sac-0042' });

const summary = node('Recovery run summary', 'n8n-nodes-base.code', [5380, 220], {
  jsCode: String.raw`const result = $input.first().json;
return [{ json: {
  rendered: true,
  fixture: result.isFixture,
  checkoutId: result.checkoutId,
  checkoutName: result.checkoutName,
  itemCount: result.itemCount,
  items: result.items,
  cartTotal: result.cartTotal,
  videoUrl: result.videoUrl,
  jobId: result.jobId,
  creditsCharged: result.creditsCharged,
  initialEmailAttempted: result.initialEmailAttempted,
  initialEmailSent: result.initialEmailSent,
  initialEmailError: result.initialEmailError,
  followUpEmailSent: result.followUpEmailSent,
  followUpEmailError: result.followUpEmailError,
  followUpStoppedByConversion: result.followUpStoppedByConversion,
  followUpStopReason: result.followUpStopReason,
  customerEmailExcludedFromVideo: true,
} }];`,
}, { id: 'zvid-sac-0043' });

const watch = cloneNode('▶ Watch video');
watch.id = 'zvid-sac-0044';
watch.position = [5600, 220];

const notes = [
  sticky('zvid-sac-n001', 'Overview', [-1900, -1040], 760, 720, "# Recover abandoned Shopify checkouts with personalized Zvid videos\n\nThis workflow finds one open abandoned Shopify checkout, waits before contacting the shopper, and confirms that the checkout still has inventory and that the customer has not completed an order or received a newer recovery message. It then maps up to three checkout items into a personalized vertical Zvid video.\n\n### How it works\nThe scheduled path reads Shopify's current Admin GraphQL abandonment objects. An in-flight lock prevents overlapping executions from rendering the same checkout. After the first wait, conversion, inventory, draft-order, newer-abandonment, and Shopify-email guards run before Zvid validation. A free dry run returns the exact credit quote and an editor draft. Live mode renders the MP4, optionally sends it by SMTP, waits for one optional follow-up, and checks conversion again before sending.\n\n### Safe setup\n1. Configure the Shopify and Zvid credentials in the notes to the right.\n2. Keep `manualFixture: true`, `dryRun: true`, and `sendEmail: false` for the first test.\n3. Review the editor draft and quote.\n4. Switch to live Shopify data, then enable rendering and email separately.\n\nCustomer email and phone values are never added to the video payload, project name, or final summary."),
  sticky('zvid-sac-n002', 'Shopify app setup', [-1120, -1040], 700, 720, "## 1. Create the Shopify app\n\nIn Shopify Admin open **Settings -> Apps -> Develop apps -> Build apps in Dev Dashboard**. Create an app version and grant:\n- `read_orders`\n- `read_customers`\n- `read_products`\n\nAbandoned checkout data is protected customer data. The installing staff member also needs **manage abandoned checkouts** permission. Release the version, install it on the store, and approve access.\n\nThe workflow uses GraphQL because the built-in Shopify node does not expose the required abandonment query, recovery URL, conversion flags, and inventory gates.\n\nOfficial object: https://shopify.dev/docs/api/admin-graphql/latest/objects/AbandonedCheckout" , 7),
  sticky('zvid-sac-n003', 'Shopify token setup', [-400, -1040], 760, 820, "## 2. Get `X-Shopify-Access-Token`\n\nThe Client ID and Client secret are not the access token. First open **Shopify Admin -> Settings -> Domains** and copy the canonical `*.myshopify.com` domain. Use only its subdomain for `Config.shopDomain`. The `/store/...` Admin URL handle can be different; a redirecting alias can cause n8n to drop the access-token header.\n\nExchange the app credentials with:\n\n```bash\ncurl -X POST https://YOUR_STORE.myshopify.com/admin/oauth/access_token \\\n  -H 'Content-Type: application/x-www-form-urlencoded' \\\n  -d 'grant_type=client_credentials' \\\n  -d 'client_id=YOUR_CLIENT_ID' \\\n  -d 'client_secret=YOUR_CLIENT_SECRET'\n```\n\nCreate an n8n **Header Auth** credential:\n- Name: `X-Shopify-Access-Token`\n- Value: returned `access_token`\n\nAssign it to **Find open abandoned checkouts**, **Confirm no purchase and inventory**, and **Confirm before follow-up**. Dev Dashboard tokens expire after 24 hours; refresh the credential for later scheduled runs or implement a secure token-refresh service. Existing admin-created custom-app tokens can continue while supported.\n\nOfficial guide: https://shopify.dev/docs/apps/build/dev-dashboard/get-api-access-tokens?lang=curl", 7),
  sticky('zvid-sac-n004', 'Zvid setup', [380, -1040], 680, 720, "## 3. Install and connect Zvid\n\nThis workflow requires Zvid's official n8n community package. Before configuring credentials:\n1. Open **Settings -> Community nodes**.\n2. Install **`@zvid/n8n-nodes-zvid`**.\n3. If installation is unavailable, ask the n8n workspace owner or admin.\n\nCreate an API key at **https://app.zvid.io/api-keys**. In n8n create a **Zvid API** credential:\n- API Key: your `zvid_...` key\n- Base URL: `https://api.zvid.io`\n\nAssign it to all four official Zvid nodes:\n- **Validate project (free)** - Render -> Validate\n- **Save draft to editor** - Project -> Create Editor Project\n- **Submit render** - Render -> Create\n- **Get render status** - Render -> Get\n\nKeep `dryRun: true` until the editor draft and credit quote are approved. Only rendering consumes credits.\n\nEditor: https://editor.zvid.io", 7),
  sticky('zvid-sac-n005', 'Email setup', [1080, -1040], 640, 720, "## 4. Optional SMTP delivery\n\nThe workflow sends nothing by default. To enable email:\n1. Create an n8n **SMTP** credential.\n2. Assign it to both email nodes.\n3. Set `emailFrom` to an approved sender.\n4. Set `sendEmail: true` only after a private test.\n\nThe email contains the Shopify recovery URL and the Zvid video URL. Configure SPF, DKIM, consent, quiet hours, and local recovery-message rules before activation. If Shopify already sent an abandonment email, the default guard stops this workflow before rendering. Disable overlapping Shopify automations or keep the guard enabled.\n\nTo use SMS instead, replace the two SMTP nodes with your approved SMS provider and pass the same recovery URL and video URL. Never send to the fixture address or phone.", 7),
  sticky('zvid-sac-n006', 'Fixture example', [1740, -1040], 620, 720, "## Safe example checkout\n\nThe default manual fixture mirrors a real example product from the Zvid Shopify test store:\n- Shopper first name: **Alex**\n- Product: **Clay Pocket Oversized Tee**\n- Variant: **M**\n- Quantity: **1**\n- Cart total: **$35**\n- Product image: Shopify CDN hero image\n\n`manualFixture: true` avoids Shopify and uses short waits. `testFixtureRecoveredBeforeFollowUp: true` simulates a purchase before the second reminder and proves that follow-up stops.\n\nFor a real run set `manualFixture: false`. Do not replace the fixture with real customer contact data in a publishable JSON file.", 7),
  sticky('zvid-sac-n007', 'Privacy and operations', [2380, -1040], 700, 720, "## Privacy, deduplication, and recovery\n\nShopify checkout contact data is protected customer data. n8n execution history can contain the address needed by SMTP, so set an appropriate execution-retention policy and restrict workflow access.\n\nThe video receives only the shopper's first name, product titles, images, prices, and cart total. Email, phone, and the recovery URL are excluded from the render payload and project name.\n\nThe workflow holds one in-flight checkout ID while waiting, remembers up to 500 completed IDs, and removes stale locks after `lockTtlHours`. A failed execution becomes eligible again after the lock expires. Re-importing the workflow resets static data.\n\nA Zvid render timeout does not necessarily cancel the remote job. Check https://app.zvid.io before retrying to avoid duplicate credit use.", 7),
  sticky('zvid-sac-n008', 'Section: detect and wait', [-1720, 120], 1160, 620, "### 1. Detect and wait\nManual fixture or live Shopify GraphQL -> choose one eligible checkout -> lock it -> wait one hour in production. No checkout is a successful no-op.", 7),
  sticky('zvid-sac-n009', 'Section: confirm and build', [-500, -40], 1280, 760, "### 2. Confirm and build\nAfter the wait, Shopify confirms no order, no draft order, available inventory, the most significant abandonment, and no prior Shopify email. Eligible data becomes a privacy-safe video payload.", 7),
  sticky('zvid-sac-n010', 'Section: preview or render', [800, -180], 1640, 940, "### 3. Preview or render\nFree validation runs before the credit gate. Dry run saves an editor draft. Live mode renders one MP4 and polls until completion or timeout.", 7),
  sticky('zvid-sac-n011', 'Section: deliver', [2460, -40], 900, 760, "### 4. Deliver once\nSMTP is optional and disabled by default. The first message contains the recovery URL and personalized video; failed sends are reported without exposing the address in the final summary.", 7),
  sticky('zvid-sac-n012', 'Section: stop follow-up', [3380, -260], 1840, 900, "### 5. Stop later reminders after conversion\nAn optional second wait is followed by the same Shopify conversion and inventory check. A completed order, draft order, newer abandonment, or unavailable inventory stops the follow-up.", 7),
  sticky('zvid-sac-n013', 'Section: summary', [5240, 40], 640, 600, "### 6. Audit result\nThe final output reports the video, credit charge, initial and follow-up delivery state, and whether conversion stopped the reminder. It deliberately omits customer email and phone.", 7),
];

const nodes = [
  manual, schedule, config, useFixture, fixture, findCheckouts, pickCheckout,
  checkoutFound, nothing, waitRecovery, fixtureConfirmation, approveFixture,
  confirmAbandonment, checkEligibility, stillEligible, stopBeforeRender,
  buildProject, validate, checkValidation, dryRun, saveDraft, drySummary, submit,
  waitRender, getStatus, renderFinished, stillRendering, prepareDelivery,
  sendInitial, initialEmail, initialResult, followUpEnabled, waitFollowUp,
  fixtureFollowUp, decideFixtureFollowUp, confirmFollowUp, checkFollowUp,
  stillAbandoned, conversionStop, sendFollowUp, followUpEmail, remember, summary,
  watch, ...notes,
];

const connections = {
  'Test manually': { main: [[{ node: 'Config', type: 'main', index: 0 }]] },
  'Every 15 minutes': { main: [[{ node: 'Config', type: 'main', index: 0 }]] },
  Config: { main: [[{ node: 'Use manual fixture?', type: 'main', index: 0 }]] },
  'Use manual fixture?': { main: [[{ node: 'Create safe test checkout', type: 'main', index: 0 }], [{ node: 'Find open abandoned checkouts', type: 'main', index: 0 }]] },
  'Create safe test checkout': { main: [[{ node: 'Checkout found?', type: 'main', index: 0 }]] },
  'Find open abandoned checkouts': { main: [[{ node: 'Pick and lock one checkout', type: 'main', index: 0 }]] },
  'Pick and lock one checkout': { main: [[{ node: 'Checkout found?', type: 'main', index: 0 }]] },
  'Checkout found?': { main: [[{ node: 'Wait before recovery check', type: 'main', index: 0 }], [{ node: 'Nothing to recover', type: 'main', index: 0 }]] },
  'Wait before recovery check': { main: [[{ node: 'Use fixture confirmation?', type: 'main', index: 0 }]] },
  'Use fixture confirmation?': { main: [[{ node: 'Approve checkout test fixture', type: 'main', index: 0 }], [{ node: 'Confirm no purchase and inventory', type: 'main', index: 0 }]] },
  'Confirm no purchase and inventory': { main: [[{ node: 'Check conversion and inventory', type: 'main', index: 0 }]] },
  'Approve checkout test fixture': { main: [[{ node: 'Still eligible after the wait?', type: 'main', index: 0 }]] },
  'Check conversion and inventory': { main: [[{ node: 'Still eligible after the wait?', type: 'main', index: 0 }]] },
  'Still eligible after the wait?': { main: [[{ node: 'Build personalized recovery video', type: 'main', index: 0 }], [{ node: 'Stop recovered or unavailable checkout', type: 'main', index: 0 }]] },
  'Build personalized recovery video': { main: [[{ node: 'Validate project (free)', type: 'main', index: 0 }]] },
  'Validate project (free)': { main: [[{ node: 'Check validation', type: 'main', index: 0 }]] },
  'Check validation': { main: [[{ node: 'Dry run?', type: 'main', index: 0 }]] },
  'Dry run?': { main: [[{ node: 'Save draft to editor', type: 'main', index: 0 }], [{ node: 'Submit render', type: 'main', index: 0 }]] },
  'Save draft to editor': { main: [[{ node: 'Dry run summary', type: 'main', index: 0 }]] },
  'Submit render': { main: [[{ node: 'Wait for render', type: 'main', index: 0 }]] },
  'Wait for render': { main: [[{ node: 'Get render status', type: 'main', index: 0 }]] },
  'Get render status': { main: [[{ node: 'Render finished?', type: 'main', index: 0 }]] },
  'Render finished?': { main: [[{ node: 'Prepare private recovery delivery', type: 'main', index: 0 }], [{ node: 'Still rendering?', type: 'main', index: 0 }]] },
  'Still rendering?': { main: [[{ node: 'Wait for render', type: 'main', index: 0 }]] },
  'Prepare private recovery delivery': { main: [[{ node: 'Send initial recovery email?', type: 'main', index: 0 }]] },
  'Send initial recovery email?': { main: [[{ node: 'Send initial recovery email', type: 'main', index: 0 }], [{ node: 'Record initial delivery result', type: 'main', index: 0 }]] },
  'Send initial recovery email': { main: [[{ node: 'Record initial delivery result', type: 'main', index: 0 }]] },
  'Record initial delivery result': { main: [[{ node: 'Wait for a follow-up check?', type: 'main', index: 0 }]] },
  'Wait for a follow-up check?': { main: [[{ node: 'Wait before follow-up', type: 'main', index: 0 }], [{ node: 'Remember checkout handled', type: 'main', index: 0 }]] },
  'Wait before follow-up': { main: [[{ node: 'Use fixture follow-up?', type: 'main', index: 0 }]] },
  'Use fixture follow-up?': { main: [[{ node: 'Simulate conversion before follow-up', type: 'main', index: 0 }], [{ node: 'Confirm before follow-up', type: 'main', index: 0 }]] },
  'Simulate conversion before follow-up': { main: [[{ node: 'Still abandoned at follow-up?', type: 'main', index: 0 }]] },
  'Confirm before follow-up': { main: [[{ node: 'Check follow-up conversion', type: 'main', index: 0 }]] },
  'Check follow-up conversion': { main: [[{ node: 'Still abandoned at follow-up?', type: 'main', index: 0 }]] },
  'Still abandoned at follow-up?': { main: [[{ node: 'Send follow-up email?', type: 'main', index: 0 }], [{ node: 'Stop follow-up after conversion', type: 'main', index: 0 }]] },
  'Send follow-up email?': { main: [[{ node: 'Send follow-up recovery email', type: 'main', index: 0 }], [{ node: 'Remember checkout handled', type: 'main', index: 0 }]] },
  'Send follow-up recovery email': { main: [[{ node: 'Remember checkout handled', type: 'main', index: 0 }]] },
  'Stop follow-up after conversion': { main: [[{ node: 'Remember checkout handled', type: 'main', index: 0 }]] },
  'Remember checkout handled': { main: [[{ node: 'Recovery run summary', type: 'main', index: 0 }]] },
  'Recovery run summary': { main: [[{ node: '▶ Watch video', type: 'main', index: 0 }]] },
};

const workflow = {
  name: 'Recover abandoned Shopify checkouts with personalized Zvid videos',
  nodes,
  pinData: {},
  connections,
  active: false,
  settings: { executionOrder: 'v1' },
  tags: [],
};

fs.writeFileSync(outputPath, JSON.stringify(workflow, null, 2) + '\n');
console.log(`Wrote ${outputPath} (${nodes.length} nodes)`);
