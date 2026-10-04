'use strict';
// Run inside Docker. Preserve every attempt. Never dump raw projects or credentials.
const fs=require('node:fs');
const sqlite=require('/usr/local/lib/node_modules/n8n/node_modules/sqlite3');
const {parse}=require('/usr/local/lib/node_modules/n8n/node_modules/flatted');
const {functionalHash,sha256}=require('/tmp/zvid-publication-functional-fingerprint.js');
const reference=JSON.parse(fs.readFileSync('/tmp/zvid-publication-import-reference.json','utf8'));
const after=Number(process.argv[2]||737);
if(!Number.isInteger(after)||after<737)throw new Error('Publication evidence must start after execution737.');
const db=new sqlite.Database('/home/node/.n8n/database.sqlite',sqlite.OPEN_READONLY);
const ids=reference.workflows.map(w=>w.workflowId);
const sql='SELECT e.id,e.workflowId,e.status,e.mode,e.startedAt,e.stoppedAt,d.data,d.workflowData FROM execution_entity e LEFT JOIN execution_data d ON e.id=d.executionId WHERE CAST(e.id AS INTEGER)>? AND e.workflowId IN ('+ids.map(()=>'?').join(',')+') ORDER BY CAST(e.id AS INTEGER) ASC';
function decode(value){if(!value)return {};try{return parse(value)||{};}catch{try{return JSON.parse(value)||{};}catch{return {};}}}
function jsonParse(value){if(typeof value!=='string')return undefined;try{return JSON.parse(value);}catch{return undefined;}}
function first(runs,name){return runs[name]?.at(-1)?.data?.main?.flat()?.find(item=>item?.json)?.json;}
function state(value){if(!value||typeof value!=='object')return null;return {ledgerRowId:value.id??null,requestKey:value.request_key||null,sourceId:value.source_id||null,revision:value.revision||null,requestPeriod:value.request_period||null,status:value.status||null,jobId:value.job_id||value.jobId||null,inputHash:value.input_hash||null,projectSha256:typeof value.project_json==='string'?sha256(value.project_json):null,quotedCredits:value.quoted_credits??value.quotedCredits??null,videoUrl:value.video_url||value.videoUrl||null,driveFileId:value.drive_file_id||value.driveFileId||null,driveUrl:value.drive_url||value.driveUrl||null,lastError:value.last_error||null,updatedAt:value.updated_at||null};}
function binary(item){if(!item?.binary)return [];return Object.entries(item.binary).map(([property,value])=>({property,mimeType:value.mimeType,fileName:value.fileName,fileSize:value.fileSize,id:value.id||null,dataPresent:typeof value.data==='string'&&value.data.length>0}));}
db.all(sql,[after,...ids],(error,rows)=>{
  if(error)throw error;
  const attempts=rows.map(row=>{
    const raw=decode(row.data),result=raw.resultData||raw.data?.resultData||raw||{},runs=result.runData||{};
    let executionWorkflow={};try{executionWorkflow=JSON.parse(row.workflowData||'{}');}catch{}
    const canonical=reference.workflows.find(w=>w.workflowId===row.workflowId);
    const snapshotHash=executionWorkflow.nodes?functionalHash(executionWorkflow):null;
    const nodes=Object.fromEntries(Object.entries(runs).map(([name,entries])=>[name,entries.map((run,index)=>({run:index,status:run.error?'error':run.executionStatus||'success',startedAtMs:run.startTime??null,executionTimeMs:run.executionTime??null,outputItemsByBranch:run.data?.main?.map(branch=>branch?.length||0)||[],totalOutputItems:run.data?.main?.flat()?.length||0,error:run.error?{message:run.error.message}:null}))]));
    const checkpoints=Object.entries(runs).filter(([name])=>name.startsWith('Persist ')).flatMap(([name,entries])=>entries.map((run,index)=>({node:name,run:index,state:state(run.data?.main?.flat()?.[0]?.json),status:run.error?'error':run.executionStatus||'success'})));
    const prepared=first(runs,'Prepare durable request'),selected=first(runs,'Choose one pending revision'),final=first(runs,'Business outcome'),dry=first(runs,'Draft and credit quote')||first(runs,'Saved request inspection'),noWork=first(runs,'No work report');
    const output=final||dry||noWork||null;
    const synthetic=/^qa-d\d+-record-\d+$/.test(String(final?.source_id||prepared?.source_id||selected?.source_id||''));
    const frozen=first(runs,'Persist delivered outcome')||first(runs,'Persist delivery file')||first(runs,'Persist completed media')||first(runs,'Persist accepted job')||first(runs,'Persist submission intent')||first(runs,'Decide recovery')||prepared;
    const brief=jsonParse(frozen?.brief_json)||final?.brief||dry?.brief||jsonParse(prepared?.brief_json),context=jsonParse(frozen?.context_json)||final?.context||jsonParse(prepared?.context_json),project=jsonParse(frozen?.project_json);
    const previewItems=runs['Watch video']?.at(-1)?.data?.main?.flat()||[];
    const preview=previewItems.flatMap(binary).find(value=>value.property==='data')||null;
    const download=runs['Download delivery media']?.at(-1)?.data?.main?.flat()?.flatMap(binary)||[];
    const receipt=first(runs,'Read back delivery receipt');
    return {id:row.id,day:canonical.day,workflowId:row.workflowId,status:row.status,mode:row.mode,startedAt:row.startedAt,stoppedAt:row.stoppedAt,lastNode:result.lastNodeExecuted||null,error:result.error?{message:result.error.message,node:result.error.node?.name||null}:null,canonicalPath:canonical.canonicalPath,canonicalFunctionalHash:canonical.functionalHash,executionFunctionalHash:snapshotHash,functionalMatch:snapshotHash===canonical.functionalHash,nodes,selected:state(selected),prepared:state(prepared),frozen:state(frozen),checkpoints,acceptedSubmission:state(first(runs,'Capture accepted job')),submissionExecuted:!!runs['Submit render once'],uploadExecuted:!!runs['Upload private review video'],finalState:state(first(runs,'Persist delivered outcome')||final),outcome:output?{status:output.status,sourceId:output.source_id||null,revision:output.revision||null,requestKey:output.request_key||null,jobId:output.jobId||null,videoUrl:output.videoUrl||null,driveFileId:output.driveFileId||null,driveUrl:output.driveUrl||null,quotedCredits:output.quotedCredits??null,dryRun:output.dryRun??null,renderSubmitted:output.renderSubmitted??null,reason:output.reason||null,outcome:output.outcome||null,report:output.report||null}:null,receipt:receipt?{sourceId:receipt.source_id,revision:receipt.revision,status:receipt.automation_status,requestKey:receipt.request_key,inputHash:receipt.input_hash,jobId:receipt.job_id,videoUrl:receipt.video_url,driveFileId:receipt.drive_file_id,driveUrl:receipt.drive_url,completedAt:receipt.completed_at,automationError:receipt.automation_error||null}:null,syntheticFixture:synthetic,brief:synthetic?brief||null:null,context:synthetic?context||null:null,expectedMedia:project?{resolution:project.resolution,width:project.width,height:project.height,frameRate:project.frameRate,seconds:(project.scenes||[]).reduce((sum,scene)=>sum+Number(scene.duration||0),0),sceneCount:project.scenes?.length||0,sceneDurations:(project.scenes||[]).map(scene=>Number(scene.duration||0)),projectSha256:sha256(frozen.project_json)}:null,preview,downloadBinary:download};
  });
  for(const attempt of attempts){
    const jobId=attempt.outcome?.jobId||attempt.frozen?.jobId;
    const accepted=jobId?attempts.find(other=>other.workflowId===attempt.workflowId&&other.submissionExecuted&&other.acceptedSubmission?.jobId===jobId&&other.checkpoints.some(checkpoint=>checkpoint.node==='Persist accepted job'&&checkpoint.status==='success'&&checkpoint.state?.jobId===jobId)):null;
    attempt.acceptedExecutionId=accepted?.id||null;
    attempt.acceptedFunctionalHash=accepted?.executionFunctionalHash||null;
    attempt.acceptedProjectSha256=accepted?.acceptedSubmission?.projectSha256||null;
  }
  const days=reference.workflows.map(w=>{const own=attempts.filter(a=>a.workflowId===w.workflowId),passes=own.filter(a=>a.mode==='manual'&&a.status==='success'&&a.outcome?.status==='delivered'&&a.receipt?.status==='delivered'&&a.functionalMatch);return {day:w.day,workflowId:w.workflowId,attemptCount:own.length,manualDeliveredPassIds:passes.map(a=>a.id),latestAttemptId:own.at(-1)?.id||null,latestAttemptStatus:own.at(-1)?.status||null,noWorkAttemptIds:own.filter(a=>a.status==='success'&&a.outcome?.status==='nothing_to_render').map(a=>a.id),errorAttemptIds:own.filter(a=>a.status==='error').map(a=>a.id)};});
  console.log(JSON.stringify({capturedAt:new Date().toISOString(),afterExecutionId:after,manualDeliveredDays:days.filter(d=>d.manualDeliveredPassIds.length).length,totalDays:reference.workflows.length,attempts,days},null,2));db.close();
});
