'use strict';

const fs = require('node:fs');
const path = require('node:path');
const specs = require('./series-two-specs');
const { assertWorkflow } = require('./series-two-framework');
const { buildPublicationWorkflow } = require('./series-two-publication-framework');
const root = path.resolve(__dirname, '..');
const local = path.join(root, 'local-test/series-2');
fs.mkdirSync(local, { recursive: true });
const imports = [];
const catalog = [];
for (const spec of specs) {
  const built = buildPublicationWorkflow(spec);
  const workflow = built.workflow || built;
  assertWorkflow(workflow);
  const filename = `zvid-${spec.slug}.json`;
  fs.writeFileSync(path.join(root, 'workflows', filename), JSON.stringify(workflow, null, 2) + '\n');
  if (built.doc) fs.writeFileSync(path.join(root, 'workflows', `${spec.slug}.md`), built.doc + '\n');
  const configured = structuredClone(workflow);
  configured.id = `ZvidSeries2Day${spec.day}`;
  configured.name = `D${spec.day} ${spec.title} (Zvid)`;
  configured.active = false;
  for (const node of configured.nodes) {
    if (node.type === '@zvid/n8n-nodes-zvid.zvid') node.credentials = { zvidApi: { id: 'e3b494f287402c80c13bf080', name: 'Zvid workflow series' } };
    if (node.type === 'n8n-nodes-base.googleSheets') node.credentials = { googleSheetsOAuth2Api: { id: '4brcFt0P3EihgxJb', name: 'Google Sheets account' } };
    if (node.type === 'n8n-nodes-base.googleDrive') node.credentials = { googleDriveOAuth2Api: { id: 'UH2cKTIIc4ymModq', name: 'Google Drive account' } };
  }
  imports.push(configured);
  catalog.push({ day: spec.day, slug: spec.slug, title: spec.title, filename, workflowId: configured.id, url: `http://localhost:5678/workflow/${configured.id}`, fields: spec.fields, description: spec.description });
}
fs.writeFileSync(path.join(local, 'imports.json'), JSON.stringify(imports, null, 2) + '\n');
fs.writeFileSync(path.join(local, 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
console.log(JSON.stringify({ workflows: catalog.length, days: [catalog[0].day, catalog.at(-1).day], imports: 'local-test/series-2/imports.json' }));
