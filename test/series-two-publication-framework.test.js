'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const crypto=require('node:crypto');
const specs=require('../scripts/series-two-specs');
const {adapters,fixtureFor,prepareSource}=require('../scripts/series-two-source-adapters');
const {buildPublicationWorkflow,chooseRequest,decideRecovery,completedState,sourceCandidates}=require('../scripts/series-two-publication-framework');
const NOW='2026-10-01T12:00:00.000Z';
test('all submission drafts retain the unverified walkthrough placeholder in companion guides',()=>{
  for(const spec of specs){
    const built=buildPublicationWorkflow(spec),draft=built.doc.split('## Publication submission draft')[1];
    assert.ok(draft,'Missing submission draft for D'+spec.day);
    assert.equal(draft.split('Workflow walkthrough: {{YOUTUBE_VIDEO_URL}}').length-1,1);
    assert.equal(built.doc.split('Workflow walkthrough: {{YOUTUBE_VIDEO_URL}}').length-1,1);
    assert.equal(JSON.stringify(built.workflow).includes('{{YOUTUBE_VIDEO_URL}}'),false);
  }
});
function runCode(workflow,name,input,outputs={}) {
  const node=workflow.nodes.find(n=>n.name===name);
  class FixedDate extends Date {constructor(value){super(value===undefined?NOW:value)}static now(){return Date.parse(NOW)}}
  const items=Array.isArray(input)?input: [{json:input}];
  return vm.runInNewContext('(function(){'+node.parameters.jsCode+'\n})()',{$input:{first:()=>items[0],all:()=>items},$:key=>({first:()=>outputs[key][0],all:()=>outputs[key]}),Date:FixedDate});
}
test('completed revisions suppress paid work, new revisions queue, and unversioned edits stop',()=>{
  const candidate={ready:true,workflow_slug:'release',source_id:'immutable-1',revision:'r1',input_hash:'hash1',sourceRow:{}};
  const cfg={driveFolderId:'private-folder'};
  const first=chooseRequest([candidate],cfg);
  assert.equal(first.request_key,'release|immutable-1|r1|private-folder');
  const delivered={...candidate,sourceRow:{automation_status:'delivered',request_key:first.request_key,input_hash:'hash1'}};
  const noWork=chooseRequest([delivered],cfg);assert.equal(noWork.ready,false);assert.equal(noWork.report.alreadyDelivered,1);
  assert.equal(chooseRequest([{...delivered,revision:'r2'}],cfg).ready,true);
  assert.throws(()=>chooseRequest([{...delivered,input_hash:'edited'}],cfg),/new revision/);
  assert.equal(chooseRequest([{ready:false,decision:'review',reason:'No approved controls'}],cfg).report.skipped[0].decision,'review');
});
test('accepted or uploaded state survives retry and ambiguous paid submission fails closed',()=>{
  const prepared={request_key:'r',input_hash:'h',project_json:'original'};
  assert.equal(decideRecovery(prepared,[{}]).status,'new');
  for(const status of ['accepted','completed','uploaded','delivered']){
    const saved={...prepared,status,job_id:'accepted-id',video_url:status==='accepted'?'':'https://media.example/video.mp4',drive_file_id:status==='uploaded'?'drive-id':''};
    assert.deepEqual(decideRecovery(prepared,[saved]),saved);
  }
  assert.throws(()=>decideRecovery(prepared,[{...prepared,status:'submitting'}]),/ambiguous/);
  assert.throws(()=>decideRecovery(prepared,[{...prepared,input_hash:'changed'}]),/different content/);
  assert.throws(()=>decideRecovery(prepared,[prepared,prepared]),/Duplicate ledger/);
  assert.throws(()=>decideRecovery(prepared,[{...prepared,status:'accepted'}]),/Incomplete ledger/);
});
test('media completion guards retain saved job context and reject missing upload or unfinished jobs',()=>{
  const context={job_id:'known-job',request_key:'source-r1',quoted_credits:18};
  const state=completedState({state:'completed',outputUrl:'https://media.example/video.mp4'},context);
  assert.equal(state.status,'completed');assert.equal(state.job_id,'known-job');assert.equal(state.quoted_credits,18);
  assert.throws(()=>completedState({state:'completed'},context),/no HTTPS/);
  assert.throws(()=>completedState({state:'running'},context),/Retry this saved job/);
});
test('clock changes do not change event fingerprints; pending daily requests retain the original period',()=>{
  const cfg={driveFolderId:'private-folder',maxSourceRows:500,brandName:'Zvid',accentColor:'#D8F17C',sceneSeconds:6};
  const firstTime=NOW, later='2026-10-01T12:05:00.000Z',tomorrow='2026-10-02T12:05:00.000Z';
  const fixture=fixtureFor(35,NOW);
  const get=(day,f,time,saved=[])=>sourceCandidates(day,adapters[day],[f.primary],f.details,saved,cfg,time,prepareSource)[0];
  assert.equal(get(35,fixture,firstTime).fingerprint,get(35,fixture,later).fingerprint);
  const daily=fixtureFor(47,NOW),todayCandidate=get(47,daily,NOW);
  const saved={workflow_slug:adapters[47].slug,source_id:daily.primary.source_id,revision:'r1',request_period:'2026-10-01',status:'accepted',input_json:JSON.stringify(todayCandidate.input),context_json:JSON.stringify(todayCandidate.context),request_key:[adapters[47].slug,daily.primary.source_id,'r1','2026-10-01',cfg.driveFolderId].join('|')};
  const resume=get(47,daily,tomorrow,[saved]);assert.equal(resume.request_period,'2026-10-01');assert.equal(resume.fingerprint,todayCandidate.fingerprint);assert.deepEqual(resume.input,todayCandidate.input);
  const nextDay=get(47,daily,tomorrow,[{...saved,status:'delivered'}]);assert.equal(nextDay.request_period,'2026-10-02');assert.notEqual(nextDay.fingerprint,todayCandidate.fingerprint);
});
test('fundraising milestone memory suppresses a later revision that has not crossed a new milestone',()=>{
  const cfg={driveFolderId:'private-folder',maxSourceRows:500,brandName:'Zvid',accentColor:'#D8F17C',sceneSeconds:6},fixture=fixtureFor(57,NOW);
  const prior={workflow_slug:adapters[57].slug,source_id:fixture.primary.source_id,revision:'r0',status:'delivered',request_key:'prior|private-folder',context_json:JSON.stringify({milestonePercent:50})};
  const rows=fixture.details.map((row,index)=>({...row,revision:'r2',amount:index===0?280:row.amount}));
  const candidate=sourceCandidates(57,adapters[57],[{...fixture.primary,revision:'r2'}],rows,[prior],cfg,NOW,prepareSource)[0];
  assert.equal(candidate.ready,false);assert.match(candidate.reason,/milestone/i);
  rows[0].amount=310;
  const crossed=sourceCandidates(57,adapters[57],[{...fixture.primary,revision:'r2'}],rows,[prior],cfg,NOW,prepareSource)[0];assert.equal(crossed.ready,true);assert.equal(crossed.context.milestonePercent,60);
});
test('D57 exported policy preserves source provenance while applying delivered milestone history',()=>{
  const workflow=buildPublicationWorkflow(specs.find(spec=>spec.day===57)).workflow;
  const fixture=fixtureFor(57,NOW);
  const primary={...fixture.primary,revision:'r2',lastBriefedMilestone:0};
  const details=fixture.details.map(row=>({...row,revision:'r2'}));
  const cfg={...JSON.parse(workflow.nodes.find(node=>node.name==='Config').parameters.jsonOutput),spreadsheetId:'qa-workbook',driveFolderId:'private-folder'};
  const prior={workflow_slug:adapters[57].slug,source_id:primary.source_id,revision:'r1',status:'delivered',request_key:[adapters[57].slug,primary.source_id,'r1',cfg.driveFolderId].join('|'),context_json:JSON.stringify({milestonePercent:30})};
  const outputs={Config:[{json:cfg}],'Read source register':[{json:primary}],'Read related records':details.map(json=>({json})),'Read saved requests':[{json:prior}]};
  const policy=workflow.nodes.find(node=>node.name.startsWith('Apply ')).name;
  const candidate=runCode(workflow,policy,{},outputs)[0].json;
  assert.equal(candidate.ready,true);
  assert.equal(candidate.context.record.lastBriefedMilestone,0);
  assert.equal(candidate.context.effectiveLastBriefedMilestone,30);
  assert.equal(candidate.context.milestonePercent,50);
  assert.equal(JSON.parse(candidate.fingerprint).record.lastBriefedMilestone,0);
  assert.equal(primary.lastBriefedMilestone,0);
});
test('multiple sources and saved rows are processed once, and changed detail content invalidates a frozen request',()=>{
  const cfg={driveFolderId:'folder',maxSourceRows:500,brandName:'Zvid',accentColor:'#D8F17C',sceneSeconds:6};
  const fixture=fixtureFor(31,NOW),second={...fixture.primary,source_id:'qa-second'};
  const first=sourceCandidates(31,adapters[31],[fixture.primary],fixture.details,[],cfg,NOW,prepareSource)[0];
  const saved={workflow_slug:adapters[31].slug,source_id:fixture.primary.source_id,revision:'r1',status:'accepted',request_key:[adapters[31].slug,fixture.primary.source_id,'r1','folder'].join('|'),input_json:JSON.stringify(first.input),context_json:JSON.stringify(first.context)};
  const rows=sourceCandidates(31,adapters[31],[fixture.primary,second],[...fixture.details,...fixture.details.map(r=>({...r,parent_id:'qa-second'}))],[saved,{...saved,source_id:'unrelated',request_key:'unrelated|folder'}],cfg,NOW,prepareSource);
  assert.equal(rows.filter(r=>r.ready).length,2);assert.equal(rows[0].savedStatus,'accepted');assert.equal(rows[2].decision,'review');assert.match(rows[2].reason,/deleted or revised source/);
  const changed=sourceCandidates(31,adapters[31],[fixture.primary],fixture.details.map((r,i)=>({...r,detail:i===0?'Edited during render':r.detail})),[saved],cfg,NOW,prepareSource)[0];assert.notEqual(changed.fingerprint,first.fingerprint);
  for(const name of ['Read source register','Read related records','Recheck related content','Read related receipt content'])assert.equal(buildPublicationWorkflow(specs[0]).workflow.nodes.find(n=>n.name===name).executeOnce,true);
});
test('dry runs stop at saved request inspection and receipt mismatches cannot become delivered',()=>{
  const workflow=buildPublicationWorkflow(specs[0]).workflow;
  assert.equal(workflow.connections['Inspect saved request only?'].main[0][0].node,'Saved request inspection');assert.ok(!workflow.connections['Saved request inspection']);
  for(const status of ['accepted','completed','uploaded']){
    const inspected=runCode(workflow,'Saved request inspection',{status,brief_json:'{}',job_id:'saved-job',video_url:'https://example.com/v.mp4',source_id:'id',revision:'r1'})[0].json;
    assert.equal(inspected.dryRun,true);assert.equal(inspected.deliveryAttempted,false);assert.equal(inspected.renderSubmitted,false);
  }
  const state={source_id:'id',revision:'r1',input_hash:'hash',request_key:'key',job_id:'job',video_url:'https://example.com/v.mp4',drive_file_id:'drive',drive_url:'https://drive.google.com/file/d/drive/view'};
  const row={...state,automation_status:'delivered'},outputs={'Protect source writeback':[{json:state}]};
  assert.equal(runCode(workflow,'Mark delivered',{input_hash:'hash',sourceRow:row},outputs)[0].json.status,'delivered');
  for(const field of ['input_hash','video_url','drive_url','job_id','drive_file_id','revision'])assert.throws(()=>runCode(workflow,'Mark delivered',{input_hash:'hash',sourceRow:{...row,[field]:'corrupt'}},outputs),/receipt did not match/);
  assert.throws(()=>runCode(workflow,'Protect source writeback',{input_hash:'changed'},{'Persist delivery file':[{json:state}]}),/changed during rendering/);
});
for(const spec of specs) test('D'+spec.day+' joins live domain rows and prepares a frozen recoverable request',()=>{
  const workflow=buildPublicationWorkflow(spec).workflow;
  const fixture=fixtureFor(spec.day,NOW);
  const config=JSON.parse(workflow.nodes.find(n=>n.name==='Config').parameters.jsonOutput);
  Object.assign(config,{spreadsheetId:'qa-workbook',driveFolderId:'qa-private-folder'});
  const outputs={Config:[{json:config}], 'Read saved requests':[{json:{}}], 'Read source register':[{json:fixture.primary}], 'Read related records':fixture.details.length?fixture.details.map(json=>({json})):[{json:{}}]};
  const policy=workflow.nodes.find(n=>n.name.startsWith('Apply ')).name;
  const candidates=runCode(workflow,policy,{},outputs);
  assert.equal(candidates.length,1);assert.equal(candidates[0].json.ready,true);
  const selected=chooseRequest(candidates.map(item=>({...item.json,input_hash:crypto.createHash('sha256').update(item.json.fingerprint).digest('hex')})),config);
  assert.equal(selected.source_id,fixture.primary.source_id);
  const frozen=runCode(workflow,'Prepare durable request',selected,outputs)[0].json;
  assert.equal(frozen.revision,'r1');assert.equal(frozen.input_hash.length,64);
  assert.equal(JSON.parse(frozen.context_json).sourceId,fixture.primary.source_id);
  assert.ok(JSON.parse(frozen.project_json).scenes.length>=3);
  assert.match(frozen.delivery_filename,/\.mp4$/);
  const prepared=prepareSource(spec.day,fixture.primary,fixture.details,NOW);
  assert.deepEqual(JSON.parse(frozen.input_json),prepared.input);
  const duplicateRows={...outputs,'Read source register':[{json:fixture.primary},{json:{...fixture.primary}}]};
  assert.throws(()=>runCode(workflow,policy,{},duplicateRows),/Duplicate source_id/);
  const empty=runCode(workflow,policy,{}, {...outputs,'Read source register':[{json:{}}]});assert.equal(empty[0].json.ready,false);
  const unapproved=runCode(workflow,policy,{}, {...outputs,'Read source register':[{json:{...fixture.primary,approval:'pending'}}]});assert.equal(unapproved[0].json.ready,false);
});
test('state writes bracket the nonretrying paid request and destination upload; canonical exports contain no credentials',()=>{
  for(const spec of specs){const {workflow,doc}=buildPublicationWorkflow(spec);
    const next=name=>workflow.connections[name].main[0].map(e=>e.node);
    assert.deepEqual(next('Persist submission intent'),['Submit render once']);
    assert.deepEqual(next('Capture accepted job'),['Persist accepted job']);
    assert.deepEqual(next('Persist accepted job'),['Poll saved job context']);
    assert.deepEqual(next('Video result'),['Persist completed media']);
    assert.deepEqual(next('Remember delivery'),['Persist delivery file']);
    assert.deepEqual(next('Protect source writeback'),['Update business register']);
    assert.equal(workflow.nodes.find(n=>n.name==='Upload private review video').retryOnFail,undefined);
    assert.equal(workflow.nodes.find(n=>n.name==='Submit render once').retryOnFail,undefined);
    assert.ok(workflow.nodes.every(n=>!n.credentials));
    for(const node of workflow.nodes.filter(n=>n.type==='n8n-nodes-base.code'))assert.doesNotThrow(()=>new Function(node.parameters.jsCode),spec.day+': '+node.name+' must compile as exported');
    assert.ok(doc.includes('Data Table'));assert.ok(doc.includes('Google Sheets'));assert.ok(doc.includes('Google Drive'));
    assert.ok(!doc.includes('upstream systems must avoid resending'));
  }
});
