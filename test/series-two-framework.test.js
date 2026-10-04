'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { buildWorkflow, buildPayload, runTransform, normalizeConfig, checkValidationResult, assertWorkflow } = require('../scripts/series-two-framework');

const spec = {
  day: 31, slug: 'zvid-framework-pilot', title: 'Operations snapshot video',
  description: 'For operations teams turning supplied metrics into a short internal briefing.',
  fields: ['team', 'records'], sample: { team: 'Support', records: [{ completed: 12, total: 20 }, { completed: 18, total: 30 }] },
  transform: `const team = str(req(src.team, 'team'), 60);
const records = list(src.records, 'records');
if (!records.length) return { skip: true, reason: 'No records supplied.' };
let completed = 0; let total = 0;
for (const record of records) { const done=num(record.completed,'completed'); const all=num(record.total,'total',1); if(done>all)throw new Error('completed cannot exceed total.'); completed+=done; total+=all; }
return { title:team+' operations', subtitle:'Calculated from '+records.length+' records', cards:[{label:'Completed',value:String(completed),detail:'Total completed items'},{label:'Completion',value:(100*completed/total).toFixed(1)+'%',detail:'Completed divided by total'}], footer:'Review pending items.',sourceKey:team+'-'+total,meta:{completed,total,records:records.length} };`,
};
function executeCode(workflow, name, input, outputs = {}) {
  const code = workflow.nodes.find(n => n.name === name).parameters.jsCode;
  return vm.runInNewContext('(function(){' + code + '\n})()', { $input: { first: () => ({ json: input }) }, $: key => ({ first: () => ({ json: outputs[key] }) }) });
}

test('transforms apply actual business rules and reject incomplete or contradictory input', () => {
  const brief = runTransform(spec, spec.sample);
  assert.equal(brief.meta.completed, 30); assert.equal(brief.meta.total, 50); assert.equal(brief.cards[1].value, '60.0%');
  assert.throws(() => runTransform(spec, { records: [] }), /team is required/);
  assert.throws(() => runTransform(spec, { team: 'X', records: [{ completed: 4, total: 3 }] }), /cannot exceed total/);
  assert.throws(() => runTransform(spec, { team: 'X', records: [{ completed: '', total: 3 }] }), /is required/);
});
test('zero-work is explicit and branches before Zvid validation or paid rendering', () => {
  const workflow = buildWorkflow(spec).workflow;
  const config = JSON.parse(workflow.nodes.find(n => n.name === 'Config').parameters.jsonOutput);
  const result = executeCode(workflow, 'Normalize and build video', { ...config, body: { team: 'Support', records: [] } }, { Config: config });
  assert.equal(result[0].json.ready, false); assert.equal(result[0].json.status, 'nothing_to_render'); assert.ok(result[0].json.reason);
  assert.equal(workflow.connections['Work found?'].main[1][0].node, 'Nothing to render');
  assert.ok(!workflow.connections['Nothing to render']);
});
test('generated embedded runtime processes manual samples and webhook bodies identically', () => {
  const workflow = buildWorkflow(spec).workflow;
  const config = JSON.parse(workflow.nodes.find(n => n.name === 'Config').parameters.jsonOutput);
  const manual = executeCode(workflow, 'Normalize and build video', { ...spec.sample, ...config }, { Config: config });
  const webhook = executeCode(workflow, 'Normalize and build video', { ...config, body: spec.sample }, { Config: config });
  assert.equal(JSON.stringify(manual), JSON.stringify(webhook));
  assert.equal(manual[0].json.seconds, 18); assert.equal(manual[0].json.meta.completed, 30);
  assert.equal(workflow.nodes.find(n => n.name === 'Config').parameters.includeOtherFields, true);
});
test('payload is 720p, has bounded scenes and text, and uses no remote media', () => {
  const brief = runTransform(spec, spec.sample); const payload = buildPayload(brief, {}, spec);
  assert.equal(payload.resolution, 'hd'); assert.equal(payload.scenes.length, 3);
  assert.equal(payload.scenes.reduce((sum,s)=>sum+s.duration,0), 18);
  assert.deepEqual(payload.audios, []);
  for (const scene of payload.scenes) for (const visual of scene.visuals) {
    assert.ok(['TEXT', 'SVG'].includes(visual.type)); assert.ok(!visual.src);
    if (visual.type === 'SVG') { assert.equal(visual.width, 1280); assert.equal(visual.height, 720); }
    if (visual.type === 'TEXT') assert.ok(visual.x >= 0 && visual.y <= 650 && visual.x + visual.width <= 1280);
  }
  const six = { ...brief, cards: Array.from({length:6},(_,i)=>({label:'Metric '+i,value:String(i),detail:'Detail'})) };
  assert.equal(buildPayload(six, {}, spec).scenes.length, 4);
  assert.throws(()=>buildPayload({...brief,cards:[]},{},spec),/one to six/);
  assert.ok(!JSON.stringify(payload).includes('-webkit-'),'deployed HTML validator disallows vendor-prefixed CSS property names');
});
test('untrusted text is escaped including template braces and invalid theme CSS fails', () => {
  const brief = runTransform(spec, spec.sample);
  const attack = '<img src=x onerror="alert(1)">{{secret}} & "quotes"';
  const payload = buildPayload({ ...brief, title: attack, subtitle: attack, footer: attack, cards:[{label:attack,value:attack,detail:attack}] }, {}, spec);
  const html = payload.scenes.flatMap(s=>s.visuals).filter(v=>v.html).map(v=>v.html).join('');
  assert.ok(!html.includes('<img')); assert.ok(!html.includes('{{secret}}')); assert.match(html,/&lt;img/); assert.match(html,/&#123;/);
  assert.throws(()=>buildPayload(brief,{accentColor:'red;position:fixed'},spec),/hexadecimal/);
  assert.throws(()=>normalizeConfig({dryRun:'false',maxRenderCredits:20}),/boolean/);
});
test('validation gate refuses invalid payloads, unavailable quotes, and excess credits', () => {
  const cfg = normalizeConfig({dryRun:false,maxRenderCredits:20}); const build={payload:{name:'original'},meta:{total:50}};
  assert.throws(()=>checkValidationResult({valid:false,errors:[{field:'resolution',message:'unsupported'}]},build,cfg),/resolution: unsupported/);
  assert.throws(()=>checkValidationResult({valid:true},build,cfg),/creditsRequired is required/);
  assert.throws(()=>checkValidationResult({valid:true,creditsRequired:21},build,cfg),/maxRenderCredits is 20/);
  assert.throws(()=>checkValidationResult({valid:true,creditsRequired:-1},build,cfg),/finite number/);
  const ok=checkValidationResult({valid:true,creditsRequired:8,payload:{name:'resolved'}},build,cfg);
  assert.equal(ok.quotedCredits,8); assert.equal(ok.payload.name,'resolved'); assert.equal(ok.meta.total,50);
  const defaults=normalizeConfig({dryRun:false}); assert.equal(defaults.maxRenderCredits,30);
  assert.equal(checkValidationResult({valid:true,creditsRequired:24},build,defaults).quotedCredits,24);
  assert.throws(()=>checkValidationResult({valid:true,creditsRequired:31},build,defaults),/maxRenderCredits is 30/);
});
test('paid submission is not retried and job polling plus preview are bounded', () => {
  const workflow=buildWorkflow(spec).workflow; const submit=workflow.nodes.find(n=>n.name==='Submit render once');
  assert.ok(!submit.retryOnFail); assert.equal(submit.parameters.waitForCompletion,false);
  const poll=workflow.nodes.find(n=>n.name==='Wait for completed render');assert.equal(poll.parameters.waitForCompletion,true);assert.equal(poll.parameters.operation,'get');
  assert.throws(()=>normalizeConfig({dryRun:false,maxRenderCredits:20,maxWaitSeconds:1201}),/maxWaitSeconds/);
  const watch=workflow.nodes.find(n=>n.name==='Watch video');assert.equal(watch.typeVersion,2);assert.equal(watch.maxTries,3);assert.equal(watch.waitBetweenTries,5000);assert.equal(watch.parameters.options.timeout,30000);assert.equal(watch.onError,'continueRegularOutput');
  assert.equal(workflow.connections['Video result'].main[0][0].node,'Completed video available?');assert.equal(workflow.connections['Completed video available?'].main[0][0].node,'Watch video');
  assert.ok(!workflow.connections['Draft and credit quote']);
});
test('completed result retains URL and source metadata before preview and rejects unusable URLs', () => {
  const workflow=buildWorkflow(spec).workflow;
  const built={sourceKey:'support-50',quotedCredits:8,seconds:9,brief:{title:'Support'},meta:{total:50}};
  const result=executeCode(workflow,'Video result',{state:'completed',id:'job-31',result:{url:'https://example.com/31.mp4'}},{'Check validation and credit cap':built});
  assert.equal(result[0].json.videoUrl,'https://example.com/31.mp4');assert.equal(result[0].json.jobId,'job-31');assert.equal(result[0].json.meta.total,50);
  assert.throws(()=>executeCode(workflow,'Video result',{state:'completed',result:{url:'http://insecure.test/v.mp4'}},{'Check validation and credit cap':built}),/HTTPS/);
  assert.throws(()=>executeCode(workflow,'Video result',{state:'failed'},{'Check validation and credit cap':built}),/state failed/);
});
test('a completed job with a missing uploaded video fails closed and identifies the accepted job', () => {
  const workflow=buildWorkflow(spec).workflow;
  const built={sourceKey:'maintenance:2026-10-05',quotedCredits:18,seconds:18,brief:{title:'Maintenance'},meta:{}};
  const id='7ea52ac6-a58e-4a9c-b2f5-cc58edc2c57d';
  const completed={id,state:'completed',result:{ok:true,type:'video',fileName:'maintenance-notice-video.mp4',duration:18,thumbnailUrl:'https://example.com/thumbnail.jpg'}};
  assert.throws(()=>executeCode(workflow,'Video result',completed,{'Check validation and credit cap':built}),error=>{
    assert.ok(error.message.includes(id));
    assert.match(error.message,/video upload is missing or unavailable/);
    assert.match(error.message,/your Zvid dashboard/);
    assert.match(error.message,/Another run spends credits/);
    assert.ok(!error.message.includes(':'),'n8n task-runner errors must preserve the full message instead of splitting at a URL colon');
    assert.match(error.message,/does not resubmit automatically/);
    return true;
  });
  assert.equal(workflow.connections['Video result'].main.length,1);
  assert.equal(workflow.connections['Video result'].main[0][0].node,'Completed video available?');
  assert.ok(!workflow.nodes.find(n=>n.name==='Submit render once').retryOnFail);
});
test('a saved editor draft reports draft status and retains the quoted credits', () => {
  const workflow=buildWorkflow(spec).workflow;
  const built={sourceKey:'Acme Desk:2.4',quotedCredits:18,seconds:18,brief:{title:'Acme Desk 2.4'},meta:{changeCount:3}};
  const result=executeCode(workflow,'Draft and credit quote',{project:{id:'prj_CkqcCukDcmMFpPi7VelG'}},{'Check validation and credit cap':built})[0].json;
  assert.equal(result.status,'draft');assert.equal(result.editorDraftSaved,true);assert.equal(result.quotedCredits,18);
  assert.equal(result.editorLink,'https://editor.zvid.io/?project=prj_CkqcCukDcmMFpPi7VelG');
  assert.equal(result.editorDraftError,null);assert.equal(result.renderSubmitted,false);assert.equal(result.dryRun,true);
});
test('a project-limit failure reports draft_unavailable while preserving the original error and quote', () => {
  const workflow=buildWorkflow(spec).workflow;
  const built={sourceKey:'Acme Desk:2.4',quotedCredits:18,seconds:18,brief:{title:'Acme Desk 2.4'},meta:{changeCount:3}};
  for(const error of ['Project limit reached',{message:'Project limit reached'}]) {
    const result=executeCode(workflow,'Draft and credit quote',{error},{'Check validation and credit cap':built})[0].json;
    assert.equal(result.status,'draft_unavailable');assert.equal(result.editorDraftSaved,false);assert.equal(result.editorLink,null);
    assert.equal(result.editorDraftError,'Project limit reached');assert.equal(result.quotedCredits,18);
    assert.equal(result.renderSubmitted,false);assert.equal(result.dryRun,true);assert.equal(result.meta.changeCount,3);
  }
  const invalid=executeCode(workflow,'Draft and credit quote',{project:{id:'missing-project-prefix'}},{'Check validation and credit cap':built})[0].json;
  assert.equal(invalid.status,'draft_unavailable');assert.equal(invalid.editorDraftSaved,false);assert.equal(invalid.editorLink,null);
});
test('layout is deterministic with unique names, complete section membership, and credential-free native API nodes', () => {
  const first=buildWorkflow(spec);const second=buildWorkflow(spec);
  assert.deepEqual(first,second);assert.equal(assertWorkflow(first.workflow),true);
  const notes=first.workflow.nodes.filter(n=>n.type==='n8n-nodes-base.stickyNote'); assert.equal(notes.length,7);
  assert.equal(JSON.parse(first.workflow.nodes.find(n=>n.name==='Config').parameters.jsonOutput).dryRun,false);
  assert.equal(JSON.parse(first.workflow.nodes.find(n=>n.name==='Config').parameters.jsonOutput).maxRenderCredits,30);
  assert.ok(first.doc.includes(JSON.stringify(spec.sample,null,2)));assert.ok(first.doc.includes('https://zvid.io/contact'));
  const overview=notes.find(n=>n.parameters.color===1).parameters.content;
  assert.ok(!overview.includes('](./'),'unpublished companion files must not resolve to broken local workflow URLs');
  assert.match(overview,/included `framework-pilot\.md` companion/);
  for (const node of first.workflow.nodes) {
    assert.ok(!node.credentials);
    if(node.type==='n8n-nodes-base.httpRequest')assert.equal(node.name,'Watch video');
    if(node.type.includes('n8n-nodes-zvid'))assert.equal(node.type,'@zvid/n8n-nodes-zvid.zvid');
  }
});
test('webhook acknowledgement uses the installed v2 custom status collection and does not wait for rendering', () => {
  const workflow=buildWorkflow({...spec,slug:'framework-pilot'}).workflow;
  const webhook=workflow.nodes.find(n=>n.name==='Receive event');
  assert.equal(webhook.parameters.responseMode,'onReceived');
  assert.equal(webhook.parameters.options.responseCode.values.responseCode,'customCode');
  assert.equal(webhook.parameters.options.responseCode.values.customCode,202);
  assert.equal(JSON.parse(webhook.parameters.options.responseData).accepted,true);
  assert.equal(webhook.parameters.options.responseHeaders.entries[0].value,'application/json');
  assert.match(buildWorkflow({...spec,slug:'framework-pilot'}).doc,/zvid-framework-pilot\.json/);
});
test('payload passes the shared schema for one and six cards', async () => {
  const {validateProject}=await import('../../schema/dist/zvidSchema.js');
  const brief=runTransform(spec,spec.sample);
  for(const count of [1,6]) {
    const cards=Array.from({length:count},(_,i)=>({label:'Metric '+i,value:String(i),detail:'Calculated input'}));
    assert.deepEqual(validateProject(buildPayload({...brief,cards},{},spec)).errors,[]);
  }
});
