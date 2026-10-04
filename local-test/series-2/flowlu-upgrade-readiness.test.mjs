import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sha256, functionalFingerprint, isPng, inspectUpgradeWorkflow, integrationCheckpoint} from './flowlu-upgrade-readiness.mjs';

function fixture(day = 31) {
  const files = new Map();
  const put = (path, value) => {
    const bytes = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value));
    files.set(path, bytes);
    return {path, sha256: sha256(bytes)};
  };
  const workflow = {nodes: [
    {name: 'Manual', type: 'n8n-nodes-base.manualTrigger', typeVersion: 1, parameters: {}},
    {name: 'Render', type: '@zvid/n8n-nodes-zvid.zvid', typeVersion: 1, parameters: {resource: 'render', operation: 'get'}},
    {name: 'Overview', type: 'n8n-nodes-base.stickyNote', parameters: {content: 'Before'}}
  ], connections: {Manual: {main: [[{node: 'Render', type: 'main', index: 0}]]}}, settings: {executionOrder: 'v1'}};
  const functional = functionalFingerprint(workflow), canonical = {sha256: sha256(JSON.stringify(workflow)), functionalSha256: functional};
  const story = {day, slug: 'release-notes-video', upgradeBaseline: {previousManualExecutionId: 722}};
  const identity = {sourceId: 'SOURCE-31', revision: '2', requestKey: 'release-notes-video:SOURCE-31:2'};
  const core = {workflowId: `ZvidSeries2Day${day}`, mode: 'manual', status: 'success', mocked: false, functionalSha256: functional};
  const role = (node, value) => ({node, passed: true, real: true, ...value});
  const main = {...core, executionId: 1000,
    nodes: Object.fromEntries(['source', 'policy', 'eligibility', 'ledger', 'drive', 'writeback', 'render'].map(name => [name, 'success'])),
    roles: {
      sourceRead: role('source', {rowsRead: 1, referenceRowsRead: 2}),
      domainPolicy: role('policy', {...identity, requiredFieldsValidated: true, referenceJoinVerified: true}),
      eligibility: role('eligibility', {sourceId: identity.sourceId, eligible: true, businessRuleChecked: true}),
      ledgerAcceptance: role('ledger', {requestKey: identity.requestKey, jobId: 'JOB-31', acceptedBeforeDownstream: true}),
      driveFile: role('drive', {fileId: 'FILE-31', private: true, mimeType: 'video/mp4', bytes: 8000}),
      writeback: role('writeback', {sourceId: identity.sourceId, status: 'delivered', jobId: 'JOB-31', driveFileId: 'FILE-31'}),
      render: {real: true, node: 'render', mode: 'created', jobId: 'JOB-31', projectSha256: 'a'.repeat(64), renderCreateCalls: 1}
    }};
  const mainArtifact = put('proof/main.json', main), checks = {};
  for (const name of ['sourceRead', 'domainPolicy', 'eligibility', 'ledgerAcceptance', 'driveFile', 'writeback'])
    checks[name] = {executionId: 1000, artifact: mainArtifact};
  for (const [index, name, fields] of [
    [1, 'deduplication', {driveUploadCalls: 0, driveFileId: 'FILE-31', noDuplicateLedgerRows: true, noDuplicateSourceRows: true, noDuplicateFiles: true}],
    [2, 'resumeAccepted', {acceptedJobResumed: true}],
    [3, 'deliveryRecovery', {driveUploadCalls: 0, driveFileId: 'FILE-31', writebackSucceeded: true}]
  ]) {
    const proof = {...core, executionId: 1000 + index, nodes: {[name]: 'success'},
      roles: {[name]: role(name, {requestKey: identity.requestKey, jobId: 'JOB-31', renderCreateCalls: 0, ...fields})}};
    checks[name] = {executionId: proof.executionId, artifact: put('proof/' + name + '.json', proof)};
  }
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
  assert.equal(isPng(png), true);
  const canvas = {workflowId: core.workflowId, canonicalSha256: canonical.sha256, inspected: true,
    allFunctionalNodesCovered: true, allTextFits: true, readableOverview: true, fitVisuallyInspected: true,
    representativeSectionsReadable: true, passed: true, overlap: [],
    fitPng: put('proof/fit.png', png), overviewPng: put('proof/overview.png', png)};
  const video = put('proof/video.mp4', Buffer.from('00000014667479706d703432000000006d703432', 'hex'));
  const media = {mediaPassed: true, visualReview: 'passed', jobId: 'JOB-31', projectSha256: 'a'.repeat(64), video};
  const evidence = {day, rootConfirmed: true, workflowId: core.workflowId, functionalSha256: functional, ...identity,
    manual: {executionId: 1000, artifact: mainArtifact}, checks,
    mediaQa: put('proof/media.json', media), canvas: put('proof/canvas.json', canvas)};
  const context = {canonical, rootReportConfirmed: true, readArtifact: path => {
    if (!files.has(path)) throw new Error('Missing fixture');
    return files.get(path);
  }, automated: {passed: 2, failed: 0, functionalHashes: {[day]: functional},
    artifact: put('proof/tests.log', Buffer.from('# pass 2\n# fail 0\n'))}, integrationCheckpoint: {
      googleSheets: {executionId: 734, status: 'error'}, googleDrive: {executionId: 735, status: 'error'}
    }};
  const replaceProof = (ref, change) => {
    const json = JSON.parse(files.get(ref.path).toString('utf8'));
    change(json);
    return put(ref.path, json);
  };
  return {story, workflow, evidence, context, files, replaceProof, evaluate: () => inspectUpgradeWorkflow(story, evidence, context)};
}

test('complete real manual evidence is eligible without mutating any tracker', () => {
  const result = fixture().evaluate();
  assert.equal(result.buildReady, true);
  assert.equal(result.assetReady, true);
  assert.deepEqual(result.reasons, []);
});
test('the actual day38 adapter permits zero required child rows with explicit native source evidence', () => {
  const f = fixture(38);
  const ref = f.replaceProof(f.evidence.manual.artifact, proof => {
    Object.assign(proof.roles.sourceRead, {referenceRowsRead: 0, referenceRowsRequired: false, detailKinds: []});
    Object.assign(proof.roles.domainPolicy, {sourceRevisionVerified: true});
  });
  f.evidence.manual.artifact = ref;
  for (const name of ['sourceRead', 'domainPolicy', 'eligibility', 'ledgerAcceptance', 'driveFile', 'writeback']) f.evidence.checks[name].artifact = ref;
  assert.equal(f.evaluate().buildReady, true);
  assert.equal(f.evaluate().nativeIntegrationSuccesses.googleSheets, 1000);
});
test('zero child rows cannot bypass a domain that requires typed joins', () => {
  const f = fixture(31);
  const ref = f.replaceProof(f.evidence.manual.artifact, proof => Object.assign(proof.roles.sourceRead, {referenceRowsRead: 0, referenceRowsRequired: false, detailKinds: []}));
  f.evidence.manual.artifact = ref;
  for (const name of ['sourceRead', 'domainPolicy', 'eligibility', 'ledgerAcceptance', 'driveFile', 'writeback']) f.evidence.checks[name].artifact = ref;
  assert.equal(f.evaluate().buildReady, false);
});
test('root completion reports are required', () => {
  const f = fixture(); f.context.rootReportConfirmed = false;
  assert.equal(f.evaluate().buildReady, false);
});
test('partial canvas evidence cannot complete assets before actual section readability review', () => {
  const f = fixture();
  f.evidence.canvas = f.replaceProof(f.evidence.canvas, proof => { proof.passed = false; proof.representativeSectionsReadable = false; });
  assert.equal(f.evaluate().buildReady, true);
  assert.equal(f.evaluate().assetReady, false);
});
test('old generation-only execution cannot count as an upgraded manual run', () => {
  const f = fixture(); f.evidence.manual.executionId = 722;
  assert.equal(f.evaluate().buildReady, false);
});
test('mocked or non-manual service evidence is rejected', () => {
  const f = fixture();
  const ref = f.replaceProof(f.evidence.manual.artifact, proof => { proof.mocked = true; });
  f.evidence.manual.artifact = ref;
  for (const name of ['sourceRead', 'domainPolicy', 'eligibility', 'ledgerAcceptance', 'driveFile', 'writeback']) f.evidence.checks[name].artifact = ref;
  assert.equal(f.evaluate().buildReady, false);
});
test('wrong write-back receipt prevents completion', () => {
  const f = fixture();
  f.evidence.checks.writeback.artifact = f.replaceProof(f.evidence.checks.writeback.artifact, proof => {
    proof.roles.writeback.driveFileId = 'WRONG-FILE';
  });
  assert.equal(f.evaluate().buildReady, false);
});
test('a delivered replay that renders or uploads again is rejected', () => {
  const f = fixture();
  f.evidence.checks.deduplication.artifact = f.replaceProof(f.evidence.checks.deduplication.artifact, proof => {
    proof.roles.deduplication.renderCreateCalls = 1;
    proof.roles.deduplication.driveUploadCalls = 1;
  });
  assert.equal(f.evaluate().buildReady, false);
});
test('a reused accepted render needs the unchanged frozen project fingerprint', () => {
  const f = fixture();
  const ref = f.replaceProof(f.evidence.manual.artifact, proof => {
    proof.roles.render.mode = 'reusedAccepted';
    proof.roles.render.renderCreateCalls = 0;
    proof.roles.render.frozenProjectSha256 = 'a'.repeat(64);
  });
  f.evidence.manual.artifact = ref;
  for (const name of ['sourceRead', 'domainPolicy', 'eligibility', 'ledgerAcceptance', 'driveFile', 'writeback']) f.evidence.checks[name].artifact = ref;
  assert.equal(f.evaluate().buildReady, true);
  f.evidence.manual.artifact = f.replaceProof(ref, proof => { proof.roles.render.frozenProjectSha256 = 'b'.repeat(64); });
  assert.equal(f.evaluate().buildReady, false);
});
test('notes-only changes preserve functional tests and require fresh canvas evidence', () => {
  const f = fixture();
  f.workflow.nodes[2].parameters.content = 'After';
  assert.equal(functionalFingerprint(f.workflow), f.context.canonical.functionalSha256);
  f.context.canonical.sha256 = sha256(JSON.stringify(f.workflow));
  const result = f.evaluate();
  assert.equal(result.buildReady, true);
  assert.equal(result.assetReady, false);
});
test('functional changes invalidate earlier manual evidence', () => {
  const f = fixture();
  f.workflow.nodes[1].parameters.operation = 'create';
  f.context.canonical.functionalSha256 = functionalFingerprint(f.workflow);
  assert.equal(f.evaluate().buildReady, false);
});
test('changed artifact bytes fail their frozen hash', () => {
  const f = fixture(); f.files.set('proof/tests.log', Buffer.from('# pass 3\n# fail 0\n'));
  assert.equal(f.evaluate().buildReady, false);
});
test('a JPEG with a PNG filename cannot complete the canvas asset', () => {
  const f = fixture();
  const ref = {path: 'proof/fit.png', sha256: sha256(Buffer.from([255, 216, 255, 217]))};
  f.files.set(ref.path, Buffer.from([255, 216, 255, 217]));
  f.evidence.canvas = f.replaceProof(f.evidence.canvas, canvas => { canvas.fitPng = ref; });
  const result = f.evaluate();
  assert.equal(result.buildReady, true);
  assert.equal(result.assetReady, false);
});
test('a newer failed native integration checkpoint is not overridden by an older pass', () => {
  const f = fixture(); f.context.integrationCheckpoint.googleDrive = {executionId: 1200, status: 'error'};
  assert.equal(f.evaluate().buildReady, false);
});
test('latest native setup failures and successful restores are reported', () => {
  const result = integrationCheckpoint({results: [
    {workflowId: 'ZvidSeries2PublicationCreateWorkbook', executionId: 734, status: 'error', error: {message: 'needs to be reconnected'}},
    {workflowId: 'ZvidSeries2PublicationCreateFolder', executionId: 735, status: 'error', error: {message: 'needs to be reconnected'}},
    {workflowId: 'ZvidSeries2PublicationCreateWorkbook', executionId: 740, status: 'success'}
  ]});
  assert.equal(result.googleSheets.executionId, 740);
  assert.equal(result.googleSheets.status, 'success');
  assert.equal(result.googleDrive.reason, 'OAuth reconnection required');
});
