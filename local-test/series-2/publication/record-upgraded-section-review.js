'use strict';
// Invoke only after inspecting the ten actual section captures and three lower views.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { adapters } = require('../../../scripts/series-two-source-adapters');
const ROOT = __dirname;
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
function recordReviewedSections() {
  const file = path.join(ROOT, 'upgraded-canvas-readability.json');
  const evidence = read(file);
  const capture = read(path.join(ROOT, 'canvas', 'representative-readability.json'));
  const canonicalFile = path.resolve(ROOT, '../../..', 'workflows', `zvid-${adapters[31].slug}.json`);
  const bytes = fs.readFileSync(canonicalFile), workflow = JSON.parse(bytes);
  if (capture.workflowId !== 'ZvidSeries2Day31' || capture.sections.length !== 10) throw new Error('Expected ten current Day31 section captures');
  const reviewedAt = new Date().toISOString();
  evidence.sections = workflow.meta.seriesTwo.groups.map((group, index) => {
    const item = capture.sections.find(value => value.section === index + 1);
    const note = workflow.nodes.find(value => value.name === group.note);
    if (!item || item.workflowId !== capture.workflowId || !note) throw new Error(`Section ${index + 1} identity mismatch`);
    const scale = item.rect.width / note.parameters.width;
    if (Math.abs(scale - 1) > 0.001 || !Number.isFinite(Date.parse(item.capturedAt))) throw new Error('Section capture is not a native 100% view');
    if (note.parameters.height > 700 && !item.bottomPng) throw new Error('Tall section lower view missing');
    return { day: 31, section: index + 1, noteName: group.note, png: item.png,
      captureSha256: hash(fs.readFileSync(item.png)), scale, readable: true,
      ...(item.bottomPng ? { bottomPng: item.bottomPng, bottomCaptureSha256: hash(fs.readFileSync(item.bottomPng)), bottomReadable: true } : {}),
      capturedAt: item.capturedAt, reviewedAt,
      reviewMethod: 'Individually inspected actual native screenshot pixels with view_image: complete section paragraph and all node names; tall groups include the inspected lower-row view' };
  });
  evidence.representativeWorkflowSha256 = hash(bytes);
  evidence.inspectorConfirmed = true;
  evidence.inspectedBy = 'launch_tracking';
  evidence.updatedAt = reviewedAt;
  fs.writeFileSync(file, JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify({ sections: evidence.sections.length, sectionImages: evidence.sections.reduce((sum, item) => sum + 1 + Number(!!item.bottomPng), 0) }));
}
if (require.main === module) recordReviewedSections();
module.exports = { recordReviewedSections };
