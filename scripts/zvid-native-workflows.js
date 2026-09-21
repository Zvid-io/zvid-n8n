'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ZVID_TYPE = '@zvid/n8n-nodes-zvid.zvid';
const INSTALL = 'Install **`@zvid/n8n-nodes-zvid`** from **Settings → Community nodes** before configuring Zvid credentials. A workspace owner/admin may need to install it. Create a **Zvid API** credential with your key from https://app.zvid.io/api-keys and Base URL `https://api.zvid.io`, then select it on every Zvid node.';
const UPLOAD = 'File upload exception: the published Zvid node does not expose multipart uploads. The upload step uses HTTP Request → `POST /api/uploads`, authenticated with the same **Zvid API** credential. All supported Zvid operations use the Zvid node.';
const MCP = 'AI-agent exception: this workflow uses n8n’s built-in **MCP Client Tool** against **https://mcp.zvid.io/mcp**. Zvid’s conversational creation and approval tools are exposed through MCP, not equivalent operations in the published Zvid node. Keep the existing MCP authentication and approval settings.';

function planEntries(root = path.resolve(__dirname, '../../..')) {
  return [...fs.readFileSync(path.join(root, 'N8N_WORKFLOWS_30DAY_PLAN.md'), 'utf8')
    .matchAll(/^\*\*Day (\d+) — [\s\S]*?\[`(zvid-[^`]+\.json)`\]/gm)]
    .map((m) => ({ day: Number(m[1]), file: m[2] }));
}

function zvidRoute(node) {
  if (node.type !== 'n8n-nodes-base.httpRequest') return null;
  const url = node.parameters.url || '';
  // Match the API route, including Config-based origins and interpolated IDs.
  return url.match(/\/api\/(?:render|jobs|projects|uploads|stock|templates|library|credits)(?:\/|\b)[\s\S]*/)?.[0] || null;
}

function bodyExpression(node) {
  const raw = node.parameters.jsonBody;
  if (typeof raw === 'object' && raw !== null) return JSON.stringify(raw);
  const match = String(raw).match(/^=\{\{\s*JSON\.stringify\(([\s\S]*)\)\s*\}\}$/);
  if (match) return match[1].trim();
  const expression = String(raw).match(/^=\{\{\s*([\s\S]*?)\s*\}\}$/);
  if (expression) return `((v) => typeof v === 'string' ? JSON.parse(v) : v)(${expression[1]})`;
  try { return JSON.stringify(JSON.parse(raw)); } catch { throw new Error(`Unsupported body in ${node.name}`); }
}

function field(body, name, json = false) {
  const expression = `(${body}).${name}`;
  return `={{ ${json ? `JSON.stringify(${expression})` : expression} }}`;
}

function idParameter(route, prefix) {
  const suffix = route.slice(prefix.length);
  if (!suffix) throw new Error(`Missing ID: ${route}`);
  return suffix.includes('{{') ? '=' + suffix : suffix;
}

function nativeParameters(node) {
  const route = zvidRoute(node);
  if (!route) return null;
  const method = node.parameters.method || 'GET';
  if (route === '/api/uploads' && method === 'POST') return { upload: true };
  if (route === '/api/stock/search' && method === 'GET') {
    const q = Object.fromEntries((node.parameters.queryParameters?.parameters || []).map((p) => [p.name, p.value]));
    if (Object.keys(q).some((k) => !['type', 'query', 'page', 'perPage', 'provider'].includes(k)) || (q.provider && q.provider !== 'all')) throw new Error(`Unsupported stock query in ${node.name}`);
    return { resource: 'stockMedia', operation: 'search', stockType: q.type || 'image', stockQuery: q.query || '', stockPage: q.page || 1, stockPerPage: q.perPage || 20 };
  }
  if (route.startsWith('/api/jobs/') && method === 'GET') return { resource: 'render', operation: 'get', jobId: idParameter(route, '/api/jobs/'), waitForCompletion: false };
  if (route.startsWith('/api/render/bulk/') && method === 'GET') return { resource: 'render', operation: 'getBulk', bulkId: idParameter(route, '/api/render/bulk/') };
  if (method !== 'POST') throw new Error(`Unmapped Zvid request: ${method} ${route}`);
  const body = bodyExpression(node);
  if (route === '/api/projects') return { resource: 'project', operation: 'create', projectName: field(body, 'name'), projectJson: field(body, 'payload', true) };
  const operation = route === '/api/render/validate/api-key' ? 'validate' : /^\/api\/render\/(?:image\/)?bulk\/api-key$/.test(route) ? 'createBulk' : /^\/api\/render\/(?:image\/)?api-key$/.test(route) ? 'create' : null;
  if (!operation) throw new Error(`Unmapped Zvid request: ${method} ${route}`);
  const params = { resource: 'render', operation, source: 'json', projectJson: field(body, 'payload', true) };
  if (/\bvariables\s*:/.test(body)) params.validationVariables = field(body, 'variables', true);
  if (operation !== 'validate') {
    params.renderType = route.includes('/image/') ? 'image' : 'video';
    if (operation === 'create') params.waitForCompletion = false;
  }
  if (operation === 'createBulk') {
    params.items = field(body, 'items', true);
    params.additionalFields = { batchName: field(body, 'name') };
  }
  for (const property of ['overrides', 'webhookUrl']) {
    if (new RegExp(`\\b${property}\\s*:`).test(body)) {
      params.additionalFields ||= {};
      params.additionalFields[property] = field(body, property, property === 'overrides');
    }
  }
  return params;
}

function fixValidation(code) {
  return code
    .replace(/const status = res\.statusCode;/g, 'const status = res.statusCode ?? (res.valid === true ? 200 : 400);')
    .replace(/const body = res\.body \|\| \{\};/g, 'const body = res.body || { ...res, details: res.errors ?? res.details };')
    .replace(/const status = res\.json\.statusCode;/g, 'const status = res.json.statusCode ?? (res.json.valid === true ? 200 : 400);')
    .replace(/const body = res\.json\.body \|\| \{\};/g, 'const body = res.json.body || { ...res.json, details: res.json.errors ?? res.json.details };')
    .replace(/const status = hasEnvelope \? Number\(res\.statusCode\) : 200;/g, 'const status = hasEnvelope ? Number(res.statusCode) : (res.valid === true ? 200 : 400);')
    .replace(/const body = \(hasEnvelope \? res\.body : res\) \|\| \{\};/g, 'const body = (hasEnvelope ? res.body : { ...res, details: res.errors ?? res.details }) || {};')
    .replace(/\/\/ The node ships with fullResponse on,[\s\S]*?\/\/ empty result\.\n/g, '// The Zvid node returns valid/errors; also accept saved HTTP response fixtures.\n');
}

function cleanCopy(text, upload) {
  // Replace whole Zvid setup items; credentials for other services are untouched.
  text = text.replace(/(^\d+\. \*\*Zvid (?:API key|credential)\*\*[^\n]*\n)(?:(?!\d+\. |\n#{1,3} )[^\n]*\n)*/gm,
    (block) => `${block.match(/^\d+/)[0]}. **Zvid credential** — create a **Zvid API** credential and select it on every Zvid node.${upload ? ' Use it on the HTTP upload step too (Predefined Credential Type → Zvid API).' : ''}\n`);
  text = text.replace(/(^#{2,3} (?:Official Zvid nodes|Using (?:the )?(?:official |native )?Zvid nodes)[^\n]*\n)[\s\S]*?(?=^#{2,3} |$(?![\s\S]))/gmi, `## Zvid node setup\n\n${INSTALL}${upload ? '\n\n' + UPLOAD : ''}\n\n`);
  text = text.replace(/\*\*second Header Auth\*\*/g, '**Header Auth**');
  text = text.replace(/^- \*\*(?:Skip the polling loop|Native Zvid nodes)\*\*[^\n]*\n(?:  [^\n]*\n)*/gm,
    '- **Zvid nodes** — validation, editor drafts, rendering and status checks already use the official Zvid node. Keep the existing wait loop, or configure a Zvid Trigger separately if you prefer webhook delivery.\n');
  text = text.replace(/^On self-hosted n8n[^\n]*\n(?:(?!\n)[^\n]*\n)*/gm,
    'The workflow already uses the official Zvid node for all supported operations. Install and configure it as described above.\n');
  text = text.replace(/Nothing else\. The workflow is core-nodes-only[\s\S]*?with no community nodes installed\./g,
    'Install the Zvid community package as described above; the remaining steps use n8n’s built-in nodes.');
  text = text.replace(/\*\*Submit bulk render\*\* is the native Zvid action node\.[\s\S]*?only once and is never placed in the workflow JSON\./g,
    '**Validate project (free)**, **Save draft to editor**, **Submit bulk render**, and **Get batch status** all use the official Zvid node with one **Zvid API** credential. Validation resolves the first product’s variables; the draft uses that resolved preview and the existing loop polls the bulk batch.');
  text = text.replace(/The Header Auth credential is missing on one of the four Zvid nodes, or its name is not exactly `x-api-key`\./g,
    'The Zvid API credential is missing on a Zvid node, or its API key is invalid.');
  text = text.replace(/The Header Auth credential is missing, misnamed \(it must be `x-api-key`\), or not attached to all four Zvid nodes\./g,
    'The Zvid API credential is missing, invalid, or not attached to all four Zvid nodes.');
  text = text.replace('Submit bulk render uses the native Zvid node; the advanced API steps reuse the same credential.',
    'All four steps use the native Zvid node and the same credential.');
  text = text.replace(/These stay out of the required path\. On self-hosted n8n you can also install[\s\S]*?core-only so the workflow also imports untouched on n8n Cloud\./g,
    'These delivery steps stay out of the required path. Validation, editor drafts, bulk rendering, and batch-status checks already use the official Zvid node.');
  return text;
}

// SQLite stores nodeGroups as JSON text; n8n imports expect the decoded array.
// Older imports may have encoded that text more than once. Preserve the groups.
function normalizeNodeGroups(value) {
  let decoded = value;
  while (typeof decoded === 'string') decoded = JSON.parse(decoded);
  if (decoded != null && !Array.isArray(decoded)) throw new TypeError('Workflow nodeGroups must be an array or null');
  return decoded;
}

function migrateWorkflow(original, options = {}) {
  const workflow = structuredClone(original);
  if ('nodeGroups' in workflow) workflow.nodeGroups = normalizeNodeGroups(workflow.nodeGroups);
  const converted = [], uploads = [];
  for (const node of workflow.nodes) {
    const params = nativeParameters(node);
    if (!params) continue;
    const credential = options.credentialFor?.(node, workflow);
    if (params.upload) {
      uploads.push(node.name);
      node.parameters.authentication = 'predefinedCredentialType';
      node.parameters.nodeCredentialType = 'zvidApi';
      delete node.parameters.genericAuthType;
      node.notes = UPLOAD;
      node.notesInFlow = true;
    } else {
      converted.push(node.name);
      node.type = ZVID_TYPE;
      node.typeVersion = 1;
      node.parameters = params;
    }
    if (credential) node.credentials = { zvidApi: credential };
    else delete node.credentials;
  }
  if (converted.length) {
    for (const node of workflow.nodes) {
      if (node.type === 'n8n-nodes-base.code' && /valid/i.test(node.name)) node.parameters.jsCode = fixValidation(node.parameters.jsCode);
    }
  }
  const hasNative = workflow.nodes.some((n) => n.type === ZVID_TYPE);
  const hasMcp = workflow.nodes.some((n) => n.type === '@n8n/n8n-nodes-langchain.mcpClientTool');
  if (hasNative || hasMcp) {
    for (const node of workflow.nodes.filter((n) => n.type === 'n8n-nodes-base.stickyNote')) {
      node.parameters.content = cleanCopy(node.parameters.content, uploads.length > 0);
      if (hasNative && /core-only|deliberately core|swap:/.test(node.parameters.content) && /Zvid/.test(node.parameters.content)) {
        node.parameters.content = `## Zvid node setup\n\n${INSTALL}${uploads.length ? '\n\n' + UPLOAD : ''}`;
        node.parameters.height = Math.max(node.parameters.height || 0, uploads.length ? 460 : 320);
      }
    }
    const hasSetup = workflow.nodes.some((n) => n.id === 'zvid-native-setup'
      || (n.type === 'n8n-nodes-base.stickyNote' && n.id.startsWith('publication-overview-')
          && n.parameters.content.includes('https://app.zvid.io/api-keys')
          && ((n.parameters.content.includes('@zvid/n8n-nodes-zvid')
            && n.parameters.content.includes('Settings → Community nodes'))
            || (hasMcp && n.parameters.content.includes('https://mcp.zvid.io/mcp')))));
    if (!hasSetup) {
      const x = Math.min(...workflow.nodes.map((n) => n.position[0]));
      const y = Math.min(...workflow.nodes.map((n) => n.position[1])) - 520;
      workflow.nodes.push({ id: 'zvid-native-setup', name: hasNative ? 'Install and connect Zvid' : 'Zvid agent integration', type: 'n8n-nodes-base.stickyNote', typeVersion: 1, position: [x, y], parameters: { width: 720, height: 460, color: 6, content: hasNative ? `## Install and connect Zvid\n\n${INSTALL}${uploads.length ? '\n\n' + UPLOAD : ''}` : `## Zvid agent integration\n\n${MCP}` } });
    }
  }
  return { workflow, converted, uploads, mcp: hasMcp };
}

module.exports = { ZVID_TYPE, INSTALL, UPLOAD, MCP, planEntries, zvidRoute, nativeParameters, bodyExpression, migrateWorkflow, normalizeNodeGroups, fixValidation, cleanCopy };
