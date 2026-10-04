'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { functionalHash, sha256 } = require('./infra-functional-fingerprint');
const { evidenceFor, automatedResult, submissionDraft, build } = require('./build-publication-catalog');
const canonical = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../workflows/zvid-release-notes-video.json'), 'utf8'));
const hash = functionalHash(canonical), artifactHash = 'fixture-artifact-hash';
const passedNode = [{ status: 'success', totalOutputItems: 1 }];
const mediaFilename = 'catalog-guard-video.fixture', mediaPath = path.join(__dirname, mediaFilename);
const videoBytes = Buffer.from('Synthetic bytes for provenance guard tests; no media QA claim.');
const videoHash = crypto.createHash('sha256').update(videoBytes).digest('hex');
const inputHash = sha256('fixture input'), projectHash = sha256('fixture frozen project');
test.before(() => fs.writeFileSync(mediaPath, videoBytes, { flag: 'wx' }));
test.after(() => fs.unlinkSync(mediaPath));
function attempt(overrides = {}) {
  const identity = { sourceId: 'source-31', revision: 'r2', requestKey: 'request31', jobId: 'job31', driveFileId: 'file31', videoUrl: 'https://media.example.test/review.mp4', driveUrl: 'https://drive.google.com/file/d/file31/view' };
  return { id: '738', day: 31, workflowId: 'ZvidSeries2Day31', status: 'success', mode: 'manual', functionalMatch: true, executionFunctionalHash: hash, canonicalFunctionalHash: hash,
    outcome: { ...identity, status: 'delivered', dryRun: false }, receipt: { ...identity, inputHash, status: 'delivered' }, frozen: { inputHash, projectSha256: projectHash }, nodes: { 'Business outcome': passedNode, 'Read back delivery receipt': passedNode }, ...overrides };
}
function fullInputs() {
  const data=inputs(), identity=data.executions.attempts[0].outcome;
  data.media={workflows:[{day:31,functionalHash:hash,executionId:'738',jobId:'job31',driveFileId:'file31',inputHash,projectSha256:projectHash,file:mediaFilename,sha256:videoHash,passed:true,technicalPassed:true,mediaPassed:true,visualReview:'passed'}]};
  data.canvas={workflows:[{day:31,functionalHash:hash,artifactSha256:artifactHash,passed:true,actualCanvasInspected:true,allTextFits:true,overlaps:[],allFunctionalNodesCovered:true,fitVisuallyInspected:true,readableOverview:true,representativeSectionsReadable:true}]};
  data.verification={rootReportConfirmed:true,workflows:[{day:31,functionalHash:hash,artifactSha256:artifactHash,executionId:'738',sourceId:identity.sourceId,revision:identity.revision,requestKey:identity.requestKey,rootConfirmed:true,checks:{eligibility:true,deduplication:{passed:true},resumeAccepted:true,deliveryRecovery:true}}]};
  return data;
}
function inputs(execution = attempt()) {
  return { imports: { workflows: [{ day: 31, workflowId: 'ZvidSeries2Day31', passed: true, canonicalFunctionalHash: hash, installedFunctionalHash: hash, functionalMatch: true, credentialBindingsValid: true }] }, executions: { attempts: [execution] } };
}
test('exact Node log counts are recorded separately from live delivery', () => {
  const result = automatedResult('ℹ tests 617\nℹ pass 617\nℹ fail 0\nℹ skipped 0\n');
  assert.equal(result.tests, 617); assert.equal(result.passed, 617); assert.equal(result.failed, 0); assert.equal(result.verified, true);
  assert.equal(evidenceFor(31, canonical, artifactHash, { imports: null }).status, 'testing_pending');
});
test('earlier generation runs and stale functional revisions cannot establish live delivery', () => {
  for (const execution of [attempt({ id: '733' }), attempt({ executionFunctionalHash: 'old' }), attempt({ canonicalFunctionalHash: 'old' }), attempt({ functionalMatch: false })]) {
    assert.equal(evidenceFor(31, canonical, artifactHash, inputs(execution)).checks.manualSourceToDriveDelivery, false);
  }
});
test('dry runs, no-work branches, failed runs and mismatched writebacks cannot establish delivery', () => {
  const valid = attempt();
  for (const execution of [attempt({ outcome: { ...valid.outcome, dryRun: true } }), attempt({ outcome: { ...valid.outcome, status: 'nothing_to_render' } }), attempt({ status: 'error' }), attempt({ mode: 'trigger' }), attempt({ receipt: { ...valid.receipt, revision: 'r1' } }), attempt({ nodes: {} })]) {
    assert.equal(evidenceFor(31, canonical, artifactHash, inputs(execution)).status, 'testing_pending');
  }
});
test('a current native delivered receipt remains QA pending without root and recovery evidence', () => {
  const result = evidenceFor(31, canonical, artifactHash, inputs());
  assert.equal(result.status, 'delivered_qa_pending'); assert.equal(result.submissionReady, false);
});
test('full verification requires matching current media, canvas, recovery and a separately verified public guide', () => {
  const data = fullInputs(), confirmation=data.verification.workflows[0];
  assert.equal(evidenceFor(31, canonical, artifactHash, data).status, 'verified_local_delivery');
  assert.equal(evidenceFor(31, canonical, artifactHash, data).submissionReady, false);
  confirmation.publicGuide = { verified: true, url: 'https://docs.example.test/verified-guide' };
  assert.equal(evidenceFor(31, canonical, artifactHash, data).submissionReady, true);
  data.canvas.workflows[0].artifactSha256 = 'prior-notes';
  assert.equal(evidenceFor(31, canonical, artifactHash, data).status, 'delivered_qa_pending');
});
test('reviewed media retains its own execution identity across a matching delivery replay',()=>{
  const data=fullInputs();data.executions.attempts.push(attempt({id:'739'}));
  const record=data.verification.workflows[0];record.mainRenderExecutionId='738';record.latestDeliveryExecutionId='739';
  const result=evidenceFor(31,canonical,artifactHash,data);
  assert.equal(result.status,'verified_local_delivery');assert.equal(result.executionId,'739');assert.equal(result.mainRenderExecutionId,'738');assert.equal(result.mediaQaExecutionId,'738');assert.equal(result.mediaReusedForRetainedIdentity,true);
  data.executions.attempts[1].frozen={inputHash,projectSha256:sha256('different project')};
  assert.equal(evidenceFor(31,canonical,artifactHash,data).checks.mediaQA,false);
  assert.equal(evidenceFor(31,canonical,artifactHash,data).checks.rootConfirmed,false);
});
test('media flags do not hide stale saved bytes, missing native provenance or changed Drive identity',()=>{
  for(const patch of [{sha256:sha256('other bytes')},{sha256:sha256(videoBytes)},{executionId:'old'},{driveFileId:'other'},{visualReview:'pending'},{technicalPassed:false}]){
    const data=fullInputs();Object.assign(data.media.workflows[0],patch);assert.equal(evidenceFor(31,canonical,artifactHash,data).checks.mediaQA,false);
  }
  const data=fullInputs();data.canvas.workflows[0].representativeSectionsReadable=false;assert.equal(evidenceFor(31,canonical,artifactHash,data).checks.currentCanvasQA,false);
});
test('all 30 generated local packets preserve the companion draft and valid local source links', () => {
  const catalog = build();
  assert.equal(catalog.workflows.length, 30);
  assert.deepEqual(catalog.workflows.map(w => w.day), Array.from({ length: 30 }, (_, i) => i + 31));
  for (const entry of catalog.workflows) {
    for (const key of ['guide', 'json', 'submissionDraft']) assert.ok(fs.existsSync(path.resolve(__dirname, entry.links[key])), `${entry.day} ${key} missing`);
    const guide = fs.readFileSync(path.resolve(__dirname, entry.links.guide), 'utf8');
    assert.equal(entry.submissionDraft, submissionDraft(guide));
    const packet = fs.readFileSync(path.resolve(__dirname, entry.links.submissionDraft), 'utf8');
    assert.ok(packet.includes(entry.submissionDraft));
    assert.ok(packet.includes(entry.policy)); assert.ok(packet.includes(entry.need));
    assert.equal(sha256(fs.readFileSync(path.resolve(__dirname, entry.links.json), 'utf8')), entry.canonicalArtifactSha256);
    if (entry.testing.publicGuideUrl) assert.ok(entry.testing.publicGuideUrl.startsWith('https://'));
  }
  const html = fs.readFileSync(path.join(__dirname, 'publication-catalog.html'), 'utf8');
  assert.equal((html.match(/<tr data-search=/g) || []).length, 30);
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map(match => match[1]);
  for (const href of hrefs.filter(value => !/^https?:/.test(value))) {
    assert.ok(fs.existsSync(path.resolve(__dirname, href)), `Missing catalog link ${href}`);
  }
  assert.equal(html.includes('../test-results.json'), false);
  assert.equal(html.includes('../executions.json'), false);
  assert.equal(html.includes('../media-results.json'), false);
});
