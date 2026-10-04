'use strict';
// Inspect only safe response/diagnostic quota fields. Never emit headers from
// requests, authorization, credential data, node parameters or entire errors.
const sqlite=require('/usr/local/lib/node_modules/n8n/node_modules/sqlite3');
const {parse}=require('/usr/local/lib/node_modules/n8n/node_modules/flatted');
const id=Number(process.argv[2]||794);
if(!Number.isInteger(id)||id<=737)throw new Error('Unexpected publication execution.');
const db=new sqlite.Database('/home/node/.n8n/database.sqlite',sqlite.OPEN_READONLY);
db.get('SELECT e.id,e.workflowId,e.status,e.mode,e.startedAt,e.stoppedAt,d.data FROM execution_entity e JOIN execution_data d ON e.id=d.executionId WHERE e.id=?',[id],(error,row)=>{
  if(error)throw error;
  if(!row||!/^ZvidSeries2Day(?:3[1-9]|[45][0-9]|60)$/.test(row.workflowId))throw new Error('Unexpected workflow identity.');
  const raw=parse(row.data),result=raw.resultData||{},run=result.runData?.['Submit render once']?.at(-1),failure=run?.error||result.error||{};
  const findings=[];
  const safeKeys=new Set(['httpCode','statusCode','status','code','retry-after','x-ratelimit-reset','x-rate-limit-reset','x-ratelimit-remaining','x-ratelimit-limit','nextReset','retryAfter','resetAt','reset','current','limit']);
  function visit(value,path,depth=0){
    if(depth>7||!value||typeof value!=='object')return;
    for(const [key,item] of Object.entries(value)){
      if(/request|authorization|cookie|credential|node|parameter|stack|token/i.test(key))continue;
      if(safeKeys.has(key)||safeKeys.has(key.toLowerCase())){
        if(item===null||['string','number','boolean'].includes(typeof item))findings.push({path:path+'.'+key,value:item});
      }
      if(['error','reason'].includes(key)&&typeof item==='string'&&/^[A-Za-z0-9_.-]{1,80}$/.test(item))findings.push({path:path+'.'+key,value:item});
      if(item&&typeof item==='object')visit(item,path+'.'+key,depth+1);
      if(typeof item==='string'&&(['description','message','response','body','data'].includes(key)||/^\d+$/.test(key))){
        const first=item.indexOf('{'),last=item.lastIndexOf('}');
        if(first!==-1&&last>=first){
          const fragment=item.slice(first,last+1);
          for(const candidate of [fragment,fragment.replace(/\\"/g,'"')]){try{visit(JSON.parse(candidate),path+'.'+key+'.parsed',depth+1);break;}catch{}}
        }
      }
    }
  }
  visit(failure,'error');
  const runNames=Object.keys(result.runData||{});
  const intent=result.runData?.['Persist submission intent']?.at(-1)?.data?.main?.flat()?.[0]?.json;
  const table=result.runData?.['Ensure publication ledger']?.at(-1)?.data?.main?.flat()?.[0]?.json;
  let frozenIntent=null;
  if(intent?.source_id==='qa-d51-record-001'&&intent?.revision==='r1'){
    const hash=value=>require('node:crypto').createHash('sha256').update(value).digest('hex');
    const project=JSON.parse(intent.project_json);
    frozenIntent={ledgerTableId:table?.id,ledgerRowId:intent.id,requestKey:intent.request_key,sourceId:intent.source_id,revision:intent.revision,status:intent.status,jobId:intent.job_id||null,inputHash:intent.input_hash,projectSha256:hash(intent.project_json),inputJsonSha256:hash(intent.input_json),briefJsonSha256:hash(intent.brief_json),contextJsonSha256:hash(intent.context_json),attemptedProjectName:project.name,quotedCredits:intent.quoted_credits,updatedAt:intent.updated_at};
  }
  const diagnosticShapes=Object.fromEntries(['description','messages','context','contextData'].map(key=>{const value=key==='contextData'?failure.context?.data:failure[key];return [key,{type:typeof value,length:typeof value==='string'?value.length:null,keys:value&&typeof value==='object'?Object.keys(value):null,containsNextReset:typeof value==='string'?value.includes('nextReset'):null,containsRetryAfter:typeof value==='string'?value.includes('retryAfter'):null}];}));
  console.log(JSON.stringify({capturedAt:new Date().toISOString(),executionId:row.id,workflowId:row.workflowId,status:row.status,mode:row.mode,startedAt:row.startedAt,stoppedAt:row.stoppedAt,lastNode:result.lastNodeExecuted,failedNode:'Submit render once',errorShape:Object.keys(failure),diagnosticShapes,quotaFields:findings,frozenIntent,acceptedCaptureExecuted:runNames.includes('Capture accepted job'),acceptedCheckpointExecuted:runNames.includes('Persist accepted job')},null,2));
  db.close();
});
