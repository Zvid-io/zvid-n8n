'use strict';
// Inactive manual QA helpers. No execution, credentials, Google services or
// render nodes. All thirty existing synthetic rows must pass before any write.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {adapters}=require('../../../../scripts/series-two-source-adapters');
const {ledgerColumns}=require('../../../../scripts/series-two-publication-framework');
const imports=JSON.parse(fs.readFileSync(path.join(__dirname,'../infra-configured-imports.json'),'utf8'));
const period=new Date().toISOString().slice(0,10);
const expected=Array.from({length:30},(_,index)=>{
  const day=index+31,workflow=imports.find(item=>item.id==='ZvidSeries2Day'+day);
  if(!workflow)throw new Error('Missing configured QA workflow D'+day);
  const config=JSON.parse(workflow.nodes.find(node=>node.name==='Config').parameters.jsonOutput);
  const sourceId='qa-d'+day+'-record-001';
  const revision=day===50?'r2':'r1';
  const requestPeriod=adapters[day].refreshPeriod==='day'?period:'';
  return {day,tableName:'Zvid D'+day+' business delivery ledger',workflowSlug:adapters[day].slug,sourceId,revision,requestPeriod,driveFolderId:config.driveFolderId,requestKey:[adapters[day].slug,sourceId,revision,...(requestPeriod?[requestPeriod]:[]),config.driveFolderId].join('|')};
});
assert.equal(new Set(expected.map(item=>item.driveFolderId)).size,1);
assert.ok(expected[0].driveFolderId);
const rl=value=>({__rl:true,mode:'id',value});
const schema=fields=>fields.map(id=>({id,displayName:id,required:false,defaultMatch:false,display:true,type:id==='quoted_credits'?'number':'string',canBeUsedToMatch:true}));
const fixtures=['accepted','uploaded'].map(build);
fs.writeFileSync(path.join(__dirname,'checkpoint-helpers.json'),JSON.stringify(fixtures,null,2)+'\n');
fs.writeFileSync(path.join(__dirname,'checkpoint-helpers-manifest.json'),JSON.stringify({generatedAt:new Date().toISOString(),syntheticRevisionByDay:Object.fromEntries(expected.map(item=>[item.day,item.revision])),dailyRequestPeriod:period,privateQaFolderId:expected[0].driveFolderId,nativeOnly:true,allThirtyPreflightBeforeAnyWrite:true,requiresDeliveredRows:true,manualOnly:true,fixtures:fixtures.map(workflow=>({workflowId:workflow.id,name:workflow.name,url:'http://localhost:5678/workflow/'+workflow.id,targetStatus:workflow.meta.localCheckpointHelper.targetStatus,sequence:workflow.meta.localCheckpointHelper.sequence}))},null,2)+'\n');
process.stdout.write(JSON.stringify({ready:fixtures.length,workflowIds:fixtures.map(workflow=>workflow.id),functionalNodesPerFixture:fixtures[0].nodes.filter(node=>node.type!=='n8n-nodes-base.stickyNote').length,allThirtyPreflightBeforeAnyWrite:true,noExecutionPerformed:true})+'\n');

function build(targetStatus){
  const label=targetStatus==='accepted'?'Accepted':'Uploaded';
  const sequence=targetStatus==='accepted'?'After all 30 canonical synthetic full deliveries, run this helper once. Then manually run each canonical workflow; each must poll its existing job and reuse its private Drive asset without Submit or Upload.':'After all 30 accepted-resume runs return delivered, run this helper once. Then manually run each canonical workflow; each must recover its existing uploaded asset and verify source writeback without Submit, Get or Upload.';
  const workflow={id:'ZvidSeries2PubCheckpoint'+label,name:'QA checkpoint all 30 synthetic ledgers as '+targetStatus,nodes:[],connections:{},active:false,pinData:{},settings:{executionOrder:'v1',timezone:'UTC',executionTimeout:1500},meta:{localCheckpointHelper:{targetStatus,sequence,paidSubmissionsForbidden:true,googleOperationsAbsent:true}}};
  const add=(name,type,parameters={},extra={})=>{const index=workflow.nodes.length,node={id:workflow.id+'-'+(index+1),name,type:'n8n-nodes-base.'+type,typeVersion:{manualTrigger:1,dataTable:1.1,code:2,stickyNote:1}[type],position:[(index%6)*270,170+Math.floor(index/6)*240],parameters,...extra};workflow.nodes.push(node);return node;};
  const code=(name,jsCode)=>add(name,'code',{mode:'runOnceForAllItems',jsCode});
  const wire=(from,to)=>{workflow.connections[from]={main:[[{node:to,type:'main',index:0}]]};};
  const chain=(...names)=>names.slice(1).forEach((to,index)=>wire(names[index],to));
  add('Test manually','manualTrigger');
  add('List existing Data Tables','dataTable',{resource:'table',operation:'list',returnAll:true,options:{sortField:'name',sortDirection:'asc'}},{alwaysOutputData:true});
  code('Select 30 exact QA tables',`const expected=${JSON.stringify(expected)};const all=$input.all().map(item=>item.json);const tables={};for(const item of expected){const found=all.filter(table=>table.name===item.tableName);if(found.length!==1||!found[0].id)throw new Error('Expected exactly one existing table '+item.tableName+'; no ledger rows have been changed.');tables[item.day]=found[0].id;}return [{json:{tables}}];`);
  chain('Test manually','List existing Data Tables','Select 30 exact QA tables');
  let previous='Select 30 exact QA tables';
  for(const item of expected){
    const name='Read D'+item.day+' synthetic ledger';
    add(name,'dataTable',{resource:'row',operation:'get',dataTableId:rl('={{ $("Select 30 exact QA tables").first().json.tables["'+item.day+'"] }}'),matchType:'allConditions',filters:{conditions:[{keyName:'source_id',condition:'eq',keyValue:item.sourceId},...(item.day===50?[{keyName:'revision',condition:'eq',keyValue:item.revision},{keyName:'request_key',condition:'eq',keyValue:item.requestKey}]:[])]},returnAll:true},{executeOnce:true,alwaysOutputData:true});
    wire(previous,name);previous=name;
  }
  code('Verify all 30 delivered frozen requests',`const expected=${JSON.stringify(expected)};const columns=${JSON.stringify(ledgerColumns)};const rows={};for(const item of expected){const found=$('Read D'+item.day+' synthetic ledger').all().map(value=>value.json).filter(row=>row.request_key);if(found.length!==1)throw new Error('D'+item.day+' requires exactly one synthetic source row; no checkpoints changed.');const row=found[0];if(row.source_id!==item.sourceId||row.workflow_slug!==item.workflowSlug||row.revision!==item.revision||row.request_key!==item.requestKey||(row.request_period||'')!==item.requestPeriod||row.status!=='delivered')throw new Error('D'+item.day+' must have its exact delivered QA request before checkpointing.');for(const field of ['job_id','video_url','drive_file_id','drive_url','delivery_filename','input_json','project_json','brief_json','context_json'])if(typeof row[field]!=='string'||!row[field])throw new Error('D'+item.day+' is missing delivered '+field);const driveBase='https://drive.google.com/file/d/'+row.drive_file_id+'/view';if(!/^[a-f0-9]{64}$/.test(row.input_hash)||!/^https:\\/\\//.test(row.video_url)||!(row.drive_url===driveBase||row.drive_url.startsWith(driveBase+'?'))||row.delivery_filename!=='D'+item.day+'-'+item.sourceId+'-'+row.input_hash.slice(0,24)+'.mp4')throw new Error('D'+item.day+' has invalid saved hash or delivery identity.');const context=JSON.parse(row.context_json),input=JSON.parse(row.input_json),project=JSON.parse(row.project_json),brief=JSON.parse(row.brief_json);if(context.sourceId!==item.sourceId||context.revision!==item.revision||!context.record||context.record.source_id!==item.sourceId||!Array.isArray(context.details)||!input||!Array.isArray(project.scenes)||project.scenes.length<3||!brief.title)throw new Error('D'+item.day+' frozen context does not identify the completed QA request.');rows[item.day]=Object.fromEntries(columns.map(key=>[key,row[key]??(key==='quoted_credits'?0:'')]));}return [{json:{allThirtyDelivered:true,targetStatus:${JSON.stringify(targetStatus)},rows}}];`);
  wire(previous,'Verify all 30 delivered frozen requests');previous='Verify all 30 delivered frozen requests';
  for(const item of expected){
    const prepare='Prepare D'+item.day+' '+targetStatus,update='Set D'+item.day+' '+targetStatus,verify='Verify D'+item.day+' checkpoint';
    code(prepare,`const guarded=$("Verify all 30 delivered frozen requests").first().json;if(guarded.allThirtyDelivered!==true)throw new Error('The all-thirty preflight is required');const row=guarded.rows[${item.day}];return [{json:{...row,status:${JSON.stringify(targetStatus)}${targetStatus==='accepted'?',video_url:"",drive_file_id:"",drive_url:""':''}}}];`);
    const changedFields=targetStatus==='accepted'?['status','video_url','drive_file_id','drive_url']:['status'];
    add(update,'dataTable',{resource:'row',operation:'update',dataTableId:rl('={{ $("Select 30 exact QA tables").first().json.tables["'+item.day+'"] }}'),matchType:'allConditions',filters:{conditions:[{keyName:'request_key',condition:'eq',keyValue:item.requestKey},{keyName:'source_id',condition:'eq',keyValue:item.sourceId},{keyName:'status',condition:'eq',keyValue:'delivered'},{keyName:'input_hash',condition:'eq',keyValue:'={{ $json.input_hash }}'},{keyName:'job_id',condition:'eq',keyValue:'={{ $json.job_id }}'}]},columns:{mappingMode:'defineBelow',value:Object.fromEntries(changedFields.map(field=>[field,'={{ $json.'+field+' }}'])),schema:schema(changedFields)},options:{dryRun:false}},{alwaysOutputData:true});
    code(verify,`const found=$input.all().map(item=>item.json).filter(row=>row.request_key);if(found.length!==1)throw new Error('D${item.day} was not updated exactly once; stop and reconcile the partial helper run.');const actual=found[0],wanted=$(${JSON.stringify(prepare)}).first().json;for(const key of ${JSON.stringify(ledgerColumns.filter(column=>column!=='updated_at'))})if(JSON.stringify(actual[key]??(key==='quoted_credits'?0:''))!==JSON.stringify(wanted[key]??(key==='quoted_credits'?0:'')))throw new Error('D${item.day} checkpoint changed '+key+' unexpectedly');return [{json:{day:${item.day},status:actual.status,requestKey:actual.request_key,jobId:actual.job_id,inputHash:actual.input_hash,videoUrlRetained:!!actual.video_url,driveIdRetained:!!actual.drive_file_id,frozenContentRetained:true}}];`);
    chain(previous,prepare,update,verify);previous=verify;
  }
  code('Checkpoint helper outcome',`const expected=${JSON.stringify(expected)};const receipts=expected.map(item=>$('Verify D'+item.day+' checkpoint').first().json);if(receipts.length!==30||receipts.some(receipt=>receipt.status!==${JSON.stringify(targetStatus)}||!receipt.frozenContentRetained))throw new Error('Incomplete checkpoint helper run');return [{json:{status:'all_thirty_synthetic_checkpoints_ready',targetStatus:${JSON.stringify(targetStatus)},count:30,noPaidOrExternalNodesPresent:true,receipts}}];`);wire(previous,'Checkpoint helper outcome');
  add('Local QA checkpoint instructions','stickyNote',{color:1,width:750,height:420,content:'## Manual local QA: '+targetStatus+' recovery\n\n'+sequence+'\n\nThis helper lists and reads native Data Tables before changing anything. It restricts requests to qa-dXX-record-001 in the private QA folder: D50 revision r2, all other days r1. D50 reads only the exact r2 request, preserving the old r1 ledger. It rejects missing, ambiguous or non-delivered rows. It retains job IDs, hashes, frozen project/input/brief/context and credit quotes. The accepted helper clears only delivery URL/file references; the uploaded helper changes only status.\n\nRun once with no canonical execution in progress. All thirty preflight checks precede the first update, but updates are not one transaction. Reconcile a partial failure instead of blindly repeating. This inactive fixture has no render, Sheets or Drive nodes.'}).position=[-850,0];
  const names=new Set(workflow.nodes.map(node=>node.name));assert.equal(names.size,workflow.nodes.length);
  for(const node of workflow.nodes){assert.ok(['n8n-nodes-base.manualTrigger','n8n-nodes-base.dataTable','n8n-nodes-base.code','n8n-nodes-base.stickyNote'].includes(node.type));assert.ok(!node.credentials);if(node.type==='n8n-nodes-base.code')new Function(node.parameters.jsCode);}
  for(const [name,connection] of Object.entries(workflow.connections)){assert.ok(names.has(name));for(const branch of connection.main)for(const edge of branch)assert.ok(names.has(edge.node));}
  return workflow;
}
