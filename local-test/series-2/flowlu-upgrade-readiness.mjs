/** Offline evidence inspection only. This module never writes to Flowlu or remote services. */
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname, resolve, relative, isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {functionalHash: officialFunctionalHash} = require('./publication/infra-functional-fingerprint.js');
const {adapters: sourceAdapters} = require('../../scripts/series-two-source-adapters.js');

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const validHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
export function functionalFingerprint(workflow) {
  return officialFunctionalHash(workflow);
}
export function isPng(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 45 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') return false;
  let offset = 8, header = false, pixels = false;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset), type = bytes.toString('ascii', offset + 4, offset + 8);
    if (length > bytes.length - offset - 12) return false;
    if (!header) {
      if (type !== 'IHDR' || length !== 13 || !bytes.readUInt32BE(offset + 8) || !bytes.readUInt32BE(offset + 12)) return false;
      header = true;
    }
    if (type === 'IDAT') pixels = true;
    offset += length + 12;
    if (type === 'IEND') return length === 0 && header && pixels && offset === bytes.length;
  }
  return false;
}
function observations(json) {
  if (Array.isArray(json)) return json.flatMap(observations);
  if (!json || typeof json !== 'object') return [];
  const result = json.executionId !== undefined || (json.id !== undefined && json.workflowId) ? [json] : [];
  for (const key of ['results', 'executions', 'items', 'data']) if (json[key]) result.push(...observations(json[key]));
  return result;
}
export function inspectUpgradeWorkflow(story, evidence, context) {
  const reasons = [], workflowId = 'ZvidSeries2Day' + story.day;
  const current = context.canonical;
  const baseline = Number(story.upgradeBaseline?.previousManualExecutionId || 0);
  const fail = message => { reasons.push(message); return null; };
  function artifact(ref, label, json = true) {
    if (!ref?.path || !validHash(ref.sha256)) return fail(label + ': artifact path/hash missing');
    let bytes;
    try { bytes = context.readArtifact(ref.path); } catch { return fail(label + ': artifact unavailable'); }
    if (sha256(bytes) !== ref.sha256.toLowerCase()) return fail(label + ': artifact hash mismatch');
    if (!json) return bytes;
    try { return JSON.parse(bytes.toString('utf8')); } catch { return fail(label + ': invalid JSON proof'); }
  }
  function manual(ref, label) {
    if (!Number.isInteger(Number(ref?.executionId)) || Number(ref.executionId) <= baseline) return fail(label + ': prior or missing execution');
    const json = artifact(ref.artifact, label);
    if (!json) return null;
    const proof = observations(json).find(row => Number(row.executionId ?? row.id) === Number(ref.executionId));
    if (!proof) return fail(label + ': matching execution absent from proof');
    if (proof.workflowId !== workflowId || proof.mode !== 'manual' || proof.status !== 'success' || proof.mocked !== false)
      return fail(label + ': successful real canonical manual execution not established');
    if (proof.functionalSha256 !== current.functionalSha256) return fail(label + ': functional revision mismatch');
    return proof;
  }
  function role(name) {
    const ref = evidence?.checks?.[name], proof = manual(ref, name);
    const value = proof?.roles?.[name];
    if (!value) return fail(name + ': role evidence missing');
    if (value.real !== true || value.passed !== true || !value.node || proof.nodes?.[value.node] !== 'success')
      return fail(name + ': actual successful node evidence missing');
    return {...value, executionId: Number(ref.executionId)};
  }
  if (!context.rootReportConfirmed || evidence?.rootConfirmed !== true) fail('Root completion report not confirmed');
  if (!evidence) return {day: story.day, slug: story.slug, buildReady: false, assetReady: false, reasons: [...reasons, 'Upgraded completion report absent']};
  if (!evidence.sourceId || !evidence.revision || !evidence.requestKey) fail('Stable source, revision and request identity missing');
  if (evidence.workflowId !== workflowId || evidence.functionalSha256 !== current.functionalSha256) fail('Current canonical functional fingerprint mismatch');
  const automated = context.automated;
  if (automated?.passed > 0 && automated.failed === 0 && automated.functionalHashes?.[story.day] === current.functionalSha256) {
    const log = artifact(automated.artifact, 'Automated checks', false);
    if (log) {
      const text = log.toString('utf8');
      const passCounts = [...text.matchAll(/\bpass (\d+)/g)].map(match => Number(match[1]));
      const failCounts = [...text.matchAll(/\bfail (\d+)/g)].map(match => Number(match[1]));
      if (passCounts.length && (passCounts.reduce((a, b) => a + b, 0) !== automated.passed ||
        failCounts.reduce((a, b) => a + b, 0) !== 0)) fail('Automated TAP counts disagree with report');
    }
  } else fail('Final automated checks for current functional revision missing');
  const main = manual(evidence.manual, 'Main manual execution');
  const source = role('sourceRead'), policy = role('domainPolicy'), eligible = role('eligibility');
  const ledger = role('ledgerAcceptance'), drive = role('driveFile'), writeback = role('writeback');
  const dedup = role('deduplication'), resume = role('resumeAccepted'), recovery = role('deliveryRecovery');
  const adapter = sourceAdapters[story.day];
  const requiresRelated = !adapter || Object.keys(adapter.detailKinds).length > 0;
  const zeroRelatedAllowed = !requiresRelated && source?.referenceRowsRead === 0 && source?.referenceRowsRequired === false &&
    Array.isArray(source?.detailKinds) && source.detailKinds.length === 0;
  if (source && (!(source.rowsRead > 0) || (!(source.referenceRowsRead > 0) && !zeroRelatedAllowed))) fail('Real source/reference join not established');
  if (policy && (policy.requiredFieldsValidated !== true ||
      (requiresRelated ? policy.referenceJoinVerified !== true : policy.sourceRevisionVerified !== true) ||
      policy.sourceId !== evidence.sourceId || policy.revision !== evidence.revision)) fail('Domain policy or source join not verified');
  if (eligible && (eligible.eligible !== true || eligible.businessRuleChecked !== true || eligible.sourceId !== evidence.sourceId)) fail('Business eligibility not verified');
  if (ledger && (ledger.requestKey !== evidence.requestKey || !ledger.jobId || ledger.acceptedBeforeDownstream !== true)) fail('Durable accepted job checkpoint missing');
  if (drive && (!drive.fileId || drive.private !== true || drive.mimeType !== 'video/mp4' || !(drive.bytes > 0))) fail('Actual private Drive video receipt missing');
  if (writeback && (writeback.status !== 'delivered' || writeback.sourceId !== evidence.sourceId ||
      writeback.jobId !== ledger?.jobId || writeback.driveFileId !== drive?.fileId)) fail('Confirmed source write-back receipt mismatch');
  for (const [label, value] of [['deduplication', dedup], ['resumeAccepted', resume], ['deliveryRecovery', recovery]]) {
    if (value && (value.renderCreateCalls !== 0 || value.jobId !== ledger?.jobId ||
        value.requestKey !== evidence.requestKey)) fail(label + ': accepted job was not reused without a paid retry');
  }
  if (dedup && (dedup.driveUploadCalls !== 0 || dedup.driveFileId !== drive?.fileId ||
      dedup.noDuplicateLedgerRows !== true || dedup.noDuplicateSourceRows !== true || dedup.noDuplicateFiles !== true)) fail('Delivered replay duplicate suppression not established');
  if (resume && resume.acceptedJobResumed !== true) fail('Accepted job resume not established');
  if (recovery && (recovery.driveUploadCalls !== 0 || recovery.driveFileId !== drive?.fileId || recovery.writebackSucceeded !== true))
    fail('Delivery/write-back retry did not reuse the existing file');
  for (const [service, value] of [['googleSheets', source], ['googleDrive', drive]]) {
    const checkpoint = context.integrationCheckpoint?.[service];
    if (checkpoint?.status !== 'success' && Number(checkpoint?.executionId || 0) >= Number(value?.executionId || 0))
      fail(service + ': newer unsuccessful integration checkpoint still needs resolution');
  }
  const render = main?.roles?.render;
  if (!render || render.real !== true || !render.node || main.nodes?.[render.node] !== 'success' ||
      render.jobId !== ledger?.jobId || !validHash(render.projectSha256)) fail('Actual render job/project fingerprint missing');
  if (render?.mode === 'created') {
    if (render.renderCreateCalls !== 1) fail('New render acceptance evidence inconsistent');
  } else if (render?.mode === 'reusedAccepted') {
    if (render.renderCreateCalls !== 0 || render.frozenProjectSha256 !== render.projectSha256) fail('Reused video does not match the frozen current project');
  } else fail('Actual render or accepted-job reuse mode missing');
  const media = artifact(evidence.mediaQa, 'Media QA');
  if (media) {
    if (media.mediaPassed !== true || media.visualReview !== 'passed' || media.jobId !== ledger?.jobId ||
        media.projectSha256 !== render?.projectSha256) fail('Matching current-project media and visual review missing');
    const video = artifact(media.video, 'Verified video', false);
    if (video && (video.length < 12 || video.toString('ascii', 4, 8) !== 'ftyp')) fail('Video artifact is not an MP4');
  }
  const buildReasons = [...reasons];
  const canvas = artifact(evidence.canvas, 'Canvas inspection');
  if (canvas) {
    if (canvas.workflowId !== workflowId || canvas.canonicalSha256 !== current.sha256 ||
        canvas.inspected !== true || canvas.allFunctionalNodesCovered !== true || canvas.allTextFits !== true ||
        canvas.readableOverview !== true || canvas.fitVisuallyInspected !== true || canvas.representativeSectionsReadable !== true ||
        canvas.passed !== true || !Array.isArray(canvas.overlap) || canvas.overlap.length)
      fail('Exact current actual canvas/readability/coverage evidence missing');
    for (const [label, ref] of [['Full canvas PNG', canvas.fitPng], ['Readable overview PNG', canvas.overviewPng]]) {
      const bytes = artifact(ref, label, false);
      if (bytes && !isPng(bytes)) fail(label + ': genuine PNG structure missing');
    }
  }
  return {day: story.day, slug: story.slug, workflowId, buildReady: buildReasons.length === 0,
    assetReady: reasons.length === 0, executionId: evidence.manual?.executionId,
    currentCanonicalSha256: current.sha256, functionalSha256: current.functionalSha256,
    nativeIntegrationSuccesses: context.rootReportConfirmed && evidence.rootConfirmed === true ? {
      googleSheets: source?.rowsRead > 0 && (source?.referenceRowsRead > 0 || zeroRelatedAllowed) ? source.executionId : null,
      googleDrive: drive?.fileId && drive?.private === true && drive?.mimeType === 'video/mp4' && drive?.bytes > 0 ? drive.executionId : null
    } : {},
    reasons: [...new Set(reasons)]};
}
export function integrationCheckpoint(scaffold) {
  const result = {};
  for (const row of scaffold?.results || []) {
    const service = row.workflowId === 'ZvidSeries2PublicationCreateWorkbook' ? 'googleSheets' :
      row.workflowId === 'ZvidSeries2PublicationCreateFolder' ? 'googleDrive' : null;
    if (service && Number(row.executionId) > Number(result[service]?.executionId || 0)) result[service] = {
      executionId: row.executionId, status: row.status,
      reason: row.status === 'success' ? 'Native setup succeeded' :
        /reconnect/i.test(row.error?.message || '') ? 'OAuth reconnection required' : 'Native integration check failed'
    };
  }
  return result;
}
export function inspectUpgradeDirectory(base) {
  const repo = resolve(base, '..', '..', '..', '..');
  const read = name => JSON.parse(readFileSync(resolve(base, name), 'utf8'));
  const report = read('flowlu.json');
  const inputPath = resolve(base, 'flowlu-upgrade-completion.json');
  const input = existsSync(inputPath) ? read('flowlu-upgrade-completion.json') : {};
  const scaffoldPath = resolve(base, 'publication', 'infra-scaffold-evidence.json');
  const checkpoint = existsSync(scaffoldPath) ? integrationCheckpoint(read('publication/infra-scaffold-evidence.json')) : {};
  const cache = new Map();
  const readArtifact = name => {
    if (isAbsolute(name)) throw new Error('Artifact references must be relative to the local evidence directory');
    const path = resolve(base, name), rel = relative(base, path);
    if (rel.startsWith('..') || isAbsolute(rel) || /(^|[\\/])\.env(?:[./\\]|$)/i.test(rel)) throw new Error('Artifact path outside evidence scope');
    if (!cache.has(path)) cache.set(path, readFileSync(path));
    return cache.get(path);
  };
  const all = report.stories.map(story => {
    const bytes = readFileSync(resolve(repo, story.source)), json = JSON.parse(bytes.toString('utf8'));
    const canonical = {sha256: sha256(bytes), functionalSha256: functionalFingerprint(json)};
    const candidates = (input.workflows || []).filter(row => row.day === story.day);
    if (candidates.length > 1) return {day: story.day, slug: story.slug, buildReady: false, assetReady: false, reasons: ['Duplicate completion reports for day']};
    return inspectUpgradeWorkflow(story, candidates[0], {canonical, readArtifact,
      rootReportConfirmed: input.rootReportConfirmed === true, automated: input.automated, integrationCheckpoint: checkpoint});
  });
  const integrationStatus = structuredClone(checkpoint);
  for (const row of all) for (const [service, executionId] of Object.entries(row.nativeIntegrationSuccesses || {})) {
    if (executionId && Number(executionId) > Number(integrationStatus[service]?.executionId || 0))
      integrationStatus[service] = {executionId, status: 'success', reason: 'Real upgraded manual workflow integration verified',
        priorFailureExecutionId: checkpoint[service]?.status !== 'success' ? checkpoint[service]?.executionId : undefined};
  }
  const result = {checkedAt: new Date().toISOString(), scope: 'Upgraded business workflows; no automatic Flowlu mutations',
    rootReportConfirmed: input.rootReportConfirmed === true, integrationCheckpoint: checkpoint,
    integrationStatus,
    buildReadyDays: all.filter(row => row.buildReady).map(row => row.day),
    assetReadyDays: all.filter(row => row.assetReady).map(row => row.day),
    pending: all.filter(row => !row.buildReady || !row.assetReady).map(row => ({day: row.day, reasons: row.reasons})), all};
  writeFileSync(resolve(base, 'flowlu-upgrade-readiness.json'), JSON.stringify(result, null, 2) + '\n');
  return result;
}
const ownFile = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === ownFile) {
  const result = inspectUpgradeDirectory(dirname(ownFile));
  console.log(JSON.stringify({buildReadyDays: result.buildReadyDays, assetReadyDays: result.assetReadyDays,
    pendingDays: result.pending.map(row => row.day), integrationStatus: result.integrationStatus}));
}
