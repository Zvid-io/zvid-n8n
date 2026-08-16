const fs = require('fs');
const path = require('path');

const workflowPath = path.resolve(__dirname, '..', 'workflows', 'zvid-shopify-catalog-videos.json');
const raw = fs.readFileSync(workflowPath, 'utf8');
const workflow = JSON.parse(raw);
const names = new Set(workflow.nodes.map((node) => node.name));
const ids = new Set(workflow.nodes.map((node) => node.id));
const duplicateNames = workflow.nodes
  .map((node) => node.name)
  .filter((name, index, all) => all.indexOf(name) !== index);
const duplicateIds = workflow.nodes
  .map((node) => node.id)
  .filter((id, index, all) => all.indexOf(id) !== index);

const missingConnections = [];
for (const [source, connections] of Object.entries(workflow.connections || {})) {
  if (!names.has(source)) missingConnections.push(`from:${source}`);
  for (const output of connections.main || []) {
    for (const edge of output) {
      if (!names.has(edge.node)) missingConnections.push(`to:${edge.node}`);
    }
  }
}

const invalidTypes = workflow.nodes
  .map((node) => node.type)
  .filter((type) => !(type.startsWith('n8n-nodes-base.') || type.startsWith('@zvid/n8n-nodes-zvid.')));
const invalidZvidPrefixes = [...raw.matchAll(/n8n-nodes-zvid/g)]
  .filter((match) => !raw.slice(Math.max(0, match.index - 7), match.index).includes('@zvid/'));
const validZvidTypes = new Set(['@zvid/n8n-nodes-zvid.zvid', '@zvid/n8n-nodes-zvid.zvidTrigger']);
const unknownZvidTypes = workflow.nodes
  .map((node) => node.type)
  .filter((type) => type.startsWith('@zvid/n8n-nodes-zvid.') && !validZvidTypes.has(type));

const jsErrors = [];
for (const node of workflow.nodes.filter((candidate) => candidate.type === 'n8n-nodes-base.code')) {
  try {
    new Function(node.parameters.jsCode);
  } catch (error) {
    jsErrors.push({ node: node.name, error: error.message });
  }
}

const behaviorErrors = [];
const watchNode = workflow.nodes.find((node) => node.name.includes('Watch video'));
if (!watchNode || watchNode.parameters.url !== '={{ $json.videoUrl }}') {
  behaviorErrors.push('Watch video must read the case-sensitive videoUrl output property');
}

const submitNode = workflow.nodes.find((node) => node.name === 'Submit bulk render');
if (!submitNode || submitNode.type !== '@zvid/n8n-nodes-zvid.zvid') {
  behaviorErrors.push('Submit bulk render must use the published Zvid community node');
}

const zvidSetup = workflow.nodes.find((node) => node.name === 'Zvid n8n credential');
const setupText = zvidSetup?.parameters?.content || '';
if (!setupText.includes('@zvid/n8n-nodes-zvid') || !/owner or admin/i.test(setupText)) {
  behaviorErrors.push('Zvid setup note must contain the scoped package and owner/admin prerequisite');
}

const configNode = workflow.nodes.find((node) => node.name === 'Config');
let config = {};
try {
  config = JSON.parse(configNode.parameters.jsonOutput);
} catch (error) {
  behaviorErrors.push(`Config JSON is invalid: ${error.message}`);
}
if (config.dryRun !== true || config.publishToShopify !== false) {
  behaviorErrors.push('Safe defaults must keep dryRun=true and publishToShopify=false');
}
if (config.apiUrl !== 'https://api.zvid.io' || config.editorUrl !== 'https://editor.zvid.io') {
  behaviorErrors.push('Config uses a non-canonical Zvid URL');
}

const secretPatterns = [
  /shpat_[A-Za-z0-9_-]+/,
  /shpca_[A-Za-z0-9_-]+/,
  /zvid_[A-Za-z0-9_-]{12,}/,
];
const secretHits = secretPatterns.filter((pattern) => pattern.test(raw)).map(String);
const mojibake = /Ã‚|Ã¢â‚¬|Ã°Å¸|Ãƒ/.test(raw);

const result = {
  nodes: workflow.nodes.length,
  connectionSources: Object.keys(workflow.connections || {}).length,
  uniqueNodeNames: names.size,
  uniqueNodeIds: ids.size,
  duplicateNames,
  duplicateIds,
  missingConnections,
  invalidTypes,
  invalidZvidPrefixes: invalidZvidPrefixes.length,
  unknownZvidTypes,
  jsErrors,
  behaviorErrors,
  secretHits,
  mojibake,
};

console.log(JSON.stringify(result, null, 2));
if (
  duplicateNames.length || duplicateIds.length || missingConnections.length || invalidTypes.length ||
  invalidZvidPrefixes.length || unknownZvidTypes.length || jsErrors.length || behaviorErrors.length ||
  secretHits.length || mojibake
) process.exit(1);
