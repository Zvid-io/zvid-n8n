'use strict';
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const {buildWorkflow}=require('../../scripts/series-two-framework');
const specs=require('../../scripts/series-two-specs');
const read=name=>JSON.parse(fs.readFileSync(path.join(__dirname,name),'utf8').replace(/^\uFEFF/,''));
const previous=[read('edge-fixtures.json').find(w=>w.id==='Series2EdgeDryRun31'),read('edge-webhook-fixture.json').find(w=>w.id==='Series2EdgeWebhook31')];
const code=buildWorkflow(specs.find(s=>s.day===31)).workflow.nodes.find(n=>n.name==='Draft and credit quote').parameters.jsCode;
const updated=structuredClone(previous);
for(let i=0;i<updated.length;i++){
  const workflow=updated[i];assert.ok(workflow);assert.equal(workflow.active,false);
  assert.ok(!workflow.nodes.some(n=>n.type==='@zvid/n8n-nodes-zvid.zvid'&&n.parameters.resource==='render'&&['create','createBulk'].includes(n.parameters.operation)));
  const node=workflow.nodes.find(n=>n.name==='Draft and credit quote');assert.ok(node);node.parameters.jsCode=code;
  const compare=structuredClone(workflow);compare.nodes.find(n=>n.name===node.name).parameters.jsCode=previous[i].nodes.find(n=>n.name===node.name).parameters.jsCode;
  assert.deepEqual(compare,previous[i],'Only final dry output Code may change');
}
fs.writeFileSync(path.join(__dirname,'edge-dry-output-update-backup.json'),JSON.stringify(previous,null,2)+'\n');
fs.writeFileSync(path.join(__dirname,'edge-dry-output-updates.json'),JSON.stringify(updated,null,2)+'\n');
console.log(JSON.stringify({updated:updated.map(w=>w.id),changedParameter:'Draft and credit quote.parameters.jsCode',inactive:true,paidNodes:0}));
