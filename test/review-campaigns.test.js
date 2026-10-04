'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {planHiring,planRestaurant,trackedLink,buildHiringCampaign}=require('../scripts/review-campaign-runtime');
const {upgradeWorkflow}=require('../scripts/upgrade-reviewed-templates');
const {organizeWorkflow}=require('../scripts/organize-workflow-series');
const hiring=require('../workflows/zvid-were-hiring-video.json'),restaurant=require('../workflows/zvid-restaurant-weekly-specials.json');
const now=new Date('2026-10-02T12:00:00Z');
const role=(key,extra={})=>({JobKey:key,Role:'Engineer '+key,Team:'Engineering',Location:'Remote',ApplyUrl:'https://example.com/jobs/'+key,Approval:'approved',...extra});
const dish=(key,category,extra={})=>({DishKey:key,Dish:'Dish '+key,Category:category,Price:'$15',PhotoUrl:'https://example.com/'+key+'.jpg',ThisWeek:true,InStock:true,Approval:'approved',...extra});
const menu=()=>[dish('main','Mains'),dish('starter','Starters'),dish('dessert','Desserts')];
const cfg={companyName:'Northwind',careersUrl:'https://example.com/careers',restaurantName:'Demo restaurant',bookingUrl:'https://example.com/book',maxDishes:3,minDishes:3,minCategories:2,timezone:'UTC'};
const brief={CampaignKey:'test-campaign',Mode:'roundup',MaxRoles:4};

test('Hiring brief selects one spotlight or a roundup with explicit-role completeness',()=>{
  const rows=[role('later',{ClosesOn:'2026-10-20',Priority:10}),role('soon',{ClosesOn:'2026-10-03'}),role('hold',{Approval:''}),role('other',{Team:'Design'}),role('expired',{ClosesOn:'2026-10-01'})];
  const p=planHiring(cfg,{...brief,Team:'Engineering'},rows,[],now);
  assert.deepEqual(p.roles.map(r=>r.jobKey),['soon','later']);
  assert.equal(p.skipped.length,3);assert.match(p.referralMessage,/jobs\/soon/);
  assert.equal(planHiring(cfg,{...brief,Mode:'spotlight',JobKeys:'later'},rows,[],now).roles.length,1);
  assert.throws(()=>planHiring(cfg,{...brief,Mode:'spotlight'},rows,[],now),/exactly one/);
  assert.equal(planHiring(cfg,{...brief,JobKeys:'soon,hold'},rows,[],now).ready,false);
  assert.throws(()=>planHiring(cfg,{...brief,MaxRoles:1,JobKeys:'soon,later'},rows,[],now),/silently omitting/);
  assert.throws(()=>planHiring(cfg,brief,[role('dup'),role('dup')],[],now),/unique JobKey/);
  assert.throws(()=>planHiring(cfg,brief,[role('date',{ClosesOn:'2026-02-30'})],[],now),/real YYYY/);
  const spotlight=planHiring(cfg,{...brief,Mode:'spotlight',JobKeys:'soon'},rows,[],now);
  const a=buildHiringCampaign(cfg,p),b=buildHiringCampaign(cfg,spotlight);
  assert.equal(a.payload.scenes[0].id,'campaign');assert.equal(b.payload.scenes[0].id,'role-1');
});
test('Tracked links preserve application parameters and fragments without duplicate UTM keys',()=>{
  const link=trackedLink('https://example.com/apply?job=42&utm_campaign=old#form','new-campaign','role-1');
  const url=new URL(link);assert.equal(url.searchParams.get('job'),'42');assert.equal(url.hash,'#form');assert.deepEqual(url.searchParams.getAll('utm_campaign'),['new-campaign']);
  assert.throws(()=>trackedLink('javascript:alert(1)','a','b'),/HTTPS/);
});
test('Menu planning respects full-week availability, category coverage, ranking and rotation',()=>{
  const rows=[dish('repeat','Mains'),dish('fresh','Mains'),dish('starter','Starters'),dish('dessert','Desserts'),dish('out','Mains',{InStock:false}),dish('short','Mains',{AvailableUntil:'2026-10-02'}),dish('not-approved','Mains',{Approval:''})];
  const history=[{CampaignKey:'last',Status:'completed',PlanJson:JSON.stringify({weekStart:'2026-09-21',dishes:[{key:'repeat'}]})}];
  const p=planRestaurant(cfg,rows,history,now);
  assert.equal(p.weekStart,'2026-09-28');assert.equal(p.weekEnd,'2026-10-04');
  assert.deepEqual(new Set(p.dishes.map(d=>d.category)),new Set(['Mains','Starters','Desserts']));
  assert.ok(p.dishes.some(d=>d.key==='fresh'));assert.ok(!p.dishes.some(d=>d.key==='repeat'));
  assert.equal(p.skipped.length,3);assert.deepEqual(p.posts.map(p=>p.date),['2026-09-28','2026-09-30','2026-10-02']);
  assert.equal(p.posts[0].reviewStatus,'past_date_do_not_publish');
  assert.equal(planRestaurant(cfg,[dish('one','Mains')],[],now).ready,false);
  assert.equal(planRestaurant(cfg,menu().map(d=>({...d,Category:'Mains'})),[],now).ready,false);
});

function runCampaign(original,sourceRows,logs=[],overrides={},responses={}) {
  const w=structuredClone(original),byName=new Map(w.nodes.map(n=>[n.name,n])),history=new Map(),ledger=structuredClone(logs),submissions=[],updates=[];
  const config=w.nodes.find(n=>n.type==='n8n-nodes-base.set');config.parameters.jsonOutput=JSON.stringify({...JSON.parse(config.parameters.jsonOutput),...cfg,...overrides});
  const access=name=>({isExecuted:history.has(name),first:()=>{const a=history.get(name)?.[0];assert.ok(a?.[0],'No output for '+name);return a[0];},all:()=>history.get(name)?.[0]||[]});
  const value=(v,input)=>typeof v==='string'&&v.startsWith('={{')?new Function('$json','$','return ('+v.slice(3,-2)+')')(input,access):v;
  let steps=0;
  class FixedDate extends Date {constructor(...a){super(...(a.length?a:[now]));}static now(){return now.getTime();}}
  function visit(name,items){
    if(++steps>100)throw Error('Graph did not terminate');
    const n=byName.get(name);assert.ok(n,'Unknown node '+name);const input=items[0]?.json||{};let outputs=[items];
    if(n.type==='n8n-nodes-base.set')outputs=[[{json:JSON.parse(n.parameters.jsonOutput)}]];
    else if(n.type==='n8n-nodes-base.code')outputs=[new Function('$json','$input','$','Date','Buffer',n.parameters.jsCode)(input,{all:()=>items,first:()=>items[0]},access,FixedDate,Buffer)];
    else if(n.type==='n8n-nodes-base.if')outputs=value(n.parameters.conditions.conditions[0].leftValue,input)?[items,[]]:[[],items];
    else if(n.type==='n8n-nodes-base.googleSheets'){
      if(!n.parameters.operation||n.parameters.operation==='read'){const rows=n.id==='campaign-v3-ledger'?ledger:sourceRows;outputs=[rows.length?rows.map(json=>({json})):[{json:{}}]];}
      else {const fields=Object.fromEntries(Object.entries(n.parameters.columns.value).map(([k,v])=>[k,value(v,input)]));let row=ledger.find(r=>r.CampaignKey===fields.CampaignKey);if(!row&&n.parameters.operation==='appendOrUpdate'){row={};ledger.push(row);}assert.ok(row,'Missing update target');Object.assign(row,fields);updates.push({node:n.name,fields});outputs=[[{json:fields}]];}
    }else if(n.type==='@zvid/n8n-nodes-zvid.zvid'){
      if(n.parameters.operation==='validate')outputs=[[{json:{valid:true,creditsRequired:responses.quote??12}}]];
      else if(n.parameters.operation==='create'){submissions.push(JSON.parse(value(n.parameters.projectJson,input)));if(responses.uncertain)throw new Error('Simulated uncertain paid submission');outputs=[[{json:{jobId:'created-1'}}]];}
      else outputs=[[{json:responses.error?{error:responses.error}:{id:value(n.parameters.jobId,input),state:responses.state||'completed',result:'https://cdn.example/video.mp4'}}]];
    }
    history.set(name,outputs);for(let i=0;i<outputs.length;i++)if(outputs[i].length)for(const e of w.connections[name]?.main?.[i]||[])visit(e.node,outputs[i]);
  }
  visit(w.nodes.find(n=>n.type===(responses.form?'n8n-nodes-base.formTrigger':'n8n-nodes-base.manualTrigger')).name,[{json:responses.form||{}}]);
  return {ledger,submissions,updates,history};
}
for(const [name,w,rows] of [['hiring',hiring,[role('one'),role('two')]],['restaurant',restaurant,menu()]]) {
  test(name+' exported graph logs one campaign, returns a CSV and deduplicates reruns',()=>{
    const r=runCampaign(w,rows);assert.equal(r.submissions.length,1);assert.equal(r.updates.length,3);assert.equal(r.ledger[0].Status,'completed');
    assert.equal(runCampaign(w,rows,r.ledger).submissions.length,0);
    const csvNode=w.nodes.find(n=>n.id==='campaign-v3-download');const csv=r.history.get(csvNode.name)[0][0];assert.equal(csv.binary.data.mimeType,'text/csv');assert.ok(Buffer.from(csv.binary.data.data,'base64').length>100);
    const saved={...r.ledger[0],Status:'rendering',VideoUrl:'',JobId:'saved-42'};
    const resumed=runCampaign(w,[],[saved]);assert.equal(resumed.submissions.length,0);assert.equal(resumed.updates.length,1);assert.equal(resumed.ledger[0].JobId,'saved-42');
    const preview=runCampaign(w,rows,[],{dryRun:true});assert.equal(preview.submissions.length,0);assert.equal(preview.updates.length,0);
    assert.throws(()=>runCampaign(w,rows,[],{}, {quote:999}),/No paid render/);
    const failed=runCampaign(w,rows,[],{}, {error:'Render failed: source unavailable'});assert.equal(failed.ledger[0].Status,'failed');assert.equal(runCampaign(w,rows,failed.ledger).submissions.length,0);
    const timed=runCampaign(w,rows,[],{}, {error:'Render did not finish within 1200 seconds'});assert.equal(timed.ledger[0].Status,'timed_out');
    const pending={...saved,Status:'submitting',JobId:''};assert.equal(runCampaign(w,rows,[pending]).submissions.length,0);
  });
}
test('Actual form brief overrides the manual brief; published generators are repeatable',()=>{
  const r=runCampaign(hiring,[role('one'),role('two')],[],{}, {form:{CampaignKey:'form-request',Mode:'spotlight',JobKeys:'two'}});
  assert.equal(r.ledger[0].CampaignKey,'form-request');assert.equal(r.submissions[0].scenes[0].id,'role-1');assert.match(JSON.stringify(r.submissions[0]),/Engineer two/);
  for(const [w,kind]of [[hiring,'were-hiring-video'],[restaurant,'restaurant-weekly-specials']])assert.deepEqual(organizeWorkflow(upgradeWorkflow(w,kind)).workflow,w);
});
module.exports={runCampaign,role,dish,menu};
