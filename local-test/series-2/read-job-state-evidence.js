'use strict';
const sqlite3=require('/usr/local/lib/node_modules/n8n/node_modules/sqlite3');const{parse}=require('/usr/local/lib/node_modules/n8n/node_modules/flatted');
const db=new sqlite3.Database('/home/node/.n8n/database.sqlite',sqlite3.OPEN_READONLY);
db.get('SELECT e.id,e.status,e.mode,e.startedAt,e.stoppedAt,d.data FROM execution_entity e JOIN execution_data d ON e.id=d.executionId WHERE workflowId=? ORDER BY CAST(e.id AS INTEGER) DESC LIMIT 1',['Series2EdgeJobStates'],(err,row)=>{
if(err||!row){console.error(err?.message||'Missing fixture execution');process.exitCode=1;db.close();return;}
const value=parse(row.data);const result=value.resultData||value.data?.resultData||{};const runs=result.runData||{};
console.log(JSON.stringify({executionId:row.id,status:row.status,mode:row.mode,startedAt:row.startedAt,stoppedAt:row.stoppedAt,lastNode:result.lastNodeExecuted,output:runs['Known series job states']?.at(-1)?.data?.main?.[0]?.[0]?.json,error:result.error?{message:result.error.message}:null,nodes:Object.keys(runs),paidNodesExecuted:Object.keys(runs).filter(name=>name==='Submit render once')}));db.close();
});
