/**
 * Prepare sanitized evidence updates from the local Docker n8n verification files.
 * Native MCP applies the inspected preview/confirm writes; this file performs no network writes.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { esc, validateHtml, FLOWLU } from './flowlu-plan.mjs';

const base = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(base, '..', '..', '..', '..');
const read = name => JSON.parse(readFileSync(resolve(base, name), 'utf8'));
const report = read('flowlu.json');
const executions = read('executions.json');
const mediaRows = read('media-results.json').results;
const canvases = existsSync(resolve(base, 'flowlu-canvas-evidence.json')) ? read('flowlu-canvas-evidence.json') : [];
const requested = process.argv.find(x => x.startsWith('--days='))?.slice(7).split(',').map(Number) || [31, 32, 33, 34];
const final = process.argv.includes('--final-approved');
if (report.upgrade && final) throw new Error('The expanded business-workflow revision needs new source, eligibility, deduplication/resume, delivery and write-back evidence. The prior render-only report cannot close reopened Builds.');
const frameworkConfirmed = final || process.argv.includes('--framework-confirmed');
const finalLog = readFileSync(resolve(base, 'final-tests.log'), 'utf8');
const passBlocks = [...finalLog.matchAll(/\bpass (\d+)/g)].map(match => Number(match[1]));
const failureBlocks = [...finalLog.matchAll(/\bfail (\d+)/g)].map(match => Number(match[1]));
const passes = passBlocks.reduce((sum, count) => sum + count, 0);
const failures = failureBlocks.reduce((sum, count) => sum + count, 0);
const updates = [];
const snapshots = [];
function statusSection(story, stage, artifact) {
  return '<h2>Launch status</h2><ul><li>Stage: ' + esc(stage) + '</li><li>Workflow slug: <code>' + esc(story.slug) + '</code></li><li>Source or artifact: <code>' + esc(artifact) + '</code></li><li>Publication state: Not published</li></ul>';
}
for (const story of report.stories.filter(x => requested.includes(x.day))) {
  const related = executions.filter(x => x.workflowId === 'ZvidSeries2Day' + story.day && x.mode === 'manual').sort((a, b) => Number(b.id) - Number(a.id));
  const latest = related[0];
  const media = mediaRows.find(x => x.day === story.day && Number(x.executionId) === Number(latest?.id));
  const canvas = canvases.find(x => x.day === story.day && x.visualInspection?.startsWith('Verified'));
  const success = latest?.status === 'success' && latest?.lastNode === 'Watch video';
  const mediaPassed = media?.mediaPassed === true && media?.visualReview === 'passed';
  const sourcePath = resolve(repoRoot, story.source);
  JSON.parse(readFileSync(sourcePath, 'utf8'));
  if (final && (!success || !mediaPassed || passes === 0 || failures !== 0)) throw new Error('Final evidence incomplete for day ' + story.day);
  const buildStage = final ? 'Done' : 'In Progress';
  const build = story.children.find(x => x.title === '[Build] Create n8n workflow');
  let details = '<h2>Work item</h2><p>Build and manually verify the canonical n8n automation in the local Docker n8n editor.</p><h2>Completion evidence</h2><ul>' +
    '<li>Canonical JSON: <code>' + esc(story.source) + '</code></li>' +
    '<li>Companion guide: <code>' + esc(story.companionGuide) + '</code></li>' +
    '<li>Local workflow identifier: <code>ZvidSeries2Day' + story.day + '</code></li>' +
    '<li>Recorded automated checks: ' + passes + ' passed; ' + failures + ' failed in <code>zvid-integrations/n8n/local-test/series-2/final-tests.log</code>. ' + (frameworkConfirmed ? 'The root task confirmed final framework and test approval.' : 'Final shared-framework confirmation remains pending.') + '</li>';
  if (latest) {
    details += '<li>Latest recorded manual execution: <code>' + esc(latest.id) + '</code>; status <code>' + esc(latest.status) + '</code>; last node <code>' + esc(latest.lastNode || 'Unknown') + '</code>.</li>';
    if (success) details += '<li>Manual execution completed through the gated Watch video step. The execution success does not by itself establish final media or publication completion.</li>';
  } else {
    details += '<li>No completed manual execution evidence is currently available.</li>';
  }
  if (media?.mediaPassed) {
    details += '<li>Media QA: ' + esc(media.codec) + ', ' + esc(media.width) + ' by ' + esc(media.height) + ', ' + esc(media.actualSeconds) + ' seconds; resolution and duration checks passed. Artifact: <code>zvid-integrations/n8n/local-test/series-2/' + esc(media.file) + '</code>.</li>' +
      '<li>Visual review: <code>' + esc(media.visualReview) + '</code>. ' + esc(media.visualNotes || '') + '</li>';
  } else if (latest) {
    details += '<li>Completed media QA is not verified in the current media report; no media pass is claimed.</li>';
  }
  const priorFailures = related.filter(x => x.status !== 'success');
  if (priorFailures.length) details += '<li>Prior failed executions, excluded from successful evidence: ' + priorFailures.map(x => '<code>' + esc(x.id) + '</code> at <code>' + esc(x.lastNode || 'Unknown') + '</code>').join('; ') + '.</li>';
  details += '</ul><h2>Dependencies and next action</h2><p>' +
    (final ? 'No remaining n8n build work. Cloud releases, community publication, Make work and distribution remain in their separate launch children.' :
      story.day === 31 ? 'The singular release-note wording was corrected after the recorded render. Rerun the final canonical revision and verify its media before Done.' :
      frameworkConfirmed ? 'Finish the pending manual execution and matching media QA. Resolve any current runtime issue, rerun the canonical workflow, and verify its output before Done. The final shared-framework checks are approved.' : 'Await final shared-framework and automated-test confirmation. Re-execute and recapture if the canonical behavior or layout changes. Keep this build In Progress until the root task confirms final evidence.') + '</p>';
  updates.push({ id: build.id, slug: story.slug, child: build.title, stage: buildStage, data: { description: validateHtml(statusSection(story, buildStage, story.source) + details), workflow_stage_id: FLOWLU.stages[buildStage] } });
  const asset = story.children.find(x => x.title === '[Asset] Capture n8n workflow screenshot');
  let assetStage = asset.stage;
  if (canvas && asset.stage !== 'Done') {
    assetStage = final && canvas.publicationReadable === true && canvas.matchesFinalLayout === true ? 'Done' : 'Review';
    const html = statusSection(story, assetStage, canvas.path) +
      '<h2>Work item</h2><p>Capture and inspect the actual n8n workflow canvas.</p><h2>Completion evidence</h2><ul>' +
      '<li>PNG: <code>' + esc(canvas.path) + '</code></li>' +
      '<li>Dimensions: ' + canvas.width + ' by ' + canvas.height + '; ' + canvas.bytes + ' bytes.</li>' +
      '<li>SHA-256: <code>' + esc(canvas.sha256) + '</code></li>' +
      '<li>Visual inspection: ' + esc(canvas.visualInspection) + '.</li>' +
      '<li>The original browser capture was preserved. This PNG uses the same decoded image pixels.</li></ul>' +
      '<h2>Dependencies and next action</h2><p>' + (assetStage === 'Done' ? 'The validated final build and matching readable canvas were confirmed. No remaining screenshot work.' : 'This is an inspected screenshot draft. The text is too small at the current fit view for a publication asset. Capture a readable final canvas view and confirm it matches the final layout before Done.') + '</p>';
    updates.push({ id: asset.id, slug: story.slug, child: asset.title, stage: assetStage, data: { description: validateHtml(html), workflow_stage_id: FLOWLU.stages[assetStage] } });
  }
  const projected = story.children.map(x => x.title === build.title ? buildStage : x.title === '[Asset] Capture n8n workflow screenshot' && assetStage ? assetStage : x.stage);
  const stageCounts = projected.reduce((a, stage) => { a[stage] = (a[stage] || 0) + 1; return a; }, {});
  const remaining = projected.filter(x => x !== 'Done').length;
  const html = '<h2>Launch status</h2><p>The current request covers preparation and manual Docker n8n testing. Current child stages: ' + Object.entries(stageCounts).map(([stage, count]) => count + ' ' + esc(stage)).join('; ') + '. Remaining children: ' + remaining + '; blocked children: 0. No public publication is claimed.</p>' +
    '<h2>Managed workflow</h2><ul><li>Managed by: flowlu-workflow-launch</li><li>Workflow slug: <code>' + esc(story.slug) + '</code></li><li>n8n source: <code>' + esc(story.source) + '</code></li><li>Make source: Not created</li><li>Content directory: Not created</li><li>n8n cloud URL: Not published</li><li>Make cloud URL: Not published</li></ul>' +
    '<h2>Completion evidence</h2><p>Local workflow <code>ZvidSeries2Day' + story.day + '</code>; ' + (latest ? 'latest recorded manual execution <code>' + esc(latest.id) + '</code> has status <code>' + esc(latest.status) + '</code>.' : 'manual execution remains pending.') + ' Evidence is held in <code>zvid-integrations/n8n/local-test/series-2/executions.json</code> and <code>zvid-integrations/n8n/local-test/series-2/media-results.json</code>.</p>' +
    '<h2>Public companion prerequisite</h2><p>The local guide is <code>' + esc(story.companionGuide) + '</code>. Before a future public template/community release, publish it, verify its public URL, and replace the inline filename in the overview with that verified guide link.</p>' +
    '<h2>Next action</h2><p>' + (final ? 'Complete the remaining launch checklist when requested. Keep this Story In Progress until every required child is Done or explicitly completed as out of scope.' : frameworkConfirmed ? 'Finish the current manual n8n execution and media verification. Final framework checks are approved. Keep the Story In Progress.' : 'Finish the current n8n verification phase and obtain final framework confirmation. Keep the Story In Progress.') + '</p>';
  updates.push({ id: story.storyId, slug: story.slug, child: 'Story roll-up', stage: 'In Progress', data: { description: validateHtml(html) } });
  snapshots.push({ day: story.day, slug: story.slug, workflowId: latest?.workflowId, executionId: latest?.id, manualStatus: latest?.status || 'Not tested', lastNode: latest?.lastNode, mediaPassed, mediaReview: media?.visualReview || 'Unverified', buildStage, assetStage, requiredChildrenRemaining: remaining, failedExecutionIds: priorFailures.map(x => x.id) });
}
const result = { phase: final ? 'Final root-approved evidence' : frameworkConfirmed ? 'Interim evidence; final framework approved and execution/media verification pending' : 'Interim evidence; final framework confirmation pending', automatedCheckPasses: passes, automatedCheckFailures: failures, snapshots, updates };
writeFileSync(resolve(base, 'flowlu-evidence-updates.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ phase: result.phase, snapshots, updateCount: updates.length }));
