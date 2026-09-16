'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { planEntries, migrateWorkflow, INSTALL, UPLOAD, MCP, cleanCopy, bodyExpression } = require('./zvid-native-workflows');
const { buildRenderBody, buildBulkRenderBody, buildProjectCreateBody } = require('../dist/nodes/Zvid/GenericFunctions');
const dir = path.join(__dirname, '../workflows');
const sample = {
  payload: { name: 'Sample', scenes: [], variables: { name: 'Ada' } },
  resolvedFirst: { name: 'Resolved sample', scenes: [] },
  items: [{ variables: { name: 'Ada' } }, { variables: { name: 'Sam' } }],
  meta: { title: 'A title', projectName: 'A project', products: [{ product: 'Coffee' }], leads: [{ company: 'Acme' }], workoutName: 'Run', dateIso: '2026-09-14' },
  jobId: 'job_sample', bulkId: 'bulk_sample', visualQuery: 'forest', query: 'calm', mediaType: 'video', bulkName: 'Sample batch',
};
function evaluate(value) {
  if (typeof value !== 'string' || !value.startsWith('={{')) return value;
  return new Function('$json', '$', `return (${value.slice(3, -2)});`)(sample, () => ({ first: () => ({ json: sample }) }));
}

async function checkBody(before, after) {
  if (!before.parameters.jsonBody || after.type !== '@zvid/n8n-nodes-zvid.zvid') return;
  const expected = evaluate(`={{ ${bodyExpression(before)} }}`);
  const params = Object.fromEntries(Object.entries(after.parameters).map(([k, v]) => [k, k === 'additionalFields' ? Object.fromEntries(Object.entries(v).map(([a,b]) => [a,evaluate(b)])) : evaluate(v)]));
  const context = { getNodeParameter: (k, fallback) => params[k] ?? fallback, getNode: () => after };
  const builder = params.resource === 'project' ? buildProjectCreateBody : params.operation === 'createBulk' ? buildBulkRenderBody : buildRenderBody;
  const result = await builder.call(context, {});
  assert.deepEqual(result.body, expected, `Request body changed: ${before.name}`);
}

async function main() {
  const entries = [...planEntries(), { day: 6, file: 'zvid-shopify-catalog-videos.json', variant: true }];
  const report = [];
  for (const entry of entries) {
    const file = path.join(dir, entry.file);
    const original = JSON.parse(fs.readFileSync(file, 'utf8'));
    const result = migrateWorkflow(original);
    for (const name of result.converted) await checkBody(original.nodes.find(n => n.name === name), result.workflow.nodes.find(n => n.name === name));
    const docFile = file.replace(/zvid-([^/\\]+)\.json$/, '$1.md');
    let doc = cleanCopy(fs.readFileSync(docFile, 'utf8').replace(/\r\n/g, '\n'), result.uploads.length > 0);
    const section = result.mcp ? `## Zvid integration\n\n${MCP}\n\n` : `## Required Zvid node\n\n${INSTALL}${result.uploads.length ? '\n\n' + UPLOAD : ''}\n\n`;
    if (!doc.includes(result.mcp ? '## Zvid integration\n' : '## Required Zvid node\n')) {
      const firstBreak = doc.indexOf('\n\n');
      doc = doc.slice(0, firstBreak + 2) + section + doc.slice(firstBreak + 2);
    }
    if (!result.mcp && !doc.includes('Historical verification note:')) {
      doc = doc.replace(/^(## Verifi[^\n]*\n)/m, '$1\n> Historical verification note: dated runs below describe the earlier HTTP-based version. The current template uses the Zvid node for every supported operation; migration checks cover request bodies, credit quotes, validation failures, and workflow connections.\n');
    }
    if (process.argv.includes('--write')) {
      fs.writeFileSync(file, JSON.stringify(result.workflow, null, 2) + '\n');
      fs.writeFileSync(docFile, doc);
    }
    report.push({ ...entry, converted: result.converted.length, uploads: result.uploads, mcp: result.mcp });
  }
  if (process.argv.includes('--write')) fs.writeFileSync(path.join(__dirname, 'workflow-series.json'), JSON.stringify(entries, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
if (require.main === module) main().catch((e) => { console.error(e.message); process.exitCode = 1; });
module.exports = { checkBody };
