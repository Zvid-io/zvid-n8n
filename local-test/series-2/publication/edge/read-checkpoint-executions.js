'use strict';
// Read-only native checkpoint evidence. Emits synthetic identity and hashes,
// not frozen source content, video URLs, or credential data.
const sqlite=require('/usr/local/lib/node_modules/n8n/node_modules/sqlite3');
const crypto=require('node:crypto');
const {parse}=require('/usr/local/lib/node_modules/n8n/node_modules/flatted');
const fs=require('node:fs');
const {functionalHash}=require('/tmp/zvid-publication-functional-fingerprint.js');
const reference=JSON.parse(fs.readFileSync('/tmp/zvid-publication-checkpoint-audit-reference.json','utf8'));
const db=new sqlite.Database('/home/node/.n8n/database.sqlite',sqlite.OPEN_READONLY);
const ids=reference.helpers.map(row=>row.workflowId);
const json=value=>{try{return parse(value);}catch{return JSON.parse(value||'{}');}};
const items=(runs,name)=>(runs[name]||[]).flatMap(run=>run.data?.main?.flat()||[]).filter(item=>item?.json).map(item=>item.json);
const retained=['workflow_slug','source_id','revision','request_key','request_period','input_hash','job_id','delivery_filename','input_json','project_json','brief_json','context_json','quoted_credits','execution_id','last_error'];
const frozenHash=row=>crypto.createHash('sha256').update(JSON.stringify(Object.fromEntries(retained.map(key=>[key,row[key]??(key==='quoted_credits'?0:'')])))).digest('hex');
db.all('SELECT e.id,e.workflowId,e.mode,e.status,d.data,d.workflowData FROM execution_entity e JOIN execution_data d ON e.id=d.executionId WHERE e.workflowId IN ('+ids.map(()=>'?').join(',')+') ORDER BY CAST(e.id AS INTEGER)',ids,(error,rows)=>{
  if(error)throw error;
  const executions=rows.map(row=>{
    const helper=reference.helpers.find(item=>item.workflowId===row.workflowId),workflow=JSON.parse(row.workflowData),runs=json(row.data).resultData?.runData||{};
    const preflight=items(runs,'Verify all 30 delivered frozen requests')[0];
    const outcome=items(runs,'Checkpoint helper outcome')[0];
    const checkpoints=Array.from({length:30},(_,index)=>{
      const day=index+31,before=preflight?.rows?.[day],after=items(runs,'Set D'+day+' '+helper.targetStatus),read=items(runs,'Read D'+day+' synthetic ledger'),receipt=items(runs,'Verify D'+day+' checkpoint')[0];
      const actual=after[0],expectedRevision=day===50?'r2':'r1';
      const retainedHashBefore=before?frozenHash(before):null,retainedHashAfter=actual?frozenHash(actual):null;
      const changedFields=helper.targetStatus==='accepted'?['status','video_url','drive_file_id','drive_url']:['status'];
      const expectedDelivery=helper.targetStatus==='accepted'?actual&&actual.video_url===''&&actual.drive_file_id===''&&actual.drive_url==='':actual&&actual.video_url===before?.video_url&&actual.drive_file_id===before?.drive_file_id&&actual.drive_url===before?.drive_url;
      const passed=read.length===1&&after.length===1&&before?.source_id==='qa-d'+day+'-record-001'&&before.revision===expectedRevision&&before.status==='delivered'&&actual?.status===helper.targetStatus&&actual.revision===expectedRevision&&retainedHashBefore===retainedHashAfter&&expectedDelivery&&receipt?.frozenContentRetained===true;
      return {day,sourceId:before?.source_id||null,revision:before?.revision||null,requestKey:before?.request_key||null,jobId:before?.job_id||null,inputHash:before?.input_hash||null,sourceReadRuns:runs['Read D'+day+' synthetic ledger']?.length||0,writeRuns:runs['Set D'+day+' '+helper.targetStatus]?.length||0,readItems:read.length,writeItems:after.length,retainedHashBefore,retainedHashAfter,changedFields,statusBefore:before?.status||null,statusAfter:actual?.status||null,videoUrlRetained:!!actual?.video_url,driveIdRetained:!!actual?.drive_file_id,frozenContentRetained:retainedHashBefore!==null&&retainedHashBefore===retainedHashAfter,passed};
    });
    const nodes=Object.fromEntries(Object.entries(runs).map(([name,entries])=>[name,{runs:entries.length,status:entries.some(run=>run.error)?'error':'success',items:items(runs,name).length}]));
    const allReadsBeforePreflight=preflight&&checkpoints.every(item=>Number(runs['Read D'+item.day+' synthetic ledger']?.[0]?.startTime)<=Number(runs['Verify all 30 delivered frozen requests']?.[0]?.startTime));
    const firstWriteAfterPreflight=preflight&&checkpoints.every(item=>Number(runs['Set D'+item.day+' '+helper.targetStatus]?.[0]?.startTime)>=Number(runs['Verify all 30 delivered frozen requests']?.[0]?.startTime));
    const currentFunctionalSha256=functionalHash(workflow),functionalMatch=currentFunctionalSha256===helper.functionalSha256;
    return {executionId:Number(row.id),workflowId:row.workflowId,mode:row.mode,status:row.status,targetStatus:helper.targetStatus,currentFunctionalSha256,functionalMatch,allReadsBeforePreflight:!!allReadsBeforePreflight,firstWriteAfterPreflight:!!firstWriteAfterPreflight,outcome:outcome?{status:outcome.status,targetStatus:outcome.targetStatus,count:outcome.count,noPaidOrExternalNodesPresent:outcome.noPaidOrExternalNodesPresent}:null,nodes,checkpoints,passed:row.mode==='manual'&&row.status==='success'&&functionalMatch&&allReadsBeforePreflight===true&&firstWriteAfterPreflight===true&&checkpoints.every(item=>item.passed)&&outcome?.status==='all_thirty_synthetic_checkpoints_ready'&&outcome.targetStatus===helper.targetStatus&&outcome.count===30};
  });
  process.stdout.write(JSON.stringify({capturedAt:new Date().toISOString(),readOnly:true,rootConfirmed:false,executions},null,2)+'\n');db.close();
});
