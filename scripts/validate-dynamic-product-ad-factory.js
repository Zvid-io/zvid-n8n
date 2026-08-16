const fs = require('fs');
const path = require('path');

const workflowPath = path.resolve(__dirname, '..', 'workflows', 'zvid-shopify-dynamic-product-ad-factory.json');
const raw = fs.readFileSync(workflowPath, 'utf8');
const workflow = JSON.parse(raw);
const names = new Set(workflow.nodes.map((entry) => entry.name));
const duplicates = workflow.nodes.map((entry) => entry.name).filter((name, index, all) => all.indexOf(name) !== index);
const missing = [];
for (const [from, connection] of Object.entries(workflow.connections)) {
  if (!names.has(from)) missing.push(`from:${from}`);
  for (const branch of connection.main || []) {
    for (const edge of branch) if (!names.has(edge.node)) missing.push(`to:${edge.node}`);
  }
}
const invalidTypes = workflow.nodes
  .map((entry) => entry.type)
  .filter((type) => !(type.startsWith('n8n-nodes-base.') || type.startsWith('@zvid/n8n-nodes-zvid.')));
const invalidZvidPrefixes = [...raw.matchAll(/n8n-nodes-zvid/g)]
  .filter((match) => !raw.slice(Math.max(0, match.index - 7), match.index).includes('@zvid/'));
const jsErrors = [];
for (const entry of workflow.nodes.filter((candidate) => candidate.type === 'n8n-nodes-base.code')) {
  try {
    new Function(entry.parameters.jsCode);
  } catch (error) {
    jsErrors.push({ node: entry.name, error: error.message });
  }
}
const behaviorErrors = [];
const expectedZvidOperations = {
  'Validate project (free)': ['render', 'validate'],
  'Save draft to editor': ['project', 'create'],
  'Submit bulk render': ['render', 'createBulk'],
  'Get batch status': ['render', 'getBulk'],
};
for (const [name, [resource, operation]] of Object.entries(expectedZvidOperations)) {
  const entry = workflow.nodes.find((candidate) => candidate.name === name);
  if (!entry) {
    behaviorErrors.push(`Missing native Zvid node: ${name}`);
    continue;
  }
  if (entry.type !== '@zvid/n8n-nodes-zvid.zvid') behaviorErrors.push(`${name} is not a native Zvid node`);
  if (entry.parameters.resource !== resource || entry.parameters.operation !== operation) {
    behaviorErrors.push(`${name} expected ${resource}/${operation}`);
  }
}
const zvidHttpNodes = workflow.nodes.filter((entry) =>
  entry.type === 'n8n-nodes-base.httpRequest' &&
  /api\.zvid\.io|apiUrl|\/api\/(?:render|projects)/i.test(JSON.stringify(entry.parameters)),
);
if (zvidHttpNodes.length) behaviorErrors.push(`Zvid API still uses HTTP Request: ${zvidHttpNodes.map((entry) => entry.name).join(', ')}`);
const conceptsNode = workflow.nodes.find((entry) => entry.name === 'Create ad concepts');
if (!conceptsNode) {
  behaviorErrors.push('Missing Create ad concepts node');
} else {
  const fixtureProducts = [
    {
      id: 'gid://shopify/Product/101',
      title: 'Product Alpha',
      handle: 'product-alpha',
      description: 'A comfortable cotton layer with a structured everyday fit.',
      featuredImage: { url: 'https://example.com/alpha-1.jpg' },
      images: { nodes: [{ url: 'https://example.com/alpha-2.jpg' }, { url: 'https://example.com/alpha-3.jpg' }] },
      variants: { nodes: [{ price: '30.00', compareAtPrice: null }] },
    },
    {
      id: 'gid://shopify/Product/202',
      title: 'Product Beta',
      handle: 'product-beta',
      description: 'A refined striped essential designed for versatile daily wear.',
      featuredImage: { url: 'https://example.com/beta-1.jpg' },
      images: { nodes: [{ url: 'https://example.com/beta-2.jpg' }, { url: 'https://example.com/beta-3.jpg' }] },
      variants: { nodes: [{ price: '40.00', compareAtPrice: '50.00' }] },
    },
  ];
  const executeConcepts = (overrides) => {
    const config = {
      shopDomain: 'example',
      maxProducts: 2,
      variantsPerProduct: 2,
      maxTotalAds: 4,
      hookTemplates: ['Meet the {{product}}.', 'A fresh angle on {{product}}.'],
      creativeFormats: ['product-first', 'benefit-first', 'offer-first'],
      ctaText: 'Shop now',
      ...overrides,
    };
    const lookup = (name) => {
      if (name !== 'Config') throw new Error(`Unexpected node lookup: ${name}`);
      return { first: () => ({ json: config }) };
    };
    const input = {
      first: () => ({
        json: {
          statusCode: 200,
          body: {
            data: {
              shop: { currencyCode: 'USD', primaryDomain: { url: 'https://example.myshopify.com' } },
              products: { nodes: fixtureProducts },
            },
          },
        },
      }),
    };
    return new Function('$', '$input', conceptsNode.parameters.jsCode)(lookup, input)[0].json;
  };
  try {
    const capped = executeConcepts({ maxTotalAds: 2 });
    if (capped.ads.length !== 2) behaviorErrors.push(`Expected 2 capped ads, received ${capped.ads.length}`);
    if (new Set(capped.ads.map((ad) => ad.shopifyProductId)).size !== 2) behaviorErrors.push('Two-slot cap did not allocate one ad to each product');
    if (capped.variantDistribution.some((entry) => entry.variants !== 1)) behaviorErrors.push('Two-slot cap distribution is not 1+1');

    const full = executeConcepts({ maxTotalAds: 4 });
    const expectedOrder = ['101-01', '202-01', '101-02', '202-02'];
    if (full.ads.map((ad) => ad.conceptId).join('|') !== expectedOrder.join('|')) behaviorErrors.push('Four-slot allocation is not round-robin');
    if (full.variantDistribution.some((entry) => entry.variants !== 2)) behaviorErrors.push('Four-slot distribution is not 2+2');
    for (const productId of ['gid://shopify/Product/101', 'gid://shopify/Product/202']) {
      const variants = full.ads.filter((ad) => ad.shopifyProductId === productId);
      if (new Set(variants.map((ad) => ad.creativeFormat)).size !== 2) behaviorErrors.push(`${productId} formats are duplicated`);
      if (new Set(variants.map((ad) => ad.openerHeadline)).size !== 2) behaviorErrors.push(`${productId} opener headlines are duplicated`);
      if (new Set(variants.map((ad) => ad.storyKicker)).size !== 2) behaviorErrors.push(`${productId} story copy is not format-specific`);
    }
  } catch (error) {
    behaviorErrors.push(`Concept behavior test failed: ${error.message}`);
  }
}
const secretHits = ['shpat_', 'shpca_', 'zvid_30'].filter((pattern) => raw.includes(pattern));
const mojibake = /Â|â€|ðŸ|Ã/.test(raw);
const result = {
  nodes: workflow.nodes.length,
  connections: Object.keys(workflow.connections).length,
  duplicates,
  missing,
  invalidTypes,
  invalidZvidPrefixes: invalidZvidPrefixes.length,
  jsErrors,
  behaviorErrors,
  secretHits,
  mojibake,
};
console.log(JSON.stringify(result, null, 2));
if (duplicates.length || missing.length || invalidTypes.length || invalidZvidPrefixes.length || jsErrors.length || behaviorErrors.length || secretHits.length || mojibake) process.exit(1);
