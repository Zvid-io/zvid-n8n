'use strict';
const fs=require('node:fs');const assert=require('node:assert/strict');const{isDeepStrictEqual}=require('node:util');
const sqlite3=require('/usr/local/lib/node_modules/n8n/node_modules/sqlite3');const{parse}=require('/usr/local/lib/node_modules/n8n/node_modules/flatted');
const expected=JSON.parse(fs.readFileSync('/tmp/series-two-webhook-sample.json','utf8').replace(/^\uFEFF/,''));
const db=new sqlite3.Database('/home/node/.n8n/database.sqlite',sqlite3.OPEN_READONLY);
db.get('SELECT e.id,e.workflowId,e.status,e.mode,e.startedAt,e.stoppedAt,d.data FROM execution_entity e JOIN execution_data d ON d.executionId=e.id WHERE e.workflowId=? ORDER BY CAST(e.id AS INTEGER) DESC LIMIT 1',['Series2EdgeWebhook31'],(error,row)=>{
  if(error){console.error(error.message);process.exitCode=1;db.close();return;}
  try{
    assert.ok(row,'No webhook fixture execution is saved.');
    const parsed=parse(row.data);const result=parsed.resultData||parsed.data?.resultData||{};const runs=result.runData||{};
    const json=name=>runs[name]?.at(-1)?.data?.main?.[0]?.[0]?.json;
    const source=json('Receive event');const config=json('Config');const normalized=json('Normalize and build video');const draft=json('Draft and credit quote');
    const noPaid=Object.keys(runs).filter(name=>['Submit render once','Wait for completed render','Video result','Watch video'].includes(name));
    assert.equal(row.status,'success');assert.ok(source,'Receive event did not execute.');assert.ok(isDeepStrictEqual(source.body,expected),'Received body did not match the saved synthetic payload.');
    assert.ok(isDeepStrictEqual(config.body,expected),'Config did not preserve the webhook body.');assert.equal(config.dryRun,true);assert.equal(draft.dryRun,true);assert.equal(draft.renderSubmitted,false);
    assert.equal(draft.quotedCredits,18);assert.equal(noPaid.length,0);
    assert.equal(normalized.meta.changeCount,3);assert.deepEqual(normalized.meta.counts,{added:1,improved:1,fixed:1});
    const editorLinkValid=typeof draft.editorLink==='string'&&/^https:\/\/editor\.zvid\.io\/\?project=prj_/.test(draft.editorLink);
    const draftOutputTruthful=editorLinkValid?(draft.status==='draft'&&draft.editorDraftSaved===true):(draft.status==='draft_unavailable'&&draft.editorDraftSaved===false&&Boolean(draft.editorDraftError));
    assert.ok(draftOutputTruthful,'Dry result must truthfully report saved draft or original draft error.');
    console.log(JSON.stringify({passed:true,executionId:row.id,workflowId:row.workflowId,status:row.status,mode:row.mode,startedAt:row.startedAt,stoppedAt:row.stoppedAt,lastNode:result.lastNodeExecuted,sourceBodyCorrect:true,configPreservedSourceBody:true,configDryRun:config.dryRun,resultDryRun:draft.dryRun,renderSubmitted:draft.renderSubmitted,quotedCredits:draft.quotedCredits,editorLink:draft.editorLink,editorLinkValid,editorDraftSaved:draft.editorDraftSaved,draftOutputTruthful,editorDraftError:draft.editorDraftError,resultStatus:draft.status,sourceKey:draft.sourceKey,calculatedMeta:normalized.meta,nodes:Object.fromEntries(Object.entries(runs).map(([name,data])=>[name,data.at(-1)?.executionStatus])),paidNodesExecuted:noPaid}));
  }catch(err){console.error(JSON.stringify({passed:false,error:err.message}));process.exitCode=1;}
  db.close();
});
