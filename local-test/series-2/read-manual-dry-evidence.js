'use strict';
const assert=require('node:assert/strict');const sqlite3=require('/usr/local/lib/node_modules/n8n/node_modules/sqlite3');const{parse}=require('/usr/local/lib/node_modules/n8n/node_modules/flatted');
const db=new sqlite3.Database('/home/node/.n8n/database.sqlite',sqlite3.OPEN_READONLY);
db.get('SELECT e.id,e.status,e.mode,e.startedAt,e.stoppedAt,d.data FROM execution_entity e JOIN execution_data d ON e.id=d.executionId WHERE workflowId=? AND mode=? ORDER BY CAST(e.id AS INTEGER) DESC LIMIT 1',['Series2EdgeDryRun31','manual'],(error,row)=>{
if(error||!row){console.error(error?.message||'Missing manual dry-run execution');process.exitCode=1;db.close();return;}
try{
const value=parse(row.data);const result=value.resultData||value.data?.resultData||{};const runs=result.runData||{};const json=name=>runs[name]?.at(-1)?.data?.main?.[0]?.[0]?.json;
const output=json('Draft and credit quote');const normalized=json('Normalize and build video');const paidNodes=Object.keys(runs).filter(name=>['Submit render once','Wait for completed render','Video result','Watch video'].includes(name));
assert.equal(row.status,'success');assert.equal(output.status,'draft_unavailable');assert.equal(output.editorDraftSaved,false);assert.equal(output.dryRun,true);assert.equal(output.renderSubmitted,false);assert.equal(output.quotedCredits,18);assert.equal(output.editorLink,null);assert.equal(output.editorDraftError,'Project limit reached');assert.equal(paidNodes.length,0);assert.deepEqual(normalized.meta.counts,{added:1,improved:1,fixed:1});
console.log(JSON.stringify({passed:true,workflowId:'Series2EdgeDryRun31',executionId:row.id,mode:row.mode,status:row.status,startedAt:row.startedAt,stoppedAt:row.stoppedAt,lastNode:result.lastNodeExecuted,output:{status:output.status,editorDraftSaved:output.editorDraftSaved,dryRun:output.dryRun,renderSubmitted:output.renderSubmitted,quotedCredits:output.quotedCredits,editorLink:output.editorLink,editorDraftError:output.editorDraftError,sourceKey:output.sourceKey,calculatedMeta:normalized.meta},draftOutputTruthful:true,nodes:Object.fromEntries(Object.entries(runs).map(([name,data])=>[name,data.at(-1)?.executionStatus])),paidNodesExecuted:paidNodes,uiScreenshot:'manual-draft-result.jpg'}));
}catch(error){console.error(JSON.stringify({passed:false,error:error.message}));process.exitCode=1;}db.close();
});
