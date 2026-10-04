'use strict';
const sqlite3=require('/usr/local/lib/node_modules/n8n/node_modules/sqlite3');const{parse}=require('/usr/local/lib/node_modules/n8n/node_modules/flatted');
const db=new sqlite3.Database('/home/node/.n8n/database.sqlite',sqlite3.OPEN_READONLY);
db.get('SELECT e.id,e.status,d.data FROM execution_entity e JOIN execution_data d ON e.id=d.executionId WHERE workflowId=? ORDER BY CAST(e.id AS INTEGER) DESC LIMIT 1',['Series2EdgeRecovery35'],(err,row)=>{
  if(err){console.error(err.message);process.exitCode=1;db.close();return;}
  const parsed=parse(row.data);const result=parsed.resultData||parsed.data?.resultData||{};const runs=result.runData||{};
  console.log(JSON.stringify({executionId:row.id,status:row.status,lastNode:result.lastNodeExecuted,output:runs['Find accepted Day35 job']?.at(-1)?.data?.main?.[0]?.[0]?.json,error:result.error?{message:result.error.message}:null,nodes:Object.keys(runs),paidNodesExecuted:Object.keys(runs).filter(name=>name==='Submit render once')}));db.close();
});
