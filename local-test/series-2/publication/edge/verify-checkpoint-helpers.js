'use strict';
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {adapters,fixtureFor,prepareSource}=require('../../../../scripts/series-two-source-adapters');
const fixtures=JSON.parse(fs.readFileSync(path.join(__dirname,'checkpoint-helpers.json'),'utf8'));
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'checkpoint-helpers-manifest.json'),'utf8'));
function run(workflow,name,input,outputs){const node=workflow.nodes.find(node=>node.name===name);return vm.runInNewContext('(function(){'+node.parameters.jsCode+'\n})()',{Date,$input:{all:()=>input||[],first:()=>input?.[0]},$:key=>({all:()=>outputs[key],first:()=>outputs[key]?.[0]})});}
let guardsChecked=0;
for(const workflow of fixtures){
  const outputs={};
  for(let day=31;day<=60;day++){
    const fixture=fixtureFor(day,manifest.dailyRequestPeriod+'T12:00:00.000Z'),revision=manifest.syntheticRevisionByDay?.[day]||'r1';fixture.primary.revision=revision;for(const row of fixture.details)row.revision=revision;const prepared=prepareSource(day,fixture.primary,fixture.details,manifest.dailyRequestPeriod+'T12:00:00.000Z');
    assert.equal(prepared.decision,'ready');
    const inputHash='a'.repeat(64),sourceId=fixture.primary.source_id,requestPeriod=adapters[day].refreshPeriod==='day'?manifest.dailyRequestPeriod:'';
    const row={source_id:sourceId,revision,workflow_slug:adapters[day].slug,request_period:requestPeriod,request_key:[adapters[day].slug,sourceId,revision,...(requestPeriod?[requestPeriod]:[]),manifest.privateQaFolderId].join('|'),status:'delivered',input_hash:inputHash,job_id:'completed-synthetic-job-'+day,video_url:'https://media.example.com/d'+day+'.mp4',drive_file_id:'native-drive-'+day,drive_url:'https://drive.google.com/file/d/native-drive-'+day+'/view?usp=drivesdk',delivery_filename:'D'+day+'-'+sourceId+'-'+inputHash.slice(0,24)+'.mp4',input_json:JSON.stringify(prepared.input),context_json:JSON.stringify(prepared.context),project_json:JSON.stringify({scenes:[{},{},{}]}),brief_json:JSON.stringify({title:'Synthetic D'+day}),quoted_credits:18,execution_id:'original-qa-'+day,updated_at:'2026-10-01T12:00:00.000Z',last_error:''};
    outputs['Read D'+day+' synthetic ledger']=[{json:row}];
  }
  const tables=Array.from({length:30},(_,index)=>({json:{name:'Zvid D'+(index+31)+' business delivery ledger',id:'table-'+(index+31)}}));
  assert.equal(Object.keys(run(workflow,'Select 30 exact QA tables',tables,{})[0].json.tables).length,30);
  assert.throws(()=>run(workflow,'Select 30 exact QA tables',tables.slice(1),{}),/exactly one/);guardsChecked++;
  assert.throws(()=>run(workflow,'Select 30 exact QA tables',[...tables,tables[0]],{}),/exactly one/);guardsChecked++;
  const guarded=run(workflow,'Verify all 30 delivered frozen requests',[],outputs)[0];
  assert.equal(Object.keys(guarded.json.rows).length,30);
  const readD50=workflow.nodes.find(node=>node.name==='Read D50 synthetic ledger');
  assert.ok(readD50.parameters.filters.conditions.some(condition=>condition.keyName==='revision'&&condition.keyValue==='r2'));
  assert.ok(readD50.parameters.filters.conditions.some(condition=>condition.keyName==='request_key'&&condition.keyValue.includes('|r2|')));
  for(const field of ['status','source_id','request_key','job_id','video_url','drive_file_id','input_hash','context_json']){
    const changed=structuredClone(outputs);changed['Read D60 synthetic ledger'][0].json[field]=field==='status'?'accepted':field==='context_json'?'{}':'';
    assert.throws(()=>run(workflow,'Verify all 30 delivered frozen requests',[],changed));guardsChecked++;
  }
  const ambiguous=structuredClone(outputs);ambiguous['Read D60 synthetic ledger'].push(ambiguous['Read D60 synthetic ledger'][0]);assert.throws(()=>run(workflow,'Verify all 30 delivered frozen requests',[],ambiguous),/exactly one/);guardsChecked++;
  const missing=structuredClone(outputs);missing['Read D60 synthetic ledger']=[{json:{}}];assert.throws(()=>run(workflow,'Verify all 30 delivered frozen requests',[],missing),/exactly one/);guardsChecked++;
  const target=workflow.meta.localCheckpointHelper.targetStatus;
  const allOutputs={...outputs,'Verify all 30 delivered frozen requests':[guarded]};
  for(let day=31;day<=60;day++){
    const prepareName='Prepare D'+day+' '+target,writeName='Set D'+day+' '+target;
    const row=run(workflow,prepareName,[],allOutputs)[0];allOutputs[prepareName]=[row];
    assert.equal(row.json.status,target);
    for(const key of ['job_id','input_hash','input_json','project_json','brief_json','context_json','quoted_credits','execution_id'])assert.equal(row.json[key],outputs['Read D'+day+' synthetic ledger'][0].json[key]);
    if(target==='accepted')for(const key of ['video_url','drive_file_id','drive_url'])assert.equal(row.json[key],'');else for(const key of ['video_url','drive_file_id','drive_url'])assert.equal(row.json[key],outputs['Read D'+day+' synthetic ledger'][0].json[key]);
    const write=workflow.nodes.find(node=>node.name===writeName);assert.equal(write.parameters.operation,'update');assert.equal(write.parameters.filters.conditions.length,5);assert.deepEqual(Object.keys(write.parameters.columns.value).sort(),(target==='accepted'?['status','video_url','drive_file_id','drive_url']:['status']).sort());
    const verified=run(workflow,'Verify D'+day+' checkpoint',[row],allOutputs)[0];assert.equal(verified.json.frozenContentRetained,true);
    assert.throws(()=>run(workflow,'Verify D'+day+' checkpoint',[{json:{...row.json,job_id:'changed'}}],allOutputs),/changed job_id/);guardsChecked++;
  }
  assert.ok(workflow.nodes.every(node=>['n8n-nodes-base.manualTrigger','n8n-nodes-base.dataTable','n8n-nodes-base.code','n8n-nodes-base.stickyNote'].includes(node.type)));
  assert.ok(workflow.nodes.every(node=>!node.credentials));assert.equal(workflow.active,false);
  const chain=[];let node='Test manually';while(node){chain.push(node);node=workflow.connections[node]?.main?.[0]?.[0]?.node;}
  const preflightIndex=chain.indexOf('Verify all 30 delivered frozen requests');
  assert.equal(chain.slice(0,preflightIndex).filter(name=>name.startsWith('Read D')).length,30);
  assert.equal(chain.slice(0,preflightIndex).filter(name=>name.startsWith('Set D')).length,0);
  assert.equal(chain.filter(name=>name.startsWith('Set D')).length,30);
}
process.stdout.write(JSON.stringify({status:'checkpoint_helpers_verified',fixtures:fixtures.length,exportedGuardChecks:guardsChecked,allThirtyReadBeforeWrite:true,frozenContentRetained:true,noCloudOrPaidNodes:true,noWritesPerformed:true})+'\n');
