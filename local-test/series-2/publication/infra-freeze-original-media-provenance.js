'use strict';
// Preserve the first complete current-template media set separately from replays.
const fs=require('node:fs');
const path=require('node:path');
const read=name=>JSON.parse(fs.readFileSync(path.join(__dirname,name),'utf8'));
const native=read('upgraded-executions.json');
const media=read('upgraded-media-results.json');
const videos=Array.from({length:30},(_,index)=>index+31).map(day=>{
  const record=media.results.find(row=>row.day===day&&row.passed===true&&row.visualReview==='passed'&&row.technicalPassed===true&&native.attempts.some(attempt=>attempt.id===row.executionId&&attempt.functionalMatch===true&&attempt.executionFunctionalHash===row.functionalHash));
  if(!record||record.originalMediaCaptureExecutionId!==record.executionId)throw new Error(`D${day} requires a passed immutable original capture.`);
  return {day,originalMediaCaptureExecutionId:record.executionId,acceptedExecutionId:record.acceptedExecutionId,functionalHash:record.functionalHash,jobId:record.jobId,inputHash:record.inputHash,projectSha256:record.projectSha256,driveFileId:record.driveFileId,file:record.file,mediaSha256:record.sha256,bytes:record.bytes};
});
const target=path.join(__dirname,'infra-original-media-provenance.json');
if(fs.existsSync(target)){
  if(JSON.stringify(read('infra-original-media-provenance.json').videos)!==JSON.stringify(videos))throw new Error('Original media provenance is already frozen; refuse to relabel it.');
}else fs.writeFileSync(target,JSON.stringify({frozenAt:new Date().toISOString(),purpose:'Original complete current-template captures, retained independently from free recovery replay execution IDs.',videoCount:videos.length,videos},null,2)+'\n');
console.log(JSON.stringify({originalCurrentVideos:videos.length,provenanceFrozen:true,captureIdsUnchanged:true}));
