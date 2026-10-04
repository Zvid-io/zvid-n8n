'use strict';
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const imports=JSON.parse(fs.readFileSync(path.join(__dirname,'imports.json'),'utf8'));
const workflow=structuredClone(imports.find(w=>w.id==='ZvidSeries2Day31'));
workflow.id='Series2EdgeWebhook31';workflow.name='TEST ONLY · Day31 webhook draft and 202 acknowledgement';workflow.active=false;
const paidNames=new Set(['Submit render once','Wait for completed render','Video result','Completed video available?','Watch video']);
workflow.nodes=workflow.nodes.filter(node=>!paidNames.has(node.name)&&node.type!=='n8n-nodes-base.stickyNote');
const webhook=workflow.nodes.find(node=>node.name==='Receive event');
assert.ok(webhook&&webhook.typeVersion===2);
webhook.parameters.path='series-two-webhook-smoke';
webhook.webhookId='series-two-edge-webhook-31-smoke';
webhook.parameters.responseMode='onReceived';
webhook.parameters.options={responseCode:{values:{responseCode:'customCode',customCode:202}},responseData:'{"accepted":true,"message":"Inspect the workflow execution for its result."}',responseHeaders:{entries:[{name:'Content-Type',value:'application/json'}]}};
const config=workflow.nodes.find(node=>node.name==='Config');
config.parameters.jsonOutput=JSON.stringify({...JSON.parse(config.parameters.jsonOutput),dryRun:true},null,2);
assert.equal(config.parameters.includeOtherFields,true);
const sampleNode=workflow.nodes.find(node=>node.name==='Sample input');
const sample=new Function(sampleNode.parameters.jsCode)()[0].json;
const names=new Set(workflow.nodes.map(node=>node.name));
for(const source of Object.keys(workflow.connections)){
  if(!names.has(source)){delete workflow.connections[source];continue;}
  workflow.connections[source].main=workflow.connections[source].main.map(branch=>branch.filter(edge=>names.has(edge.node)));
}
workflow.meta={templateCredsSetupCompleted:true,seriesTwoEdge:{testOnly:true,sourceDay:31,paidNodesRemoved:true,webhookDryRun:true}};
workflow.settings={executionOrder:'v1',executionTimeout:120};workflow.pinData={};
assert.ok(workflow.nodes.every(node=>!(node.type==='@zvid/n8n-nodes-zvid.zvid'&&node.parameters.resource==='render'&&['create','createBulk'].includes(node.parameters.operation))));
fs.writeFileSync(path.join(__dirname,'edge-webhook-fixture.json'),JSON.stringify([workflow],null,2)+'\n');
fs.writeFileSync(path.join(__dirname,'webhook-sample.json'),JSON.stringify(sample,null,2)+'\n');
console.log(JSON.stringify({id:workflow.id,inactive:true,dryRun:true,paidNodes:0,testWebhook:'http://localhost:5678/webhook-test/series-two-webhook-smoke',sample:'local-test/series-2/webhook-sample.json'}));
