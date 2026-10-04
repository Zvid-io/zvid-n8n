'use strict';
// Local review artifacts only. Never submit templates or reuse the earlier render-only report.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { adapters } = require('../../../scripts/series-two-source-adapters');
const { functionalHash, sha256 } = require('./infra-functional-fingerprint');
const ROOT = __dirname;
const N8N = path.resolve(ROOT, '../../..');
const INPUTS = {
  tests: 'verified-tests.log', imports: 'infra-import-audit.json',
  executions: 'upgraded-executions.json', media: 'upgraded-media-results.json',
  canvas: 'upgraded-canvas-audit.json', verification: 'upgraded-verification.json',
};
const WRITEBACK = ['automation_status', 'request_key', 'input_hash', 'job_id', 'video_url', 'drive_file_id', 'drive_url', 'completed_at', 'outcome_summary', 'automation_error'];
const SERVICES = ['n8n with Data Tables', '@zvid/n8n-nodes-zvid', 'Zvid credits', 'Google Sheets', 'Google Drive'];
// Each explanation is grounded in its adapter's existing fields and policy, not extra apps.
const VIDEO_REASONS = {
  31: 'A short recap helps product marketing introduce customer-visible changes together with their version and release date.',
  32: 'An ordered visual introduction helps trainers explain the procedure outcome and sequence before readers follow the full approved steps.',
  33: 'A side-by-side visual summary helps sales explain the current plans, prices and features from a single catalog revision.',
  34: 'A chronological recap helps service communications explain what happened, when updates occurred and when service was restored.',
  35: 'A dated service-window briefing helps customer success explain the upcoming disruption and affected features consistently.',
  36: 'An order-specific progress summary helps support explain the current fulfillment transition and estimated delivery.',
  37: 'A component-price comparison helps merchandising explain an eligible bundle without making an unsupported savings claim.',
  38: 'A revised-ETA briefing helps delivery support explain the actual delay, reason and next step for the affected order.',
  39: 'A booking-specific checklist helps appointment coordinators make preparation and location details easier to review.',
  40: 'A packing and drop-off briefing helps returns support present the authorized items, deadline and ordered return steps.',
  41: 'A first-week agenda helps people operations introduce the role and scheduled onboarding sessions in their actual sequence.',
  42: 'A timed candidate agenda helps recruiting coordinators explain the interview topics and assigned interviewers.',
  43: 'A course roadmap helps learning teams introduce module order, duration and learning outcomes before the learner starts.',
  44: 'A site briefing helps supervisors introduce hazards, controls and the emergency instruction alongside the full approved assessment.',
  45: 'A result summary helps training administrators explain the finalized score and the correct certificate or remediation next action.',
  46: 'An owner-and-deadline briefing helps meeting owners focus follow-up on unresolved tasks that need action now.',
  47: 'A due-service briefing helps maintenance planners review affected asset IDs and approved procedures before scheduling work.',
  48: 'A low-stock summary helps buyers review the affected SKUs and required quantities before approving replenishment.',
  49: 'A driver-specific route briefing helps dispatchers explain the ordered stops and declared travel and service times.',
  50: 'A readiness briefing helps bid coordinators review verified eligibility, document owners and remaining evidence before the deadline.',
  51: 'A chronological itinerary helps travel coordinators introduce confirmed activities using the declared destination timezone.',
  52: 'An arrival guide helps accommodation operators explain approved public guidance, check-in details and amenities consistently.',
  53: 'An adoption profile helps shelter coordinators introduce an available animal, its traits and care needs with a current application link.',
  54: 'A station briefing helps volunteer coordinators communicate the confirmed shift roster and assigned tasks after coverage checks.',
  55: 'An estimated-impact summary helps fundraising teams thank an eligible donor using the approved cost model and matching currency.',
  56: 'A visual results breakdown helps research owners explain a closed survey using the reproducible response aggregation.',
  57: 'A milestone update helps campaign managers explain newly reached progress using eligible settled contributions.',
  58: 'A before-and-after comparison helps customer success explain measured changes with their units and declared measurement periods.',
  59: 'A delivery roadmap helps project managers communicate milestones, overdue work and the next actions for the reporting period.',
  60: 'A portion-specific cooking briefing helps kitchen trainers explain the scaled ingredient amounts and complete preparation sequence.',
};
function readJson(name) {
  const file = path.join(ROOT, name);
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { throw new Error(`Cannot read ${name}: ${error.message}`); }
}
function rows(value) {
  if (Array.isArray(value)) return value;
  return value?.workflows || value?.results || value?.days || [];
}
function plain(markdown) {
  return markdown.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    .replace(/^#{1,6}\s+/gm, '').replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1').replace(/\r\n/g, '\n').trim();
}
function submissionDraft(markdown) {
  const match = markdown.match(/^## Publication submission draft\s*\n([\s\S]*?)(?=^## |$(?![\s\S]))/m);
  if (!match) throw new Error('Companion guide is missing its publication submission draft.');
  return plain(match[1]);
}
function automatedResult(text) {
  function count(label) {
    const hits = [...text.matchAll(new RegExp(`(?:^|\\n)[^\\n]*?\\b${label}\\s+(\\d+)\\s*(?=\\r?\\n|$)`, 'g'))];
    return hits.length ? Number(hits.at(-1)[1]) : null;
  }
  const result = { tests: count('tests'), passed: count('pass'), failed: count('fail'), cancelled: count('cancelled'), skipped: count('skipped'), todo: count('todo') };
  result.verified = Number.isInteger(result.tests) && result.tests > 0 && result.tests === result.passed && result.failed === 0;
  return result;
}
function https(value) {
  if (typeof value !== 'string') return null;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? value : null; }
  catch { return null; }
}
function evidenceFile(name) {
  return fs.existsSync(path.join(ROOT, name)) ? name : null;
}
function nativeNodePassed(attempt, name) {
  return attempt?.nodes?.[name]?.some(run => run.status === 'success' && run.totalOutputItems > 0) === true;
}
function sameReceipt(attempt) {
  const o = attempt?.outcome, r = attempt?.receipt;
  return !!o && !!r && o.status === 'delivered' && r.status === 'delivered' &&
    ['sourceId', 'revision', 'requestKey', 'jobId', 'driveFileId'].every(key => typeof o[key] === 'string' && o[key] && o[key] === r[key]) &&
    !!https(o.videoUrl) && o.videoUrl === r.videoUrl && !!https(o.driveUrl) && o.driveUrl === r.driveUrl &&
    nativeNodePassed(attempt, 'Business outcome') && nativeNodePassed(attempt, 'Read back delivery receipt');
}
function matchingEvidence(evidence, day, hash, executionId) {
  return rows(evidence).filter(item => Number(item.day) === day &&
    (item.functionalHash || item.canonicalFunctionalHash) === hash &&
    (executionId === undefined || String(item.executionId) === String(executionId)));
}
function verifiedCheck(record, key) {
  const check = record?.checks?.[key];
  return check === true || check?.passed === true;
}
function retainedIdentity(first, second) {
  return !!first && !!second && ['sourceId', 'revision', 'requestKey', 'jobId', 'driveFileId', 'videoUrl', 'driveUrl'].every(key =>
    typeof first.outcome?.[key] === 'string' && first.outcome[key] && first.outcome[key] === second.outcome?.[key]) &&
    ['inputHash', 'projectSha256'].every(key => /^[a-f\d]{64}$/.test(first.frozen?.[key] || '') && first.frozen[key] === second.frozen?.[key]) &&
    first.frozen.inputHash === first.receipt?.inputHash && second.frozen.inputHash === second.receipt?.inputHash;
}
function savedMediaMatches(record) {
  if (typeof record?.file !== 'string' || !/^[a-f\d]{64}$/.test(record.sha256 || '')) return false;
  try {
    const file = fs.realpathSync(path.resolve(ROOT, record.file)), relative = path.relative(ROOT, file);
    return !relative.startsWith('..') && !path.isAbsolute(relative) && crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') === record.sha256;
  } catch { return false; }
}
function mediaMatches(record, delivered, deliveries) {
  const reviewedExecution = deliveries.find(attempt => String(attempt.id) === String(record.executionId));
  return record.passed === true && record.technicalPassed === true && record.mediaPassed === true && record.visualReview === 'passed' &&
    retainedIdentity(delivered, reviewedExecution) && record.jobId === delivered.outcome.jobId && record.driveFileId === delivered.outcome.driveFileId &&
    record.projectSha256 === delivered.frozen.projectSha256 && record.inputHash === delivered.frozen.inputHash && savedMediaMatches(record);
}
function evidenceFor(day, workflow, artifactHash, inputs) {
  const hash = functionalHash(workflow), workflowId = `ZvidSeries2Day${day}`;
  const imported = rows(inputs.imports).find(item => Number(item.day) === day && item.workflowId === workflowId && item.passed === true &&
    item.canonicalFunctionalHash === hash && item.installedFunctionalHash === hash && item.functionalMatch === true && item.credentialBindingsValid === true);
  // A successful dry run, no-work result or old execution never becomes a delivery pass.
  const attempts = (inputs.executions?.attempts || []).filter(item => Number(item.day) === day && item.workflowId === workflowId);
  const current = attempts.filter(item => item.functionalMatch === true && item.executionFunctionalHash === hash && item.canonicalFunctionalHash === hash && Number(item.id) > 737);
  const deliveries = current.filter(item => item.mode === 'manual' && item.status === 'success' && item.outcome?.dryRun !== true && sameReceipt(item));
  const delivered = deliveries.at(-1) || null;
  const report = matchingEvidence(inputs.verification, day, hash).find(item => {
    const mainId = item.mainRenderExecutionId || item.manual?.executionId || item.executionId;
    const main = deliveries.find(attempt => String(attempt.id) === String(mainId));
    return item.rootConfirmed === true && item.artifactSha256 === artifactHash && retainedIdentity(delivered, main) &&
      ['sourceId', 'revision', 'requestKey'].every(key => item[key] === delivered.outcome[key]) &&
      (!item.latestDeliveryExecutionId || String(item.latestDeliveryExecutionId) === String(delivered.id));
  });
  const media = delivered ? matchingEvidence(inputs.media, day, hash).find(item => mediaMatches(item, delivered, deliveries)) : null;
  const canvas = matchingEvidence(inputs.canvas, day, hash).find(item => item.passed === true && item.artifactSha256 === artifactHash && item.allTextFits === true && Array.isArray(item.overlaps) && !item.overlaps.length && item.actualCanvasInspected === true && item.allFunctionalNodesCovered === true && item.fitVisuallyInspected === true && item.readableOverview === true && item.representativeSectionsReadable === true);
  const checks = {
    currentDockerImport: !!imported,
    manualSourceToDriveDelivery: !!delivered,
    mediaQA: !!media,
    currentCanvasQA: !!canvas,
    rootConfirmed: !!report && inputs.verification?.rootReportConfirmed === true,
    eligibility: verifiedCheck(report, 'eligibility'),
    deduplication: verifiedCheck(report, 'deduplication'),
    resumeAccepted: verifiedCheck(report, 'resumeAccepted'),
    deliveryRecovery: verifiedCheck(report, 'deliveryRecovery'),
  };
  const fullyVerified = Object.values(checks).every(Boolean);
  const failed = current.filter(item => item.status === 'error');
  const status = fullyVerified ? 'verified_local_delivery' : delivered ? 'delivered_qa_pending' : 'testing_pending';
  const publicGuide = report?.publicGuide?.verified === true ? https(report.publicGuide.url) : null;
  return {
    status, statusLabel: fullyVerified ? 'Local delivery verified' : delivered ? 'Delivered; QA pending' : 'Testing pending', checks,
    executionId: delivered?.id || null, mainRenderExecutionId: report?.mainRenderExecutionId || report?.manual?.executionId || report?.executionId || null,
    mediaQaExecutionId: media?.executionId || null, mediaSha256: media?.sha256 || null,
    mediaReusedForRetainedIdentity: !!media && String(media.executionId) !== String(delivered.id),
    fixtureSource: delivered?.syntheticFixture === true,
    sourceId: delivered?.outcome?.sourceId || null, revision: delivered?.outcome?.revision || null,
    jobId: delivered?.outcome?.jobId || null, driveFileId: delivered?.outcome?.driveFileId || null,
    currentAttemptCount: current.length, oldOrDifferentRevisionAttemptCount: attempts.length - current.length,
    failedCurrentAttemptIds: failed.map(item => item.id),
    videoUrl: delivered ? https(delivered.outcome.videoUrl) : null,
    driveUrl: delivered ? https(delivered.outcome.driveUrl) : null,
    publicGuideUrl: publicGuide,
    submissionReady: fullyVerified && !!publicGuide,
    links: {
      import: evidenceFile(INPUTS.imports), executions: evidenceFile(INPUTS.executions),
      media: media ? evidenceFile(INPUTS.media) : null, canvas: canvas ? evidenceFile(INPUTS.canvas) : null,
      verification: report ? evidenceFile(INPUTS.verification) : null,
    },
  };
}
function escape(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function link(href, text) { return href ? `<a href="${escape(href)}"${/^https?:/.test(href) ? ' target="_blank" rel="noopener noreferrer"' : ''}>${escape(text)}</a>` : ''; }
function complexity(adapter) {
  const kinds = Object.entries(adapter.detailKinds);
  const joined = kinds.length ? `Typed ${kinds.map(([kind]) => kind).join(', ')} rows join the source by parent_id and revision; their required fields preserve the authoritative detail.` : 'The source row carries the complete approved delay record; the workflow does not require invented child records.';
  return `${adapter.policy} ${joined} The persistent request fingerprint prevents duplicate completed revisions. Saved job and file checkpoints let interrupted work resume without blindly submitting another paid render or uploading another file. Revision rechecks and receipt readback protect the source writeback. ${adapter.refreshPolicy}`;
}
function packetText(entry) {
  return `${entry.title}\nDay ${entry.day} — ${entry.audience}\n\nLOCAL SUBMISSION DRAFT — NOT SUBMITTED\n\n${entry.submissionDraft}\n\nWhy a video is useful\n${entry.whyVideoUseful}\nThe video is a review summary; the full approved source record remains authoritative.\n\nWhy the workflow complexity is justified\n${entry.whyComplexityJustified}\n\nEligibility policy\n${entry.policy}\n\nInput register\n${entry.sourceTab}: ${entry.primaryHeaders.join(', ')}\n${entry.detailsTab}: ${entry.detailHeaders.join(', ')}\nTyped child rows: ${Object.keys(entry.detailKinds).join(', ') || 'None required for this use case'}\n\nBusiness handoff\n${entry.outcome}\n\nSetup prerequisites\nInstall @zvid/n8n-nodes-zvid from Settings → Community nodes before configuring Zvid credentials; a workspace owner/admin may need to install it.\nCreate a Zvid API key at https://app.zvid.io/api-keys and configure Google Sheets and Google Drive OAuth2 credentials. Use a private Drive folder and a persistent n8n Data Table.\ndryRun: false submits paid renders after the free validation/quote and configured credit ceiling. Run one execution at a time; review the companion guide's lost-response reconciliation and concurrency limits.\n\nCurrent verification\n${entry.testing.statusLabel}. The earlier generation-only runs are excluded. See the local catalog for current native execution, import, media and canvas evidence.\n\nBefore actual n8n submission\n${entry.publicGuideRequirement}\nComplete the current manual source-to-Drive delivery, eligibility, deduplication, accepted-job resume, delivery-recovery, media and canvas checks. Attach current screenshots and evidence. n8n determines acceptance.\n\nCompanion guide included locally: ${entry.guideFilename}\nCanonical workflow included locally: ${entry.jsonFilename}\nNo automatic publication, public Drive sharing or community submission has been performed.\n`;
}
function html(catalog) {
  const renderRows = catalog.workflows.map(entry => {
    const evidence = [link(entry.testing.links.import, 'Import'), link(entry.testing.links.executions, 'Runs'), link(entry.testing.links.media, 'Media QA'), link(entry.testing.links.canvas, 'Canvas QA'), link(entry.testing.links.verification, 'Recovery QA')].filter(Boolean).join(' · ');
    return `<tr data-search="${escape(`${entry.day} ${entry.title} ${entry.audience} ${entry.need}`.toLowerCase())}"><td>${entry.day}</td><td><strong>${link(entry.links.workflow, entry.title)}</strong><small>${escape(entry.audience)}</small></td><td>${escape(entry.need)}<details><summary>Use case, rules &amp; source fields</summary><p><b>Why video:</b> ${escape(entry.whyVideoUseful)} Full source records remain authoritative.</p><p><b>Eligibility:</b> ${escape(entry.policy)}</p><p><b>Justified complexity:</b> ${escape(entry.whyComplexityJustified)}</p><p><b>Handoff:</b> ${escape(entry.outcome)}</p><p><b>Refresh:</b> ${escape(entry.refreshPeriod)} — ${escape(entry.refreshPolicy)}</p><p><b>${escape(entry.sourceTab)}:</b> ${escape(entry.primaryHeaders.join(', '))}</p><p><b>${escape(entry.detailsTab)}:</b> ${escape(entry.detailHeaders.join(', '))}</p><p><b>Typed detail rows:</b> ${escape(Object.entries(entry.detailKinds).map(([kind, headers]) => `${kind} (${headers.join(', ')})`).join('; ') || 'None required')}</p><p><b>Current checks:</b> ${escape(Object.entries(entry.testing.checks).map(([name, passed]) => `${name}: ${passed ? 'confirmed' : 'pending'}`).join('; '))}</p></details></td><td><span class="status ${entry.testing.status}">${escape(entry.testing.statusLabel)}</span>${entry.testing.executionId ? `<small>Manual execution ${escape(entry.testing.executionId)}${entry.testing.fixtureSource ? ' · live QA fixture' : ''}</small>` : ''}${entry.testing.failedCurrentAttemptIds.length ? `<small>${entry.testing.failedCurrentAttemptIds.length} failed current attempt(s) retained in evidence</small>` : ''}<small>${evidence || 'Current live evidence pending'}</small></td><td class="links">${[link(entry.links.guide, 'Guide'), link(entry.links.json, 'JSON'), link(entry.links.submissionDraft, 'Submission draft'), link(entry.testing.videoUrl, 'Video'), link(entry.testing.driveUrl, 'Drive')].filter(Boolean).join(' · ')}<small>${entry.testing.publicGuideUrl ? link(entry.testing.publicGuideUrl, 'Verified public guide') : 'Public companion link needed before submission'}</small></td></tr>`;
  }).join('\n');
  const tests = catalog.automated;
  return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Zvid · 30 complete n8n workflow drafts</title><style>
:root{color-scheme:light;--ink:#152331;--muted:#576773;--line:#dfe5e9;--accent:#164f78}*{box-sizing:border-box}body{margin:0;background:#f8fafb;color:var(--ink);font:14px/1.5 system-ui,sans-serif}main{max-width:1600px;margin:auto;padding:30px 24px}h1{font-size:26px;line-height:1.2;margin:0 0 10px}p{margin:10px 0}a{color:var(--accent);text-underline-offset:3px}header{max-width:1150px}.lede{font-size:16px}.cards{display:flex;gap:12px;flex-wrap:wrap;margin:20px 0}.card{border:1px solid var(--line);background:white;border-radius:8px;padding:12px 16px;min-width:190px}.card b{display:block;font-size:22px}.note{padding:12px 16px;border-left:3px solid #b98521;background:#fff7e7;max-width:1150px}.toolbar{display:flex;align-items:center;gap:14px;margin:24px 0 12px}input{width:min(440px,100%);padding:10px 12px;border:1px solid #b8c6d0;border-radius:6px;font:inherit}.table-wrap{overflow:auto;border:1px solid var(--line);border-radius:8px;background:white}table{border-collapse:collapse;width:100%;min-width:980px}th,td{text-align:left;vertical-align:top;border-bottom:1px solid var(--line);padding:13px 12px}th{background:#edf2f5;color:#344b5c;font-size:12px;letter-spacing:.04em;text-transform:uppercase}th:nth-child(1){width:4%}th:nth-child(2){width:23%}th:nth-child(3){width:36%}th:nth-child(4){width:19%}th:nth-child(5){width:18%}tr:last-child td{border-bottom:0}small{display:block;color:var(--muted);font-size:12px;margin-top:5px}strong{font-weight:650}summary{cursor:pointer;color:var(--accent);margin-top:8px;font-size:12px}details p{font-size:12px;overflow-wrap:anywhere}.status{display:inline-block;border-radius:4px;background:#eef1f4;padding:3px 7px;font-size:12px;font-weight:650;white-space:nowrap}.delivered_qa_pending{background:#fff3cd;color:#705613}.verified_local_delivery{background:#e6f4ed;color:#176346}.links{line-height:1.8}footer{margin:24px 0;color:var(--muted);font-size:12px}code{font-size:12px}.muted{color:var(--muted)}@media(max-width:700px){main{padding:22px 12px}h1{font-size:23px}.card{min-width:145px}}
</style></head><body><main><header><p class="muted">LOCAL PUBLICATION REVIEW · DAYS 31–60</p><h1>30 use-case-driven n8n workflow drafts</h1><p class="lede">Each workflow reads an approved business record, applies its domain rules, resumes durable work, delivers a private Drive video and writes a verified receipt back to the source register.</p><p>Required services: n8n Data Tables, <code>@zvid/n8n-nodes-zvid</code>, Zvid, Google Sheets and Google Drive. Rendering spends credits; every workflow includes the free validation/quote and a configured credit ceiling.</p></header><div class="cards"><div class="card"><b>30</b>Workflow drafts</div><div class="card"><b>${tests.verified ? tests.passed : 'Pending'}</b>Automated tests passed · ${tests.failed ?? 'unknown'} failed<br>${link(INPUTS.tests, 'Exact test log')}</div><div class="card"><b>${catalog.summary.currentDockerImports}/30</b>Current Docker imports verified</div><div class="card"><b>${catalog.summary.manualDeliveries}/30</b>Current manual deliveries observed</div><div class="card"><b>${catalog.summary.fullyVerified}/30</b>Full local verification complete</div></div><p class="note">These are local submission drafts. Earlier generation-only test results are excluded. A verified public companion-guide link and current manual delivery, recovery, media and canvas evidence are required before actual submission. No templates have been submitted from this catalog.</p><div class="toolbar"><label for="search">Find a workflow</label><input id="search" type="search" placeholder="Day, title, audience or business need"><span id="count" class="muted">30 workflows</span></div><div class="table-wrap"><table><thead><tr><th>Day</th><th>Workflow</th><th>Business need</th><th>Current testing</th><th>Files &amp; output</th></tr></thead><tbody>${renderRows}</tbody></table></div><footer><p>${link('publication-catalog.json', 'Catalog JSON')} · ${link('publication-use-cases.json', 'Use-case metadata')} · ${link('publication-submission-packet.json', 'Submission packets')} · ${link('publication-catalog-evidence-contract.md', 'Evidence contract')}</p><p>Generated ${escape(catalog.generatedAt)}. Workflow links open the local Docker n8n at localhost:5678; Google Drive links are private QA outputs. Keep source and output permissions restricted to the intended audience. Support: ${link('https://zvid.io/contact', 'https://zvid.io/contact')}.</p></footer></main><script>const input=document.getElementById('search'),rows=[...document.querySelectorAll('tbody tr')];input.addEventListener('input',()=>{const query=input.value.trim().toLowerCase();let count=0;for(const row of rows){row.hidden=!row.dataset.search.includes(query);if(!row.hidden)count++;}document.getElementById('count').textContent=count+' workflow'+(count===1?'':'s');});</script></body></html>\n`;
}
function build() {
  const testText = fs.readFileSync(path.join(ROOT, INPUTS.tests), 'utf8');
  const inputs = Object.fromEntries(Object.entries(INPUTS).filter(([key]) => key !== 'tests').map(([key, name]) => [key, readJson(name)]));
  const automated = { ...automatedResult(testText), evidence: INPUTS.tests, logSha256: sha256(testText) };
  const workflows = Object.values(adapters).sort((a, b) => a.day - b.day).map(adapter => {
    const jsonFilename = `zvid-${adapter.slug}.json`, guideFilename = `${adapter.slug}.md`;
    const raw = fs.readFileSync(path.join(N8N, 'workflows', jsonFilename), 'utf8');
    const workflow = JSON.parse(raw), guide = fs.readFileSync(path.join(N8N, 'workflows', guideFilename), 'utf8');
    const artifactSha256 = sha256(raw), testing = evidenceFor(adapter.day, workflow, artifactSha256, inputs);
    return { ...adapter, title: adapter.title, canvasName: workflow.name, workflowId: `ZvidSeries2Day${adapter.day}`,
      jsonFilename, guideFilename, canonicalArtifactSha256: artifactSha256, functionalHash: functionalHash(workflow),
      functionalNodeCount: workflow.nodes.filter(node => node.type !== 'n8n-nodes-base.stickyNote').length,
      sourceHeaders: adapter.primaryHeaders.filter(header => !WRITEBACK.includes(header)), writebackHeaders: WRITEBACK,
      requiredServices: SERVICES, whyVideoUseful: VIDEO_REASONS[adapter.day], whyComplexityJustified: complexity(adapter),
      submissionDraft: submissionDraft(guide), publicGuideRequirement: testing.publicGuideUrl ? `Verified public companion guide: ${testing.publicGuideUrl}` : 'Publish the included companion guide, verify its public URL, and update the overview reference before actual n8n submission.',
      testing, links: { workflow: `http://localhost:5678/workflow/ZvidSeries2Day${adapter.day}`, json: `../../../workflows/${jsonFilename}`, guide: `../../../workflows/${guideFilename}`, submissionDraft: `submission-packets/day-${adapter.day}-${adapter.slug}.txt` },
    };
  });
  const catalog = { schemaVersion: 1, generatedAt: new Date().toISOString(), purpose: 'Local review and submission preparation; no submission performed',
    oldRenderOnlyEvidenceExcluded: true, evidenceInputs: INPUTS, automated,
    summary: { total: workflows.length, currentDockerImports: workflows.filter(w => w.testing.checks.currentDockerImport).length, manualDeliveries: workflows.filter(w => w.testing.checks.manualSourceToDriveDelivery).length, currentCanvasQa: workflows.filter(w => w.testing.checks.currentCanvasQA).length, mediaQa: workflows.filter(w => w.testing.checks.mediaQA).length, fullyVerified: workflows.filter(w => w.testing.status === 'verified_local_delivery').length, verifiedPublicGuides: workflows.filter(w => w.testing.publicGuideUrl).length, submissionReady: workflows.filter(w => w.testing.submissionReady).length }, workflows };
  fs.mkdirSync(path.join(ROOT, 'submission-packets'), { recursive: true });
  workflows.forEach(entry => fs.writeFileSync(path.join(ROOT, entry.links.submissionDraft), packetText(entry)));
  fs.writeFileSync(path.join(ROOT, 'publication-catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
  fs.writeFileSync(path.join(ROOT, 'publication-catalog.html'), html(catalog));
  fs.writeFileSync(path.join(ROOT, 'publication-use-cases.json'), JSON.stringify({ schemaVersion: 1, generatedAt: catalog.generatedAt, workflows: workflows.map(({ day, slug, title, audience, need, policy, outcome, refreshPeriod, refreshPolicy, sourceTab, detailsTab, sourceHeaders, primaryHeaders, detailHeaders, detailKinds, writebackHeaders, whyVideoUseful, whyComplexityJustified, links }) => ({ day, slug, title, audience, need, policy, outcome, refreshPeriod, refreshPolicy, sourceTab, detailsTab, sourceHeaders, primaryHeaders, detailHeaders, detailKinds, writebackHeaders, whyVideoUseful, whyComplexityJustified, links })) }, null, 2) + '\n');
  fs.writeFileSync(path.join(ROOT, 'publication-submission-packet.json'), JSON.stringify({ schemaVersion: 1, generatedAt: catalog.generatedAt, submitted: false, guideUrlRequirement: 'A verified public companion-guide URL must be added before actual submission.', workflows: workflows.map(entry => ({ day: entry.day, title: entry.title, audience: entry.audience, submitted: false, requiredServices: entry.requiredServices, draftCopiedFrom: entry.links.guide, draftPlainText: entry.submissionDraft, need: entry.need, policy: entry.policy, outcome: entry.outcome, whyVideoUseful: entry.whyVideoUseful, whyComplexityJustified: entry.whyComplexityJustified, publicCompanionGuideUrl: entry.testing.publicGuideUrl, submissionReady: entry.testing.submissionReady, localDraftFile: entry.links.submissionDraft })) }, null, 2) + '\n');
  console.log(JSON.stringify({ ...catalog.summary, automatedTests: automated.tests, automatedPassed: automated.passed, automatedFailed: automated.failed, output: 'publication-catalog.html' }));
  return catalog;
}
if (require.main === module) build();
module.exports = { INPUTS, automatedResult, submissionDraft, sameReceipt, retainedIdentity, savedMediaMatches, mediaMatches, evidenceFor, build };
