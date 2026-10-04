'use strict';

function inspectFinalNativeIssues({rows, originalBaseline, preflight, plan, tracker}) {
  const fields = ['id', 'name', 'number_label', 'description', 'type_id', 'workflow_stage_id', 'parent_issue_id', 'project_id'];
  const compare = (before, after, omit = []) => fields.filter(key => !omit.includes(key) && before[key] !== undefined).every(key => JSON.stringify(before[key]) === JSON.stringify(after?.[key]));
  const byId = new Map(rows.map(row => [Number(row.id), row]));
  const beforeById = new Map(preflight.map(row => [Number(row.id), row]));
  const errors = [];
  if (rows.length !== 528 || byId.size !== 528) errors.push('Native issue count or IDs changed');
  if (originalBaseline.length !== 78 || preflight.length !== 528) errors.push('Preservation baselines incomplete');
  if (tracker.stories.length !== 30 || tracker.stories.some(story => story.children.length !== 14)) errors.push('Managed checklist count changed');
  const originalsChanged = originalBaseline.filter(row => !compare(row, byId.get(Number(row.id)))).map(row => row.id);
  if (originalsChanged.length) errors.push('Original records changed');

  const expectedTargets = new Set();
  const futureIds = [];
  const checklistErrors = [];
  const parents = [];
  const buildIds = [], assetIds = [];
  for (const story of tracker.stories) {
    const parentId = Number(story.storyId);
    expectedTargets.add(parentId);
    parents.push(parentId);
    const parent = byId.get(parentId);
    if (!parent || Number(parent.type_id) !== 3 || !compare(beforeById.get(parentId) || {}, parent, ['description', 'workflow_stage_id'])) checklistErrors.push({day: story.day, problem: 'Parent identity changed'});
    const actualChildren = rows.filter(row => Number(row.parent_issue_id) === parentId);
    if (actualChildren.length !== 14 || new Set(actualChildren.map(row => row.name)).size !== 14) checklistErrors.push({day: story.day, problem: 'Checklist child count or title uniqueness changed'});
    for (const child of story.children) {
      const id = Number(child.id), actual = byId.get(id);
      if (!actual || actual.name !== child.title || Number(actual.parent_issue_id) !== parentId) checklistErrors.push({day: story.day, problem: 'Child identity changed', id});
      if (child.title === '[Build] Create n8n workflow') {buildIds.push(id); expectedTargets.add(id);}
      else if (child.title === '[Asset] Capture n8n workflow screenshot') {assetIds.push(id); expectedTargets.add(id);}
      else futureIds.push(id);
    }
    const marker = 'Workflow slug: <code>' + story.slug + '</code>';
    const managedMatches = rows.filter(row => Number(row.type_id) === 3 && String(row.description || '').includes(marker));
    if (managedMatches.length !== 1 || Number(managedMatches[0]?.id) !== parentId) checklistErrors.push({day: story.day, problem: 'Managed slug duplicate or missing'});
  }
  if (checklistErrors.length) errors.push('Managed story/checklist identities changed');
  const futureChanged = futureIds.filter(id => !compare(beforeById.get(id) || {}, byId.get(id)));
  if (futureIds.length !== 360 || new Set(futureIds).size !== 360 || futureChanged.length || futureIds.some(id => Number(byId.get(id)?.workflow_stage_id) !== 9)) errors.push('Future launch tasks changed');
  const updateIds = plan.updates.map(update => Number(update.id));
  if (!plan.rootReportConfirmed || updateIds.length !== 90 || new Set(updateIds).size !== 90 || expectedTargets.size !== 90 || updateIds.some(id => !expectedTargets.has(id))) errors.push('Completion update scope or root confirmation invalid');
  const updateMismatches = plan.updates.filter(update => Object.keys(update.data).some(key => JSON.stringify(update.data[key]) !== JSON.stringify(byId.get(Number(update.id))?.[key]))).map(update => Number(update.id));
  if (updateMismatches.length) errors.push('Confirmed native descriptions or stages differ from reviewed plan');
  if (buildIds.length !== 30 || assetIds.length !== 30 || buildIds.concat(assetIds).some(id => Number(byId.get(id)?.workflow_stage_id) !== 14)) errors.push('Current n8n Build/Screenshot tasks are not all Done');
  if (parents.length !== 30 || parents.some(id => Number(byId.get(id)?.workflow_stage_id) !== 11)) errors.push('Parent Stories must remain In Progress');
  return {
    checkedAt: new Date().toISOString(), projectId: 6, projectKey: 'ZWL', nativeConnectionAvailable: true,
    rootReportConfirmed: plan.rootReportConfirmed === true, totalNativeIssues: rows.length,
    managedStories: parents.length, managedChildren: tracker.stories.reduce((total, story) => total + story.children.length, 0),
    currentN8nBuildsDone: buildIds.filter(id => Number(byId.get(id)?.workflow_stage_id) === 14).length,
    currentN8nScreenshotTasksDone: assetIds.filter(id => Number(byId.get(id)?.workflow_stage_id) === 14).length,
    parentsInProgress: parents.filter(id => Number(byId.get(id)?.workflow_stage_id) === 11).length,
    futureChildrenBacklog: futureIds.filter(id => Number(byId.get(id)?.workflow_stage_id) === 9).length,
    futureChildrenUnchanged: futureChanged.length === 0, originalRecordsVerified: originalBaseline.length,
    originalRecordsUnchanged: originalsChanged.length === 0, originalsChanged, futureChanged, checklistErrors, updateMismatches,
    updatesVerified: plan.updates.length - updateMismatches.length, noNewIssuesCreated: rows.length === preflight.length,
    comparisonFields: fields, errors, passed: errors.length === 0,
    scope: 'Only current managed n8n builds, screenshot tasks and parent evidence rollups; original records and future launch tasks preserved',
  };
}

if (typeof module !== 'undefined') module.exports = {inspectFinalNativeIssues};
