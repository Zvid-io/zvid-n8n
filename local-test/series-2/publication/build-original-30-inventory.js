'use strict';
// Read-only metadata reconciliation; does not run or alter workflows or Flowlu.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ROOT = __dirname, N8N = path.resolve(ROOT, '../../..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
function isQa(row) {
  return /^(?:ZvidSeries2|Series2Edge|Creator|Audit|Retest|TEST|ZZ)/i.test(row.id) ||
    /^(?:TEST\b|TEMP\b|Review\b|QA\b|EDGE\b|ZZ\b|LT ARCHIVE\b)/i.test(row.name);
}
function choose(entry, workflow, nativeRows) {
  const ids = workflow.nodes.filter(node => node.type !== 'n8n-nodes-base.stickyNote').map(node => node.id);
  const eligible = nativeRows.filter(row => !isQa(row)).map(row => ({ ...row,
    sharedCanonicalFunctionalIds: ids.filter(id => row.nodeIds.includes(id)).length }));
  const candidates = eligible.filter(row => row.sharedCanonicalFunctionalIds >= Math.ceil(ids.length * 0.8));
  const tiers = [
    ['Canonical workflow ID exists natively', candidates.filter(row => row.id === workflow.id)],
    ['Exact canonical native workflow name', candidates.filter(row => row.name === workflow.name)],
    ['Exact base day label and matching canonical node identifiers', candidates.filter(row => new RegExp(`^LT D${entry.day}\\s`, 'i').test(row.name))],
  ];
  const [method, found] = tiers.find(([, rows]) => rows.length) || ['No confident current Docker match', []];
  const views = found.map(row => ({ workflowId: row.id, name: row.name,
    url: `http://localhost:5678/workflow/${encodeURIComponent(row.id)}`, active: row.active,
    nodeCount: row.nodeCount, nodeTypes: row.nodeTypes,
    canonicalFunctionalNodeIdsMatched: row.sharedCanonicalFunctionalIds, canonicalFunctionalNodeIdsTotal: ids.length }));
  const chosen = views.length === 1 ? views[0] : null;
  return { day: entry.day, canonicalFile: entry.file, canonicalName: workflow.name,
    canonicalFileLink: `../../../workflows/${entry.file}`, nativeName: chosen?.name || (views.length && views.every(row => row.name === views[0].name) ? views[0].name : null),
    workflowId: chosen?.workflowId || null, url: chosen?.url || null,
    identification: method, status: chosen ? 'identified' : views.length ? 'duplicate_base_copies' : 'unresolved',
    selected: chosen, candidateLinks: chosen ? [] : views,
    freshQaPerformed: false, publicationStatusAssessed: false };
}
function html(report) {
  const rows = report.workflows.map(row => {
    const links = row.url ? `<a href="${escape(row.url)}" target="_blank" rel="noopener noreferrer">Open in n8n</a><small>${escape(row.workflowId)}</small>` : row.candidateLinks.map((item,index) => `<a href="${escape(item.url)}" target="_blank" rel="noopener noreferrer">Existing copy ${index+1}</a><small>${escape(item.workflowId)}</small>`).join('');
    return `<tr><td>${row.day}</td><td><strong>${escape(row.nativeName || row.canonicalName)}</strong>${row.status === 'duplicate_base_copies' ? '<small class="attention">Two base copies; preferred instance unresolved</small>' : row.status === 'unresolved' ? '<small class="attention">No confident Docker match</small>' : ''}</td><td>${links || 'Local link unresolved'}</td><td><a href="${escape(row.canonicalFileLink)}">JSON</a><small>${escape(row.canonicalFile)}</small></td></tr>`;
  }).join('\n');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Zvid · Original 30 n8n templates</title><style>body{margin:0;background:#f8fafb;color:#152331;font:14px/1.5 system-ui,sans-serif}main{max-width:1180px;margin:auto;padding:28px 22px}h1{font-size:26px;margin:0 0 12px}p{max-width:960px}a{color:#164f78;text-underline-offset:3px}table{border-collapse:collapse;width:100%;background:white}td,th{padding:12px;text-align:left;vertical-align:top;border-bottom:1px solid #dfe5e9}th{background:#edf2f5}small{display:block;color:#576773;font-size:12px;margin-top:4px;overflow-wrap:anywhere}.attention{color:#846013}.wrap{overflow:auto;border:1px solid #dfe5e9;border-radius:8px}footer{margin-top:22px;color:#576773;font-size:12px}@media(max-width:700px){table{min-width:770px}main{padding:20px 12px}}</style></head><body><main><h1>Original 30 n8n templates</h1><p>Days 1–30 from the original plan. Names and links come from the current Docker n8n. Existing LT prefixes are retained exactly as installed.</p><p>${report.unambiguousLocalLinks} days have one identified base workflow. Day ${report.ambiguousDays.join(', ') || 'none'} has duplicate base copies; both actual links are shown. This inventory does not perform fresh workflow testing or change publication tracking.</p><div class="wrap"><table><thead><tr><th>Day</th><th>Current Docker workflow name</th><th>Local n8n link</th><th>Source template</th></tr></thead><tbody>${rows}</tbody></table></div><footer>Native metadata captured ${escape(report.nativeCapturedAt)}. <a href="original-30-inventory.json">Inventory JSON</a> · <a href="original-30-native-snapshot.json">Read-only native metadata</a>. New Days 31–60 and temporary QA/review variants are excluded.</footer></main></body></html>\n`;
}
function build() {
  const snapshotFile = path.join(ROOT, 'original-30-native-snapshot.json'), snapshot = read(snapshotFile);
  const seriesFile = path.join(N8N, 'scripts', 'workflow-series.json');
  const entries = read(seriesFile).filter(entry => !entry.variant).sort((a,b) => a.day-b.day);
  if (entries.length !== 30 || entries.some((entry,index) => entry.day !== index+1)) throw new Error('Original series is not exactly Days1–30');
  const workflows = entries.map(entry => choose(entry, read(path.join(N8N, 'workflows', entry.file)), snapshot.workflows));
  const selectedIds = workflows.map(row => row.workflowId).filter(Boolean);
  if (new Set(selectedIds).size !== selectedIds.length) throw new Error('One native workflow matched multiple original days');
  const report = { schemaVersion:1, generatedAt:new Date().toISOString(), nativeCapturedAt:snapshot.capturedAt,
    scope:'Original Days1–30 inventory only; new workflows, variants and temporary QA/review copies excluded',
    databaseMode:'OPEN_READONLY', credentialsRead:false, workflowStateChanged:false, flowluChanged:false, freshQaPerformed:false,
    sourceSeries:{path:'../../../scripts/workflow-series.json',sha256:hash(fs.readFileSync(seriesFile))},
    nativeSnapshot:{path:'original-30-native-snapshot.json',sha256:hash(fs.readFileSync(snapshotFile))},
    totalTemplates:workflows.length, unambiguousLocalLinks:selectedIds.length,
    ambiguousDays:workflows.filter(row=>row.status==='duplicate_base_copies').map(row=>row.day),
    unresolvedDays:workflows.filter(row=>row.status==='unresolved').map(row=>row.day), workflows };
  fs.writeFileSync(path.join(ROOT,'original-30-inventory.json'),JSON.stringify(report,null,2)+'\n');
  fs.writeFileSync(path.join(ROOT,'original-30-inventory.html'),html(report));
  console.log(JSON.stringify({totalTemplates:report.totalTemplates,unambiguousLocalLinks:report.unambiguousLocalLinks,ambiguousDays:report.ambiguousDays,unresolvedDays:report.unresolvedDays}));
  return report;
}
if (require.main === module) build();
module.exports={isQa,choose,build};
