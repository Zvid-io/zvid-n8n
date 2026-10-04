'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const read=name=>JSON.parse(fs.readFileSync(path.join(__dirname,name),'utf8'));
const executions=read('upgraded-executions.json');
const imports=read('infra-import-audit.json');
const media=read('upgraded-media-results.json');
const original=read('infra-original-media-provenance.json');
const successfulNode=(attempt,name)=>attempt?.nodes?.[name]?.some(run=>run.status==='success'&&run.totalOutputItems>0)===true;
if(imports.totalPassed!==30||imports.allPassed!==true||imports.workflows.some(row=>!row.inactive||!row.credentialBindingsValid))throw new Error('All 30 inactive native imports and credentials must pass.');
const videos=original.videos.map(video=>{
  const record=media.results.find(row=>row.executionId===video.originalMediaCaptureExecutionId);
  const attempt=executions.attempts.find(row=>row.id===video.originalMediaCaptureExecutionId);
  const file=fs.realpathSync(path.resolve(__dirname,video.file));
  if(path.relative(__dirname,file).startsWith('..')||!record?.passed||record.visualReview!=='passed'||!record.technicalPassed||!attempt?.functionalMatch||record.originalMediaCaptureExecutionId!==video.originalMediaCaptureExecutionId||record.functionalHash!==video.functionalHash||record.sha256!==video.mediaSha256||crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')!==video.mediaSha256)throw new Error(`D${video.day} original current media proof failed.`);
  return {...video,replayExecutionIds:record.replayExecutionIds||[]};
});
function phase(name,firstId,lastId,requireGet){
  const rows=videos.map(video=>{
    const id=firstId+video.day-31;
    const attempt=executions.attempts.find(row=>row.id===id&&row.day===video.day);
    const originalAttempt=executions.attempts.find(row=>row.id===video.originalMediaCaptureExecutionId);
    const get=successfulNode(attempt||{},'Wait for completed render');
    const sameIdentity=['sourceId','revision','requestKey','jobId','driveFileId','videoUrl','driveUrl'].every(key=>typeof attempt?.outcome?.[key]==='string'&&attempt.outcome[key]===originalAttempt.outcome[key]);
    const sameFrozen=['inputHash','projectSha256'].every(key=>attempt?.frozen?.[key]===originalAttempt.frozen[key]&&/^[a-f0-9]{64}$/.test(attempt.frozen[key]));
    const passed=attempt?.mode==='manual'&&attempt.status==='success'&&attempt.functionalMatch===true&&attempt.outcome?.status==='delivered'&&attempt.receipt?.status==='delivered'&&!attempt.submissionExecuted&&!attempt.uploadExecuted&&get===requireGet&&successfulNode(attempt,'Find existing delivery')&&successfulNode(attempt,'Read back delivery receipt')&&sameIdentity&&sameFrozen&&video.replayExecutionIds.includes(id);
    if(!passed)throw new Error(`D${video.day} ${name} replay proof failed for execution${id}.`);
    return {day:video.day,executionId:id,originalMediaCaptureExecutionId:video.originalMediaCaptureExecutionId,jobId:video.jobId,driveFileId:video.driveFileId,inputHash:video.inputHash,projectSha256:video.projectSha256,mediaSha256:video.mediaSha256,nativeGetExecuted:get,submitExecuted:false,uploadExecuted:false,retainedOriginalIdentity:true,passed};
  });
  if(rows.at(-1).executionId!==lastId)throw new Error('Unexpected native phase range.');
  return {name,firstExecutionId:firstId,lastExecutionId:lastId,manualPassed:rows.length,nativeGetCount:rows.filter(row=>row.nativeGetExecuted).length,submitCount:0,uploadCount:0,originalMediaCaptureIdsUnchanged:true,rows};
}
const phases=[phase('accepted_job_resume',822,851,true),phase('uploaded_delivery_recovery',853,882,false)];
const report={generatedAt:new Date().toISOString(),executionsCapturedAt:executions.capturedAt,importsCapturedAt:imports.capturedAt,currentDockerImportsPassed:30,currentManualDeliveredDays:executions.manualDeliveredDays,currentMediaTechnicalAndVisualPassed:videos.length,originalMediaCaptureCount:original.videoCount,originalProvenanceUnchanged:true,recoveryReplayCount:phases.reduce((sum,item)=>sum+item.manualPassed,0),phases,historicalVisualFailureExecutionIds:media.results.filter(row=>row.visualReview==='failed').map(row=>row.executionId),evidenceFiles:['infra-import-audit.json','upgraded-executions.json','upgraded-media-results.json','infra-original-media-provenance.json'],verifiedByReadOnlyEvidence:true};
fs.writeFileSync(path.join(__dirname,'infra-final-native-media-evidence.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({currentImports:30,currentMediaPassed:videos.length,acceptedResumes:phases[0].manualPassed,uploadedRecoveries:phases[1].manualPassed,acceptedGetCount:phases[0].nativeGetCount,uploadedGetCount:phases[1].nativeGetCount,newReplaySubmits:0,newReplayUploads:0,originalCaptureIdsUnchanged:true}));
