'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const dir=__dirname;
const imports=JSON.parse(fs.readFileSync(path.join(dir,'imports.json'),'utf8'));
const paidNames=new Set(['Submit render once','Wait for completed render','Video result','Completed video available?','Watch video']);
const fixture=(day,id,name,modify,onlyInput=false)=>{
  const workflow=structuredClone(imports.find(w=>w.id==='ZvidSeries2Day'+day));
  assert.ok(workflow,'Missing configured source workflow');
  workflow.id=id;workflow.name='TEST ONLY · '+name;workflow.active=false;
  workflow.nodes=workflow.nodes.filter(n=>!paidNames.has(n.name)&&n.type!=='n8n-nodes-base.webhook'&&n.type!=='n8n-nodes-base.stickyNote');
  if(onlyInput)workflow.nodes=workflow.nodes.filter(n=>['Test manually','Sample input','Config','Normalize and build video','Work found?','Nothing to render'].includes(n.name));
  modify(workflow);
  const names=new Set(workflow.nodes.map(n=>n.name));
  for(const source of Object.keys(workflow.connections)){
    if(!names.has(source)){delete workflow.connections[source];continue;}
    workflow.connections[source].main=workflow.connections[source].main.map(branch=>branch.filter(edge=>names.has(edge.node)));
  }
  workflow.meta={templateCredsSetupCompleted:true,seriesTwoEdge:{testOnly:true,sourceDay:day,paidNodesRemoved:true}};
  workflow.settings={executionOrder:'v1',executionTimeout:120};
  workflow.pinData={};
  assert.ok(workflow.nodes.every(n=>!(n.type==='@zvid/n8n-nodes-zvid.zvid'&&n.parameters.resource==='render'&&['create','createBulk'].includes(n.parameters.operation))),'Fixture must not contain paid operations');
  return workflow;
};
const config=(workflow,changes)=>{const n=workflow.nodes.find(n=>n.name==='Config');n.parameters.jsonOutput=JSON.stringify({...JSON.parse(n.parameters.jsonOutput),...changes},null,2);};
const sample=(workflow,change)=>{const n=workflow.nodes.find(n=>n.name==='Sample input');const old=new Function(n.parameters.jsCode)()[0].json;n.parameters.jsCode='return [{json:'+JSON.stringify(change(old),null,2)+'}];';};
const fixtures=[
  fixture(31,'Series2EdgeDryRun31','Day31 editor draft and quote',w=>config(w,{dryRun:true})),
  fixture(31,'Series2EdgeCreditCap31','Day31 zero-credit cap rejects quote',w=>config(w,{dryRun:false,maxRenderCredits:0})),
  fixture(47,'Series2EdgeZeroWork47','Day47 no equipment due',w=>sample(w,s=>({...s,equipment:s.equipment.map(item=>({...item,lastServicedAt:s.referenceDate,intervalDays:30}))})),true),
  fixture(31,'Series2EdgeMissingProduct31','Day31 missing required product',w=>sample(w,s=>{delete s.product;return s;}),true),
];
fs.writeFileSync(path.join(dir,'edge-fixtures.json'),JSON.stringify(fixtures,null,2)+'\n');
fs.writeFileSync(path.join(dir,'edge-fixtures-backup.json'),JSON.stringify(fixtures,null,2)+'\n');
console.log(JSON.stringify({fixtures:fixtures.map(w=>({id:w.id,nodes:w.nodes.map(n=>n.name)})),paidNodes:0}));
