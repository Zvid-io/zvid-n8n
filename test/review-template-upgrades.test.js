'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {selectHiring,selectWorkout,checkQuote,classifyJob}=require('../scripts/review-template-runtime');
const {renameNodes,restaurantNames}=require('../scripts/upgrade-reviewed-templates');
const hiring=require('../workflows/zvid-were-hiring-video.json');
const workout=require('../workflows/zvid-workout-of-the-day.json');
const now=new Date('2026-10-01T12:00:00Z');
const job=(key,extra={})=>({JobKey:key,Role:'Engineer '+key,ApplyUrl:'https://example.com/jobs/'+key,Approval:'approved',...extra});
const plan=(extra={})=>({WorkoutKey:'wod-20261001',Date:'2026-10-01',WorkoutName:'Strength',Approval:'approved',Ex1:'Squat x 5x5',...extra});

test('Hiring uses approval, open/close windows, priority, completion and unique keys',()=>{
  const rows=[job('low',{Priority:1}),job('high',{Priority:10}),job('hold',{Approval:''}),job('future',{OpensOn:'2026-10-02'}),job('closed',{ClosesOn:'2026-09-30'}),job('done',{VideoUrl:'https://cdn.example/done.mp4'}),job('uncertain',{RenderStatus:'submitting'}),job('http',{ApplyUrl:'http://example.com'})];
  const tasks=selectHiring({maxPerRun:1,timezone:'Africa/Cairo'},rows,now);
  assert.equal(tasks[0].key,'high');assert.equal(tasks[0].audit.deferred,1);
  assert.deepEqual(tasks[0].audit.skipped.map(r=>r.reason),['awaiting_approval','not_open_yet','closed','already_rendered','submitting_needs_review','missing_role_or_https_apply_url']);
  assert.throws(()=>selectHiring({},[job('duplicate'),job('duplicate')],now),/unique JobKey/);
  assert.throws(()=>selectHiring({},[job('date',{OpensOn:'2026-10-02',ClosesOn:'2026-10-01'})],now),/after ClosesOn/);
  for(const rows of [[],[job('done',{VideoUrl:'https://cdn.example/done.mp4'})]])assert.equal(selectHiring({},rows,now)[0].pendingCount,0);
});
test('Saved hiring jobs resume before new work even after approval expires; previews skip them',()=>{
  const rows=[job('new',{Priority:100}),job('saved',{Approval:'',RenderJobId:'saved-job',RenderStatus:'rendering'})];
  assert.equal(selectHiring({},rows,now)[0].jobId,'saved-job');
  assert.equal(selectHiring({dryRun:true},rows,now).length,1);
  assert.equal(selectHiring({dryRun:true},rows,now)[0].key,'new');
});
test('Workout variants use coach-provided exercises and preserve the selected date',()=>{
  const rows=[plan({Date:'2026-09-30',ScaledEx1:'Box squat x 3x8',ScaledCoachNote:'Use the coach-selected box.'}),plan({WorkoutKey:'future',Date:'2026-10-02'})];
  assert.equal(selectWorkout({},rows,now)[0].pendingCount,0);
  const variants=selectWorkout({fallbackToLatest:true},rows,now);
  assert.deepEqual(variants.map(v=>v.variant),['Standard','Scaled']);
  assert.equal(variants[1].exercises[0].name,'Box squat');assert.equal(variants[1].exercises[0].reps,'3x8');
  assert.equal(variants[1].coachNote,'Use the coach-selected box.');
  for(const v of variants){assert.equal(v.dateIso,'2026-09-30');assert.equal(v.usedFallback,true);assert.match(v.dateLabel,/SEP 30/);}
  assert.throws(()=>selectWorkout({},[plan(),plan({WorkoutKey:'second'})],now),/one training plan per Date/);
  assert.equal(selectWorkout({},[plan({Approval:''})],now)[0].pendingCount,0);
  const one=selectWorkout({},[plan({StandardVideoUrl:'https://cdn.example/done.mp4',ScaledEx1:'Box squat x 3x8'})],now);
  assert.deepEqual(one.map(v=>v.variant),['Scaled']);
});
test('Date selection follows the configured timezone at midnight',()=>{
  const rows=[plan()];
  assert.equal(selectWorkout({timezone:'Africa/Cairo'},rows,new Date('2026-09-30T22:00:00Z'))[0].variant,'Standard');
  assert.equal(selectWorkout({timezone:'UTC'},rows,new Date('2026-09-30T22:00:00Z'))[0].pendingCount,0);
});
test('Quotes fail closed; completed, failed and timed-out jobs retain identity',()=>{
  assert.throws(()=>checkQuote({maxCreditsPerVideo:20},{},{valid:true,creditsRequired:21}),/No paid render/);
  assert.throws(()=>checkQuote({maxCreditsPerVideo:20},{},{valid:true}),/valid credit quote/);
  assert.throws(()=>checkQuote({maxCreditsPerVideo:20},{},{valid:false,errors:[{message:'bad scene'}]}),/bad scene/);
  const context={jobId:'already-paid',pollStartedAt:0};
  assert.equal(classifyJob(context,{state:'completed',result:'https://cdn.example/a.mp4'},1,20).status,'completed');
  assert.equal(classifyJob(context,{state:'completed',result:''},1,20).status,'needs_review');
  assert.equal(classifyJob(context,{state:'failed',failedReason:'asset unavailable'},1,20).jobId,'already-paid');
  assert.equal(classifyJob(context,{state:'active'},1200001,20).status,'timed_out');
});

// Execute the actual exported graph, code and expressions; stub only service
// boundaries. This catches branch wiring and variant write-back errors.
function runGraph(original,sourceRows,overrides={},responses={}) {
  const w=structuredClone(original),byName=new Map(w.nodes.map(n=>[n.name,n])),history=new Map(),saved=structuredClone(sourceRows),submissions=[],updates=[];
  const config=w.nodes.find(n=>n.type==='n8n-nodes-base.set');
  config.parameters.jsonOutput=JSON.stringify({...JSON.parse(config.parameters.jsonOutput),fallbackToLatest:true,...overrides});
  let loop=null,steps=0;
  const access=name=>({first:()=>{const a=history.get(name)?.[0];assert.ok(a?.[0],'No output for '+name);return a[0];},all:()=>history.get(name)?.[0] || []});
  const value=(v,input)=>typeof v==='string'&&v.startsWith('={{')?new Function('$json','$','return ('+v.slice(3,-2)+')')(input,access):v;
  function visit(name,items){
    if(++steps>500)throw Error('Graph did not terminate');
    const n=byName.get(name);assert.ok(n,'Unknown graph node '+name);
    const first=items[0]?.json || {};let outputs=[items];
    if(n.type==='n8n-nodes-base.set')outputs=[[{json:JSON.parse(n.parameters.jsonOutput)}]];
    else if(n.type==='n8n-nodes-base.code')outputs=[new Function('$json','$input','$','$runIndex',n.parameters.jsCode)(first,{all:()=>items,first:()=>items[0]},access,0)];
    else if(n.type==='n8n-nodes-base.if'){const pass=value(n.parameters.conditions.conditions[0].leftValue,first);outputs=pass?[items,[]]:[[],items];}
    else if(n.type==='n8n-nodes-base.splitInBatches'){
      if(!loop)loop={remaining:[...items],reports:[]};else loop.reports.push(...items);
      outputs=loop.remaining.length?[[],[loop.remaining.shift()]]:[loop.reports,[]];
    } else if(n.type==='n8n-nodes-base.googleSheets'){
      if(n.parameters.operation==='read')outputs=[saved.length?saved.map(json=>({json})):[{json:{}}]];
      else{
        const fields=Object.fromEntries(Object.entries(n.parameters.columns.value).map(([k,v])=>[k,value(v,first)]));
        const key=n.parameters.columns.matchingColumns[0], row=saved.find(r=>r[key]===fields[key]);assert.ok(row,'Update target missing');
        updates.push({node:n.name,fields});Object.assign(row,fields);outputs=[[{json:fields}]];
      }
    } else if(n.type==='@zvid/n8n-nodes-zvid.zvid'){
      if(n.parameters.operation==='validate')outputs=[[{json:{valid:true,creditsRequired:responses.quote ?? 12}}]];
      else if(n.parameters.operation==='create'){
        const payload=JSON.parse(value(n.parameters.projectJson,first));submissions.push(payload);outputs=[[{json:{jobId:'created-'+submissions.length}}]];
      } else {const id=value(n.parameters.jobId,first);outputs=[[{json:{id,state:responses.state || 'completed',result:'https://cdn.example/'+id+'.mp4'}}]];}
    } else if(n.type==='n8n-nodes-base.httpRequest'&&n.parameters.method==='HEAD')outputs=[[{json:{statusCode:200,headers:{'content-length':'100'}}}]];
    history.set(name,outputs);
    for(let i=0;i<outputs.length;i++)if(outputs[i].length)for(const e of w.connections[name]?.main?.[i] || [])visit(e.node,outputs[i]);
  }
  visit(w.nodes.find(n=>n.type==='n8n-nodes-base.manualTrigger').name,[{json:{}}]);
  return {saved,submissions,updates,history};
}
test('Exported workout graph saves each variant without erasing the other result',()=>{
  const r=runGraph(workout,[plan({ScaledEx1:'Box squat x 3x8'})]);
  assert.equal(r.submissions.length,2);
  const row=r.saved[0];assert.match(row.StandardVideoUrl,/created-1/);assert.match(row.ScaledVideoUrl,/created-2/);
  assert.match(row.StandardCaption,/Standard/);assert.match(row.ScaledCaption,/Scaled/);
  assert.match(JSON.stringify(r.submissions[1]),/Box squat/i);
  assert.equal(r.history.get('Summarize campaign results and skipped work')[0][0].json.completed,2);
  const rerun=runGraph(workout,r.saved);assert.equal(rerun.submissions.length,0);assert.equal(rerun.updates.length,0);
});
test('Exported preview graphs do not submit or write; oversized quotes stop before claim',()=>{
  for(const [w,rows] of [[workout,[plan({ScaledEx1:'Box squat x 3x8'})]]]){
    const r=runGraph(w,rows,{dryRun:true});assert.equal(r.submissions.length,0);assert.equal(r.updates.length,0);
    assert.throws(()=>runGraph(w,rows,{}, {quote:100}),/No paid render/);
  }
});
test('Failed render outcomes are saved and are not automatically resubmitted',()=>{
  const failed=runGraph(workout,[plan()],{}, {state:'failed'});
  assert.equal(failed.saved[0].StandardStatus,'failed');assert.equal(failed.saved[0].StandardJobId,'created-1');
  assert.equal(runGraph(workout,failed.saved).submissions.length,0);
});
test('Restaurant descriptive renaming preserves reference semantics and connections',()=>{
  const original={nodes:[{name:'Config',parameters:{jsonOutput:'{}'}},{name:'Build project JSON',parameters:{jsCode:"const cfg = $('Config').first().json; return cfg;"}}],connections:{Config:{main:[[{node:'Build project JSON',type:'main',index:0}]]}}};
  const inverse=Object.fromEntries(Object.entries(restaurantNames).map(([a,b])=>[b,a]));
  assert.deepEqual(renameNodes(renameNodes(structuredClone(original),restaurantNames),inverse),original);
});
module.exports={runGraph};
