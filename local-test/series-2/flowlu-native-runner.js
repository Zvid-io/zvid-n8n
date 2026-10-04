
function inspectPreview(result, expected) {
  if (result.isError) throw new Error('Flowlu preview rejected');
  const textBlock = result.content.find(x => x.type === 'text')?.text || '';
  const match = textBlock.match(/\x60\x60\x60json\s*([\s\S]*?)\x60\x60\x60/);
  if (!match) throw new Error('Flowlu preview has no inspectable JSON payload');
  const actual = JSON.parse(match[1]);
  for (const key of Object.keys(expected)) {
    if (actual[key] !== expected[key]) throw new Error('Flowlu preview mismatch: ' + key);
  }
  if (!actual.description.includes('<h2>Launch status</h2>') || /<(script|style|iframe|form)|\son\w+\s*=|(^|\n)\s*#{1,6}\s|\*\*/i.test(actual.description)) throw new Error('Unsafe or nonsemantic Flowlu description');
}
function parseCreatedId(result) {
  if (result.isError) throw new Error('Flowlu create rejected');
  const textBlock = result.content.find(x => x.type === 'text')?.text || '';
  const matches = [...textBlock.matchAll(/(?:Created:.*?ID|new ID)\s+(\d+)/gi)]; const match = matches[matches.length - 1];
  if (!match) throw new Error('Flowlu creation outcome unconfirmed');
  return Number(match[1]);
}
async function pacing() {
  const remaining = 3250 - (Date.now() - (load('lastFlowluWrite') || 0));
  if (remaining > 0) await new Promise(resolve => setTimeout(resolve, remaining));
}
async function persistReport() {
  const report = load('flowluReport');
  const next = JSON.stringify(report, null, 2) + '\n';
  const prev = load('flowluReportText');
  if (next === prev) return;
  const patch = '*** Begin Patch\n*** Update File: D:/Nodejs/Projects/zvid-cline/zvid-integrations/n8n/local-test/series-2/flowlu.json\n@@\n' +
    prev.trimEnd().split('\n').map(line => '-' + line).join('\n') + '\n' +
    next.trimEnd().split('\n').map(line => '+' + line).join('\n') + '\n*** End Patch';
  await tools.apply_patch(patch);
  store('flowluReportText', next);
}
async function registerWorkflow(index) {
  const item = load('flowluPlan').workflows[index];
  const existing = load('existingRecords');
  const marker = 'Workflow slug: <code>' + item.slug + '</code>';
  const parents = existing.filter(x => x.type_id === 3 && (x.description.includes(marker) || new RegExp('Workflow slug: ' + item.slug + '(?:\\n|$)').test(x.description)));
  if (parents.length > 1) throw new Error('Duplicate managed Story for ' + item.slug);
  let parentId = parents[0]?.id;
  if (index === 0 && !parentId) parentId = 364;
  if (!parentId) {
    const args = { module: 'agile', entity: 'issues', data: item.parent };
    const preview = await tools.mcp__flowlu__create_record(args);
    inspectPreview(preview, item.parent);
    await pacing();
    parentId = parseCreatedId(await tools.mcp__flowlu__create_record({ ...args, confirm: true }));
    store('lastFlowluWrite', Date.now());
    existing.push({ ...item.parent, id: parentId, parent_issue_id: 0 });
    store('existingRecords', existing);
  }
  let report = load('flowluReport');
  let rec = report.stories.find(x => x.slug === item.slug);
  if (!rec) {
    rec = { day: item.day, slug: item.slug, title: item.title, source: item.source, companionGuide: 'zvid-integrations/n8n/workflows/' + item.slug + '.md', storyId: parentId, stage: 'In Progress', children: [], remainingChildren: item.children.length, blockedChildren: 0 };
    report.stories.push(rec);
    report.totals.stories = report.stories.length;
    store('flowluReport', report);
    await persistReport();
  }
  for (const child of item.children) {
    if (rec.children.some(x => x.title === child.name)) continue;
    const matches = existing.filter(x => x.parent_issue_id === parentId && x.name === child.name);
    if (matches.length > 1) throw new Error('Duplicate child ' + child.name);
    let childId = matches[0]?.id;
    if (!childId) {
      const args = { parent_module: 'agile', parent_entity: 'issues', parent_id: parentId, alias: 'subtasks', data: child };
      const preview = await tools.mcp__flowlu__create_via_relation(args);
      inspectPreview(preview, child);
      await pacing();
      childId = parseCreatedId(await tools.mcp__flowlu__create_via_relation({ ...args, confirm: true }));
      store('lastFlowluWrite', Date.now());
      existing.push({ ...child, id: childId, parent_issue_id: parentId });
      store('existingRecords', existing);
    }
    rec.children.push({ id: childId, title: child.name, stage: child.name === '[Build] Create n8n workflow' ? 'In Progress' : 'Backlog' });
    report.totals.children = report.stories.reduce((a, b) => a + b.children.length, 0);
    store('flowluReport', report);
    await persistReport();
  }
  return { day: rec.day, slug: rec.slug, storyId: rec.storyId, children: rec.children.length, storiesRegistered: report.stories.length, childrenRegistered: report.totals.children };
}

async function applyEvidencePlan() {
  const plan = load('evidenceUpdatePlan');
  const report = load('flowluReport');
  for (const update of plan.updates) {
    const args = { module: 'agile', entity: 'issues', id: update.id, data: update.data };
    const preview = await tools.mcp__flowlu__update_record(args);
    inspectPreview(preview, update.data);
    await pacing();
    const result = await tools.mcp__flowlu__update_record({ ...args, confirm: true });
    store('lastFlowluWrite', Date.now());
    if (result.isError || !result.content?.[0]?.text?.startsWith('Updated:')) { store('unconfirmedFlowluUpdate', {update, result}); throw new Error('Flowlu evidence update outcome unconfirmed'); }
    const story = report.stories.find(x => x.slug === update.slug);
    if (update.child !== 'Story roll-up') {
      const child = story.children.find(x => x.id === update.id);
      child.stage = update.stage;
      child.evidenceRecorded = true;
      child.evidencePhase = plan.phase;
    }
    story.remainingChildren = story.children.filter(x => x.stage !== 'Done').length;
    story.blockedChildren = story.children.filter(x => x.stage === 'Blocked').length;
    const snap = plan.snapshots.find(x => x.slug === story.slug);
    if (snap) story.manualEvidence = snap;
    report.totals.remaining = report.stories.reduce((a,b)=>a+b.remainingChildren,0);
    report.totals.blocked = report.stories.reduce((a,b)=>a+b.blockedChildren,0);
    report.status = 'registration-verified; execution evidence being recorded';
    store('flowluReport', report);
    await persistReport();
    notify({slug:update.slug, item:update.child, stage:update.stage, id:update.id});
  }
  return {updatesApplied:plan.updates.length,remainingChildren:report.totals.remaining,blockedChildren:report.totals.blocked};
}

