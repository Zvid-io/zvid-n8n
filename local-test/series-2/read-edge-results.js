'use strict';
const sqlite3=require('/usr/local/lib/node_modules/n8n/node_modules/sqlite3');
const {parse}=require('/usr/local/lib/node_modules/n8n/node_modules/flatted');
const db=new sqlite3.Database('/home/node/.n8n/database.sqlite',sqlite3.OPEN_READONLY);
db.all("SELECT e.id,e.workflowId,e.status,e.mode,e.startedAt,e.stoppedAt,d.data FROM execution_entity e LEFT JOIN execution_data d ON d.executionId=e.id WHERE e.workflowId LIKE 'Series2Edge%' ORDER BY CAST(e.id AS INTEGER) DESC",(error,rows)=>{
  if(error){console.error(error.message);process.exitCode=1;db.close();return;}
  const results=rows.map(row=>{
    let value={};try{value=parse(row.data||'[]');}catch{try{value=JSON.parse(row.data||'{}');}catch{}}
    const result=value.resultData||value.data?.resultData||{};const runs=result.runData||{};
    const json=name=>runs[name]?.at(-1)?.data?.main?.[0]?.[0]?.json;
    const quote=json('Draft and credit quote');const zero=json('Nothing to render');const validation=json('Validate project (free)');
    return{id:row.id,workflowId:row.workflowId,status:row.status,mode:row.mode,startedAt:row.startedAt,stoppedAt:row.stoppedAt,lastNode:result.lastNodeExecuted,nodes:Object.fromEntries(Object.entries(runs).map(([name,data])=>[name,data.at(-1)?.executionStatus])),quotedCredits:quote?.quotedCredits??validation?.creditsRequired??null,editorLink:quote?.editorLink??null,editorDraftError:quote?.editorDraftError??null,resultStatus:quote?.status??zero?.status??null,reason:zero?.reason??null,error:result.error?{message:String(result.error.message||'').slice(0,1500),node:result.error.node?.name}:null,paidNodesExecuted:Object.keys(runs).filter(name=>['Submit render once','Wait for completed render','Video result','Watch video'].includes(name))};
  });
  console.log(JSON.stringify(results));db.close();
});
