'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const {inspectFinalNativeIssues} = require('./flowlu-upgrade-final-native-audit.js');
function fixture() {
  const rows = [], stories = [], updates = [];
  for (let index = 0; index < 78; index++) rows.push({id: index + 1, name: 'Original ' + index, description: '<p>Original evidence</p>', type_id: 2, workflow_stage_id: 9, parent_issue_id: 0, project_id: 6});
  const originalBaseline = structuredClone(rows);
  for (let index = 0; index < 30; index++) {
    const day = index + 31, slug = 'test-' + day, storyId = 79 + index * 15;
    rows.push({id: storyId, name: 'Story ' + day, description: 'Workflow slug: <code>' + slug + '</code>', type_id: 3, workflow_stage_id: 11, parent_issue_id: 0, project_id: 6});
    const children = [];
    for (let child = 0; child < 14; child++) {
      const id = storyId + child + 1, title = child === 0 ? '[Build] Create n8n workflow' : child === 1 ? '[Asset] Capture n8n workflow screenshot' : 'Future ' + child;
      rows.push({id, name: title, description: '<p>Launch work</p>', type_id: 2, workflow_stage_id: child < 2 ? 14 : 9, parent_issue_id: storyId, project_id: 6});
      children.push({id, title});
      if (child < 2) updates.push({id, data: {workflow_stage_id: 14, description: '<p>Launch work</p>'}});
    }
    stories.push({day, slug, storyId, children});
    updates.push({id: storyId, data: {workflow_stage_id: 11, description: 'Workflow slug: <code>' + slug + '</code>'}});
  }
  return {rows, originalBaseline, preflight: structuredClone(rows), plan: {rootReportConfirmed: true, updates}, tracker: {stories}};
}
test('exact current completion preserves original and future records', () => {
  const result = inspectFinalNativeIssues(fixture());
  assert.equal(result.passed, true); assert.equal(result.updatesVerified, 90); assert.equal(result.futureChildrenBacklog, 360); assert.equal(result.originalRecordsVerified, 78);
});
test('a changed original description blocks completion', () => {
  const data = fixture(); data.rows[0].description = '<p>Unrelated change</p>';
  assert.equal(inspectFinalNativeIssues(data).passed, false);
});
test('a future task description change blocks completion even in Backlog', () => {
  const data = fixture(); data.rows.find(row => row.name === 'Future 2').description = '<p>Unexpected change</p>';
  assert.equal(inspectFinalNativeIssues(data).passed, false);
});
test('an unconfirmed completion cannot pass', () => {
  const data = fixture(); data.plan.rootReportConfirmed = false;
  assert.equal(inspectFinalNativeIssues(data).passed, false);
});
test('a new duplicate managed story cannot pass', () => {
  const data = fixture(); data.rows.push({...data.rows[78], id: 999});
  assert.equal(inspectFinalNativeIssues(data).passed, false);
});
test('a target left In Progress cannot pass', () => {
  const data = fixture(); data.rows.find(row => row.name === '[Build] Create n8n workflow').workflow_stage_id = 11;
  assert.equal(inspectFinalNativeIssues(data).passed, false);
});
test('an update outside the sixty children and thirty parent rollups cannot pass', () => {
  const data = fixture(); data.plan.updates[0] = {id: 1, data: {workflow_stage_id: 9, description: '<p>Original evidence</p>'}};
  assert.equal(inspectFinalNativeIssues(data).passed, false);
});
