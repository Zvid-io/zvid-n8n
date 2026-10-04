'use strict';
// Run inside Docker. Select execution payloads, never credentials, and emit
// only node counts, small QA receipts, and explicit integration/contract checks.
const sqlite=require('/usr/local/lib/node_modules/n8n/node_modules/sqlite3');
const {parse}=require('/usr/local/lib/node_modules/n8n/node_modules/flatted');
const db=new sqlite.Database('/home/node/.n8n/database.sqlite',sqlite.OPEN_READONLY);
const prefix='ZvidSeries2PubEdge';
const definitions={
  CopyWorkbook:{evidenceClass:'native_google_drive_integration'},
  SetupRows:{evidenceClass:'native_google_sheets_qa_setup'},
  MultiRead:{evidenceClass:'native_google_sheets_and_datatable_integration'},
  Unapproved:{evidenceClass:'native_google_sheets_approval_integration'},
  CapZero:{evidenceClass:'native_google_sheets_and_zvid_validation_integration',expectedError:'credit cap'},
  AcceptedDryRun:{evidenceClass:'native_saved_state_integration'},
  AmbiguousSubmission:{evidenceClass:'native_saved_state_integration',expectedError:'ambiguous'},
  SourceReadRace:{evidenceClass:'simulated_read_race_contract_with_native_delivery',expectedError:'changed during rendering'},
  DetailsReadRace:{evidenceClass:'simulated_read_race_contract_with_native_delivery',expectedError:'changed during rendering'},
  LostUploadResponse:{evidenceClass:'native_google_drive_lost_response_recovery',expectedError:'deliberate lost upload response'},
  LostUploadReplay:{evidenceClass:'native_google_drive_lost_response_recovery'},
  ExpiredNoticeRecovery:{evidenceClass:'simulated_clock_contract_with_native_job_recovery'}
};
const ids=Object.keys(definitions).map(name=>prefix+name);
const sql='SELECT e.id,e.workflowId,e.status,e.mode,e.startedAt,e.stoppedAt,d.data FROM execution_entity e LEFT JOIN execution_data d ON e.id=d.executionId WHERE e.workflowId IN ('+ids.map(()=>'?').join(',')+') ORDER BY CAST(e.id AS INTEGER) ASC';
const first=(runs,name)=>runs[name]?.at(-1)?.data?.main?.flat()?.find(item=>item?.json)?.json;
const successful=(runs,name)=>!!runs[name]?.some(run=>!run.error&&(run.data?.main?.flat()?.length||0)>0);
const count=(runs,name)=>runs[name]?.reduce((sum,run)=>sum+(run.data?.main?.flat()?.length||0),0)||0;
function checksFor(name,status,error,runs){
  const checks={manualMode:true,noPaidSubmission:!runs['Submit render once'],noPaidGuard:!runs['Block new paid submissions']};
  const noDrive=()=>!['Find existing delivery','Upload private review video','Update business register'].some(node=>runs[node]);
  switch(name){
    case 'CopyWorkbook':checks.privateNativeCopyReceipt=first(runs,'Copied workbook receipt')?.status==='edge_workbook_ready';break;
    case 'SetupRows':checks.nativeSetupCompleted=status==='success';break;
    case 'MultiRead':checks.sourceRowsExactly3=count(runs,'Read source register')===3;checks.detailRowsExactly9=count(runs,'Read related records')===9;checks.savedRowsExactly2=count(runs,'Read saved requests')===2;checks.nativeReadsOnce=['Read source register','Read related records','Read saved requests'].every(node=>runs[node]?.length===1);checks.intakeAsserted=successful(runs,'Assert native multi-row intake');checks.noDrive=noDrive();break;
    case 'Unapproved':checks.noWorkReported=!!first(runs,'No work report');checks.noDrive=noDrive();break;
    case 'CapZero':checks.freeNativeValidation=successful(runs,'Validate project (free)');checks.creditCapRejected=status==='error'&&!!runs['Check validation and credit cap']?.some(run=>run.error)&&/maxRenderCredits is 0|credit cap|exceeds|above/i.test(error||'');checks.noDrive=noDrive();break;
    case 'AcceptedDryRun':checks.savedInspection=first(runs,'Saved request inspection')?.status==='saved_request_inspection';checks.noPollOrDrive=!runs['Wait for completed render']&&noDrive();break;
    case 'AmbiguousSubmission':checks.failedClosed=status==='error'&&!!runs['Decide recovery']?.some(run=>run.error)&&/ambiguous|Automatic resubmission is blocked/i.test(error||'');checks.noPollOrDrive=!runs['Wait for completed render']&&noDrive();break;
    case 'SourceReadRace':case 'DetailsReadRace':checks.readRaceContractRejected=status==='error'&&/changed during rendering/i.test(error||'');checks.nativeExistingAssetReused=first(runs,'Reconcile delivery file')?.existingDelivery===true;checks.noSourceWriteback=!runs['Update business register'];checks.noDuplicateUpload=!runs['Upload private review video'];break;
    case 'LostUploadResponse':checks.nativeUploadCompleted=successful(runs,'Upload private review video');checks.deliberateResponseLoss=status==='error'&&/deliberate lost upload response/i.test(error||'');checks.noUploadReceiptCheckpoint=!runs['Remember delivery']&&!runs['Persist delivery file'];checks.noSourceWriteback=!runs['Update business register'];break;
    case 'LostUploadReplay':checks.existingAssetReused=first(runs,'Reconcile delivery file')?.existingDelivery===true;checks.noDuplicateUpload=!runs['Upload private review video'];checks.nativeWritebackVerified=successful(runs,'Read back delivery receipt')&&first(runs,'Business outcome')?.status==='delivered';break;
    case 'ExpiredNoticeRecovery':checks.nativeSavedJobPolled=successful(runs,'Wait for completed render');checks.noDuplicateUpload=!runs['Upload private review video'];checks.existingAssetReused=first(runs,'Reconcile delivery file')?.existingDelivery===true;checks.nativeWritebackVerified=successful(runs,'Read back delivery receipt')&&first(runs,'Business outcome')?.status==='delivered';checks.expiredPolicyRecovered=Object.entries(runs).filter(([node])=>node.startsWith('Apply ')).some(([,entries])=>entries.some(run=>run.data?.main?.flat()?.some(item=>item.json?.decision==='skip'&&item.json?.ready===true&&item.json?.savedStatus==='accepted')));break;
  }
  return checks;
}
db.all(sql,ids,(error,rows)=>{
  if(error)throw error;
  const attempts=rows.map(row=>{
    let parsed={};try{parsed=parse(row.data||'{}')||{};}catch{}
    const result=parsed.resultData||parsed.data?.resultData||{},runs=result.runData||{},name=row.workflowId.slice(prefix.length),definition=definitions[name];
    const errorMessage=result.error?.message||Object.values(runs).flat().find(run=>run.error)?.error?.message||null;
    const checks=checksFor(name,row.status,errorMessage,runs);checks.manualMode=row.mode==='manual';
    const output=first(runs,'Business outcome')||first(runs,'Saved request inspection')||first(runs,'No work report')||first(runs,'Copied workbook receipt')||first(runs,'Assert native multi-row intake')||null;
    const receipt=first(runs,'Read back delivery receipt');
    const nodes=Object.fromEntries(Object.entries(runs).map(([node,entries])=>[node,{runs:entries.length,totalItems:count(runs,node),successful:successful(runs,node),error:entries.find(entry=>entry.error)?.error?.message||null}]));
    return {executionId:row.id,workflowId:row.workflowId,name,mode:row.mode,status:row.status,startedAt:row.startedAt,stoppedAt:row.stoppedAt,evidenceClass:definition.evidenceClass,simulatedContract:definition.evidenceClass.startsWith('simulated_'),expectedError:definition.expectedError||null,error:errorMessage,lastNode:result.lastNodeExecuted||null,checks,passed:Object.values(checks).every(Boolean),nodes,output:output?{status:output.status,sourceId:output.source_id||null,revision:output.revision||null,jobId:output.jobId||null,driveFileId:output.driveFileId||null,driveUrl:output.driveUrl||null,edgeSpreadsheetId:output.edgeSpreadsheetId||null,dryRun:output.dryRun??null,deliveryAttempted:output.deliveryAttempted??null,reason:output.reason||null}:null,receipt:receipt?{sourceId:receipt.source_id,revision:receipt.revision,automationStatus:receipt.automation_status,jobId:receipt.job_id,driveFileId:receipt.drive_file_id,requestKey:receipt.request_key,inputHash:receipt.input_hash}:null};
  });
  const tests=Object.keys(definitions).map(name=>{const own=attempts.filter(attempt=>attempt.name===name);return {name,workflowId:prefix+name,evidenceClass:definitions[name].evidenceClass,passedExecutionIds:own.filter(attempt=>attempt.passed).map(attempt=>attempt.executionId),latestExecutionId:own.at(-1)?.executionId||null,latestPassed:own.at(-1)?.passed??false};});
  process.stdout.write(JSON.stringify({capturedAt:new Date().toISOString(),scope:'Sanitized manual local Docker edge evidence. Native integrations and simulated read/clock contracts are distinguished; no credentials or raw projects are emitted.',totalTests:tests.length,passedTests:tests.filter(test=>test.passedExecutionIds.length).length,tests,attempts},null,2)+'\n');db.close();
});
