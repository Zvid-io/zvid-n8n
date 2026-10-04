'use strict';
// Read-only Docker execution evidence. Never read credentials or emit workflow
// configuration, raw projects, private media URLs, or non-synthetic source data.
const fs=require('node:fs');
const sqlite=require('/usr/local/lib/node_modules/n8n/node_modules/sqlite3');
const {parse}=require('/usr/local/lib/node_modules/n8n/node_modules/flatted');
const {functionalHash,sha256}=require('/tmp/zvid-publication-functional-fingerprint.js');
const reference=JSON.parse(fs.readFileSync('/tmp/zvid-publication-import-reference.json','utf8'));
const ids=reference.workflows.map(workflow=>workflow.workflowId);
const db=new sqlite.Database('/home/node/.n8n/database.sqlite',sqlite.OPEN_READONLY);
const after=Number(process.argv[2]||737);
if(!Number.isInteger(after)||after<737)throw new Error('Only upgraded executions after737 may be read.');
const sql='SELECT e.id,e.workflowId,e.mode,e.status,d.data,d.workflowData FROM execution_entity e LEFT JOIN execution_data d ON e.id=d.executionId WHERE CAST(e.id AS INTEGER)>? AND e.workflowId IN ('+ids.map(()=>'?').join(',')+') ORDER BY CAST(e.id AS INTEGER) ASC';
const decode=value=>{if(!value)return {};try{return parse(value)||{};}catch{try{return JSON.parse(value)||{};}catch{return {};}}};
const items=(runs,name)=>runs[name]?.flatMap(run=>run.data?.main?.flat()||[]).filter(item=>item?.json)||[];
function state(row){return {rowId:row.id??null,sourceId:row.source_id||null,revision:row.revision||null,requestKey:row.request_key||null,requestPeriod:row.request_period||'',inputHash:row.input_hash||null,status:row.status||row.automation_status||null,jobId:row.job_id||null,driveFileId:row.drive_file_id||null,deliveryFilename:row.delivery_filename||null,projectSha256:typeof row.project_json==='string'?sha256(row.project_json):null};}
function drive(row){return {fileId:row.id||null,name:row.name||null,mimeType:row.mimeType||null,bytes:Number(row.size)||null,requestHash:row.appProperties?.zvid_request_hash||null};}
db.all(sql,[after,...ids],(error,rows)=>{
  if(error)throw error;
  const executions=rows.map(row=>{
    const result=decode(row.data).resultData||{},runs=result.runData||{};
    let workflow={};try{workflow=JSON.parse(row.workflowData||'{}');}catch{}
    const canonical=reference.workflows.find(item=>item.workflowId===row.workflowId),expectedSource='qa-d'+canonical.day+'-record-001',expectedRevision=canonical.day===50?'r2':'r1';
    const nodes=Object.fromEntries(Object.entries(runs).map(([name,entries])=>[name,{status:entries.some(run=>run.error)?'error':'success',runs:entries.length,totalItems:items(runs,name).length,startedAtMs:entries[0]?.startTime??null,type:workflow.nodes?.find(node=>node.name===name)?.type||null}]));
    const sourceRows=items(runs,'Read source register').map(item=>item.json).filter(record=>record.source_id);
    const synthetic=sourceRows.every(record=>record.source_id===expectedSource);
    const knownNames=['Read saved requests','Look up saved request','Decide recovery','Persist submission intent','Persist accepted job','Persist completed media','Persist delivery file','Persist delivered outcome'];
    const states=synthetic?Object.fromEntries(knownNames.map(name=>[name,items(runs,name).map(item=>item.json).filter(record=>record.request_key&&record.source_id===expectedSource).map(state)])):{};
    const policyName=Object.keys(runs).find(name=>name.startsWith('Apply '));
    const policy=synthetic?items(runs,policyName).filter(item=>item.json.source_id===expectedSource).map(({json})=>({sourceId:json.source_id,revision:json.revision,ready:json.ready===true,decision:json.decision,reason:json.reason||null,savedStatus:json.savedStatus||'',joinedDetailCount:json.context?.joinedDetailCount??null,sourceRecordPresent:json.context?.record?.source_id===expectedSource,detailRevisionJoinValid:Array.isArray(json.context?.details)&&json.context.details.every(detail=>detail.parent_id===expectedSource&&String(detail.revision)===String(json.revision)),inputHash:json.input_hash||null})):[];
    const source=synthetic?sourceRows.map(record=>({sourceId:record.source_id,revision:record.revision,approval:record.approval,status:record.status,automationStatus:record.automation_status||'',requestKey:record.request_key||null,inputHash:record.input_hash||null,jobId:record.job_id||null,driveFileId:record.drive_file_id||null})):[];
    const related=items(runs,'Read related records').map(item=>item.json).filter(record=>record.parent_id);
    const files=synthetic?{searched:items(runs,'Find existing delivery').map(item=>item.json).filter(record=>record.id).map(drive),uploaded:items(runs,'Upload private review video').map(item=>item.json).filter(record=>record.id).map(drive),reconciled:items(runs,'Reconcile delivery file').map(item=>item.json).filter(record=>record.request_key).map(record=>({...state(record),existingDelivery:record.existingDelivery===true})),remembered:items(runs,'Remember delivery').map(item=>item.json).filter(record=>record.request_key).map(state)}:{};
    const config=items(runs,'Config')[0]?.json||{};
    return {executionId:row.id,day:canonical.day,workflowId:row.workflowId,mode:row.mode,status:row.status,syntheticFixture:synthetic,expectedSourceId:expectedSource,expectedRevision,sourceSpreadsheetId:config.spreadsheetId||null,destinationFolderId:config.driveFolderId||null,functionalSha256:workflow.nodes?functionalHash(workflow):null,canonicalFunctionalSha256:canonical.functionalHash,nodes,policyNode:policyName||null,sourceRowCount:sourceRows.length,sourceIdOccurrences:source.filter(record=>record.sourceId===expectedSource).length,source,relatedRowCount:related.length,relatedMatchingSourceRevisionCount:related.filter(record=>record.parent_id===expectedSource&&String(record.revision)===expectedRevision).length,policy,states,files,renderCreateCalls:runs['Submit render once']?.length||0,driveUploadCalls:runs['Upload private review video']?.length||0,sharingNodeExecuted:Object.keys(runs).some(name=>{const node=workflow.nodes?.find(value=>value.name===name);return node?.type==='n8n-nodes-base.googleDrive'&&['share','permission'].includes(node.parameters?.operation);})};
  });
  process.stdout.write(JSON.stringify({capturedAt:new Date().toISOString(),afterExecutionId:after,scope:'Native manual canonical observations; synthetic source identities, counts, accepted checkpoints, file metadata and project hashes only. No credentials, private URLs or raw projects.',executions},null,2)+'\n');db.close();
});
