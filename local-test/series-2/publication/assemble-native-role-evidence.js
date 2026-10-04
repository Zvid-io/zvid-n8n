'use strict';
// Offline assembly only. Automatic observations remain root-unconfirmed.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {adapters,prepareSource}=require('../../../scripts/series-two-source-adapters');
const {functionalHash}=require('./infra-functional-fingerprint');
const PUB=__dirname,BASE=path.resolve(PUB,'..'),N8N=path.resolve(PUB,'../../..');
const requiredRoles=['sourceRead','domainPolicy','eligibility','ledgerAcceptance','driveFile','writeback','deduplication','resumeAccepted','deliveryRecovery'];
const validHash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const fileBytesHash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const nativePassed=(observation,name,type)=>observation?.nodes?.[name]?.status==='success'&&observation.nodes[name].totalItems>0&&(!type||observation.nodes[name].type===type);
const summaryPassed=(attempt,name)=>attempt?.nodes?.[name]?.some(run=>run.status==='success'&&run.totalOutputItems>0)===true;
const firstState=(observation,name)=>observation?.states?.[name]?.[0]||null;
const before=(observation,first,second)=>Number.isFinite(observation?.nodes?.[first]?.startedAtMs)&&Number.isFinite(observation?.nodes?.[second]?.startedAtMs)&&observation.nodes[first].startedAtMs<=observation.nodes[second].startedAtMs;
const sameIdentity=(one,two)=>!!one&&!!two&&['sourceId','revision','requestKey','jobId','inputHash','projectSha256'].every(key=>typeof one[key]==='string'&&one[key]&&one[key]===two[key]);
function delivered(attempt){
  const final=attempt?.outcome,receipt=attempt?.receipt,state=attempt?.frozen;
  return !!final&&!!receipt&&!!state&&final.status==='delivered'&&receipt.status==='delivered'&&state.status==='delivered'&&
    ['sourceId','revision','requestKey','jobId','driveFileId','videoUrl','driveUrl'].every(key=>typeof final[key]==='string'&&final[key]&&final[key]===receipt[key]&&state[key]===receipt[key])&&
    state.inputHash===receipt.inputHash&&validHash(state.inputHash)&&validHash(state.projectSha256)&&summaryPassed(attempt,'Persist delivered outcome')&&summaryPassed(attempt,'Read back delivery receipt');
}
function renderRole(attempt,observation){
  const frozen=attempt?.frozen;
  if(!frozen||!validHash(frozen.projectSha256))return null;
  const accepted=firstState(observation,'Persist accepted job');
  if(observation.renderCreateCalls===1&&nativePassed(observation,'Submit render once','@zvid/n8n-nodes-zvid.zvid')&&sameIdentity(accepted,frozen))return {real:true,passed:true,node:'Submit render once',mode:'created',jobId:frozen.jobId,projectSha256:frozen.projectSha256,renderCreateCalls:1};
  const saved=firstState(observation,'Decide recovery');
  if(observation.renderCreateCalls===0&&saved?.status==='accepted'&&nativePassed(observation,'Wait for completed render','@zvid/n8n-nodes-zvid.zvid')&&sameIdentity(saved,frozen))return {real:true,passed:true,node:'Wait for completed render',mode:'reusedAccepted',jobId:frozen.jobId,projectSha256:frozen.projectSha256,frozenProjectSha256:saved.projectSha256,renderCreateCalls:0};
  return null;
}
function qualified(adapter,attempt,observation){
  const policy=observation?.policy?.find(row=>row.sourceId===attempt.frozen?.sourceId&&String(row.revision)===attempt.frozen?.revision);
  const source=observation?.source?.find(row=>row.sourceId===attempt.frozen?.sourceId&&String(row.revision)===attempt.frozen?.revision);
  const childKinds=Object.keys(adapter.detailKinds),detailsRequired=childKinds.length>0;
  if(!nativePassed(observation,'Read source register','n8n-nodes-base.googleSheets')||!nativePassed(observation,'Read related records','n8n-nodes-base.googleSheets')||observation.sourceIdOccurrences!==1||source?.approval!=='approved'||!policy||policy.decision!=='ready'||policy.ready!==true||policy.sourceRecordPresent!==true||policy.detailRevisionJoinValid!==true||!nativePassed(observation,observation.policyNode,'n8n-nodes-base.code')||!summaryPassed(attempt,'Prepare durable request'))return null;
  if(detailsRequired?!(observation.relatedMatchingSourceRevisionCount>0&&policy.joinedDetailCount>0):observation.relatedMatchingSourceRevisionCount!==0||policy.joinedDetailCount!==0)return null;
  const context=attempt.context;
  if(!context?.record||!Array.isArray(context.details)||context.sourceId!==source.sourceId||String(context.revision)!==source.revision)return null;
  const iso=attempt.startedAt?.includes('T')?attempt.startedAt:attempt.startedAt?.replace(' ','T')+'Z';
  let checked;try{checked=prepareSource(adapter.day,context.record,context.details,iso);}catch{return null;}
  if(checked.decision!=='ready')return null;
  return {policy,source,detailsRequired,childKinds};
}
function deriveDay(adapter,canonical,attempts,observations,privateQa){
  const sourceId='qa-d'+adapter.day+'-record-001',id='ZvidSeries2Day'+adapter.day,revision=adapter.day===50?'r2':'r1';
  const byId=new Map(observations.map(row=>[String(row.executionId),row]));
  const current=attempts.filter(attempt=>attempt.workflowId===id&&attempt.day===adapter.day&&attempt.mode==='manual'&&attempt.status==='success'&&attempt.functionalMatch===true&&attempt.executionFunctionalHash===canonical.functionalHash&&attempt.canonicalFunctionalHash===canonical.functionalHash).filter(attempt=>{
    const observation=byId.get(String(attempt.id));return observation?.mode==='manual'&&observation.status==='success'&&observation.syntheticFixture===true&&observation.functionalSha256===canonical.functionalHash&&observation.canonicalFunctionalSha256===canonical.functionalHash&&observation.expectedSourceId===sourceId&&observation.sourceSpreadsheetId===privateQa.spreadsheetId&&observation.destinationFolderId===privateQa.folderId&&nativePassed(observation,'Test manually','n8n-nodes-base.manualTrigger');
  });
  const deliveries=current.filter(delivered).filter(attempt=>attempt.frozen.sourceId===sourceId&&attempt.frozen.revision===revision&&attempt.frozen.requestKey.endsWith('|'+privateQa.folderId));
  const main=deliveries.find(attempt=>renderRole(attempt,byId.get(String(attempt.id)))&&qualified(adapter,attempt,byId.get(String(attempt.id))))||null;
  const primary=main||deliveries[0]||null;
  const identity=primary?.frozen||null;
  const matching=deliveries.filter(attempt=>sameIdentity(attempt.frozen,identity)&&attempt.outcome.driveFileId===identity.driveFileId&&attempt.frozen.videoUrl===identity.videoUrl);
  const uploads=matching.flatMap(attempt=>{const observation=byId.get(String(attempt.id));return (observation.files.uploaded||[]).map(file=>({attempt,observation,file}));}).filter(({observation,file})=>nativePassed(observation,'Upload private review video','n8n-nodes-base.googleDrive')&&file.fileId===identity?.driveFileId&&file.mimeType==='video/mp4'&&file.bytes>0&&file.requestHash===identity.inputHash&&observation.sharingNodeExecuted===false);
  const uniqueSearches=matching.map(attempt=>({attempt,observation:byId.get(String(attempt.id))})).filter(({observation})=>nativePassed(observation,'Find existing delivery','n8n-nodes-base.googleDrive')&&observation.files.searched.length===1&&observation.files.searched[0].fileId===identity?.driveFileId&&observation.files.searched[0].mimeType==='video/mp4'&&observation.files.searched[0].requestHash===identity.inputHash&&observation.files.reconciled.length===1&&observation.files.reconciled[0].existingDelivery===true&&sameIdentity(observation.files.reconciled[0],identity));
  const proofs=current.map(attempt=>({executionId:Number(attempt.id),day:adapter.day,workflowId:id,mode:'manual',status:'success',mocked:false,functionalSha256:canonical.functionalHash,nodes:Object.fromEntries(Object.entries(byId.get(String(attempt.id)).nodes).map(([name,node])=>[name,node.status])),roles:{},sourceId,revision}));
  const proofById=new Map(proofs.map(proof=>[String(proof.executionId),proof]));
  const refs={};
  const put=(role,attempt,value)=>{if(!attempt||!value)return;proofById.get(String(attempt.id)).roles[role]=value;refs[role]=Number(attempt.id);};
  const useful=matching.find(attempt=>qualified(adapter,attempt,byId.get(String(attempt.id))));
  if(useful){
    const observation=byId.get(String(useful.id)),validation=qualified(adapter,useful,observation);
    put('sourceRead',useful,{real:true,passed:true,node:'Read source register',rowsRead:observation.sourceRowCount,referenceRowsRead:observation.relatedMatchingSourceRevisionCount,referenceRowsRequired:validation.detailsRequired,detailKinds:validation.childKinds,relatedReadNode:'Read related records',sourceId,revision});
    put('domainPolicy',useful,{real:true,passed:true,node:observation.policyNode,sourceId,revision,requiredFieldsValidated:true,referenceJoinVerified:true,sourceRevisionVerified:true,detailKinds:validation.childKinds,joinedDetailCount:validation.policy.joinedDetailCount,policy:adapter.policy});
    put('eligibility',useful,{real:true,passed:true,node:'Eligible work found?',sourceId,eligible:true,businessRuleChecked:true,decision:validation.policy.decision,policyNode:observation.policyNode});
  }
  const accepted=matching.find(attempt=>{
    const observation=byId.get(String(attempt.id)),created=firstState(observation,'Persist accepted job'),saved=firstState(observation,'Look up saved request');
    return created?.status==='accepted'&&sameIdentity(created,identity)&&nativePassed(observation,'Persist accepted job','n8n-nodes-base.dataTable')&&before(observation,'Persist accepted job','Wait for completed render')||saved?.status==='accepted'&&sameIdentity(saved,identity)&&observation.states['Look up saved request'].length===1&&nativePassed(observation,'Look up saved request','n8n-nodes-base.dataTable')&&before(observation,'Look up saved request','Wait for completed render');
  });
  if(accepted){const observation=byId.get(String(accepted.id)),created=firstState(observation,'Persist accepted job')?.status==='accepted';put('ledgerAcceptance',accepted,{real:true,passed:true,node:created?'Persist accepted job':'Look up saved request',requestKey:identity.requestKey,jobId:identity.jobId,inputHash:identity.inputHash,projectSha256:identity.projectSha256,acceptedBeforeDownstream:true,persistedState:'accepted',acceptanceMode:created?'native_checkpoint':'native_saved_checkpoint_read'});}
  const drive=uploads[0];
  if(drive&&privateQa.shared===false)put('driveFile',drive.attempt,{real:true,passed:true,node:'Upload private review video',fileId:drive.file.fileId,private:true,mimeType:drive.file.mimeType,bytes:drive.file.bytes,inputHash:drive.file.requestHash,privateFolderId:privateQa.folderId,privacyBasis:'Native private-folder setup receipt and upload with no sharing operation',folderSetupExecutionId:privateQa.executionId});
  if(primary)put('writeback',primary,{real:true,passed:true,node:'Read back delivery receipt',status:'delivered',sourceId,revision,requestKey:identity.requestKey,jobId:identity.jobId,driveFileId:identity.driveFileId,inputHash:identity.inputHash,verifiedFinalNode:'Persist delivered outcome'});
  const resumed=matching.find(attempt=>{
    const observation=byId.get(String(attempt.id)),saved=firstState(observation,'Decide recovery');
    return saved?.status==='accepted'&&sameIdentity(saved,identity)&&observation.renderCreateCalls===0&&observation.driveUploadCalls===0&&nativePassed(observation,'Wait for completed render','@zvid/n8n-nodes-zvid.zvid')&&uniqueSearches.some(item=>String(item.attempt.id)===String(attempt.id));
  });
  if(resumed)put('resumeAccepted',resumed,{real:true,passed:true,node:'Wait for completed render',requestKey:identity.requestKey,jobId:identity.jobId,driveFileId:identity.driveFileId,renderCreateCalls:0,driveUploadCalls:0,acceptedJobResumed:true,projectSha256:identity.projectSha256,savedState:'accepted'});
  const recovered=matching.find(attempt=>{
    const observation=byId.get(String(attempt.id)),saved=firstState(observation,'Decide recovery');
    return saved?.status==='uploaded'&&sameIdentity(saved,identity)&&saved.driveFileId===identity.driveFileId&&observation.renderCreateCalls===0&&observation.driveUploadCalls===0&&!observation.nodes['Wait for completed render']&&uniqueSearches.some(item=>String(item.attempt.id)===String(attempt.id));
  });
  if(recovered)put('deliveryRecovery',recovered,{real:true,passed:true,node:'Read back delivery receipt',requestKey:identity.requestKey,jobId:identity.jobId,driveFileId:identity.driveFileId,renderCreateCalls:0,driveUploadCalls:0,writebackSucceeded:true,savedState:'uploaded',projectSha256:identity.projectSha256});
  const deduplicated=current.find(attempt=>{
    const observation=byId.get(String(attempt.id)),saved=observation.states['Read saved requests'].filter(row=>row.requestKey===identity?.requestKey),source=observation.source.filter(row=>row.sourceId===sourceId);
    return attempt.outcome?.status==='nothing_to_render'&&nativePassed(observation,'No work report','n8n-nodes-base.code')&&observation.renderCreateCalls===0&&observation.driveUploadCalls===0&&source.length===1&&source[0].automationStatus==='delivered'&&source[0].requestKey===identity?.requestKey&&source[0].jobId===identity?.jobId&&source[0].driveFileId===identity?.driveFileId&&saved.length===1&&saved[0].status==='delivered'&&sameIdentity(saved[0],identity)&&saved[0].driveFileId===identity?.driveFileId;
  });
  if(deduplicated&&uniqueSearches.length)put('deduplication',deduplicated,{real:true,passed:true,node:'No work report',requestKey:identity.requestKey,jobId:identity.jobId,driveFileId:identity.driveFileId,renderCreateCalls:0,driveUploadCalls:0,noDuplicateLedgerRows:true,noDuplicateSourceRows:true,noDuplicateFiles:true,fileUniquenessExecutionId:Number(uniqueSearches[0].attempt.id),fileUniquenessNode:'Find existing delivery'});
  if(main)put('render',main,renderRole(main,byId.get(String(main.id))));
  const missing=requiredRoles.filter(role=>!refs[role]);if(!main)missing.push('mainCurrentRender');
  return {day:adapter.day,workflowId:id,sourceId,revision,requestKey:identity?.requestKey||null,jobId:identity?.jobId||null,driveFileId:identity?.driveFileId||null,projectSha256:identity?.projectSha256||null,inputHash:identity?.inputHash||null,mainExecutionId:main?Number(main.id):null,deliveryExecutionIds:matching.map(attempt=>Number(attempt.id)),dedupObservedExecutionId:deduplicated?Number(deduplicated.id):null,nativeFileUniquenessObserved:uniqueSearches.length>0,refs,proofs,missingRoles:missing,observedRolesComplete:missing.length===0,rootConfirmed:false};
}
function readJson(file,otherwise={}){return fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):otherwise;}
function artifact(file){const relative=path.relative(BASE,file);if(relative.startsWith('..')||path.isAbsolute(relative)||/(^|[\\/])\.env(?:[.\\/]|$)/i.test(relative)||!fs.existsSync(file)||!fs.statSync(file).isFile())return null;return {path:relative.replaceAll('\\','/'),sha256:fileBytesHash(fs.readFileSync(file))};}
function matchingMedia(day,media,currentFunctionalHash,actualVideoSha256){
  return !!media&&media.day===day.day&&media.workflowId===day.workflowId&&media.passed===true&&media.mediaPassed===true&&media.visualReview==='passed'&&media.functionalHash===currentFunctionalHash&&media.jobId===day.jobId&&media.projectSha256===day.projectSha256&&media.inputHash===day.inputHash&&media.driveFileId===day.driveFileId&&validHash(media.sha256)&&actualVideoSha256===media.sha256;
}
function build(){
  const completionPath=path.join(BASE,'flowlu-upgrade-completion.json'),old=readJson(completionPath);
  if(old.rootReportConfirmed===true)throw new Error('The completion report is root-confirmed; refresh explicitly through the root review instead of overwriting it.');
  const attempts=readJson(path.join(PUB,'upgraded-executions.json')).attempts||[];
  const native=readJson(path.join(PUB,'upgraded-native-role-observations.json')).executions||[];
  const scaffold=readJson(path.join(PUB,'infra-scaffold-evidence.json')).results||[];
  const folder=scaffold.find(row=>row.status==='success'&&row.evidence?.resource==='private_qa_folder');
  const workbook=scaffold.find(row=>row.status==='success'&&row.evidence?.resource==='private_qa_workbook');
  if(!folder||!workbook)throw new Error('Native private QA setup evidence is missing.');
  const privateQa={folderId:folder.evidence.folderId,shared:folder.evidence.shared,executionId:folder.executionId,spreadsheetId:workbook.evidence.spreadsheetId};
  const canonical=Object.fromEntries(Object.values(adapters).map(adapter=>{const file=path.join(N8N,'workflows','zvid-'+adapter.slug+'.json'),bytes=fs.readFileSync(file);return [adapter.day,{functionalHash:functionalHash(JSON.parse(bytes.toString('utf8'))),artifactSha256:fileBytesHash(bytes)}];}));
  const days=Object.values(adapters).map(adapter=>deriveDay(adapter,canonical[adapter.day],attempts,native,privateQa));
  const proofPath=path.join(PUB,'upgraded-role-evidence.json');
  fs.writeFileSync(proofPath,JSON.stringify({schemaVersion:1,generatedAt:new Date().toISOString(),rootReportConfirmed:false,scope:'Automatically derived native current canonical roles, pending root review. Earlier or different functional revisions do not establish a current role.',nativeObservations:artifact(path.join(PUB,'upgraded-native-role-observations.json')),executions:days.flatMap(day=>day.proofs)},null,2)+'\n');
  const proofRef=artifact(proofPath),mediaRows=readJson(path.join(PUB,'upgraded-media-results.json')).results||[];
  const rows=days.map(day=>{
    const media=mediaRows.find(row=>matchingMedia(day,row,canonical[day.day].functionalHash,artifact(path.join(PUB,row.file||''))?.sha256));
    let mediaRef=null;
    if(media){const file=path.join(PUB,'upgraded-role-media-day-'+day.day+'.json');fs.writeFileSync(file,JSON.stringify({day:day.day,workflowId:day.workflowId,executionId:media.executionId,functionalSha256:canonical[day.day].functionalHash,mediaPassed:true,visualReview:'passed',jobId:day.jobId,projectSha256:day.projectSha256,video:artifact(path.join(PUB,media.file)),originalMediaQa:artifact(path.join(PUB,'upgraded-media-results.json')),visualReviewedAt:media.visualReviewedAt||null},null,2)+'\n');mediaRef=artifact(file);}
    return {day:day.day,workflowId:day.workflowId,rootConfirmed:false,functionalSha256:canonical[day.day].functionalHash,sourceId:day.sourceId,revision:day.revision,requestKey:day.requestKey,jobId:day.jobId,driveFileId:day.driveFileId,inputHash:day.inputHash,acceptedProjectSha256:day.projectSha256,mainRenderExecutionId:day.mainExecutionId,latestDeliveryExecutionId:day.deliveryExecutionIds.at(-1)||null,videoSha256:media?.sha256||null,mediaExecutionId:media?.executionId||null,manual:day.mainExecutionId?{executionId:day.mainExecutionId,artifact:proofRef}:null,checks:Object.fromEntries(requiredRoles.map(role=>[role,day.refs[role]?{executionId:day.refs[role],artifact:proofRef}:null])),mediaQa:mediaRef,canvas:artifact(path.join(PUB,'canvas','day-'+day.day+'-proof.json')),diagnostics:{missingRoles:day.missingRoles,observedRolesComplete:day.observedRolesComplete,deliveryExecutionIds:day.deliveryExecutionIds,mediaMissing:!mediaRef,canvasMissing:!artifact(path.join(PUB,'canvas','day-'+day.day+'-proof.json'))}};
  });
  const testFile=path.join(PUB,'verified-tests.log'),testText=fs.readFileSync(testFile,'utf8');
  const counts=label=>[...testText.matchAll(new RegExp('\\b'+label+' (\\d+)','g'))].map(match=>Number(match[1]));
  const automated={passed:counts('pass').reduce((sum,value)=>sum+value,0),failed:counts('fail').reduce((sum,value)=>sum+value,0),functionalHashes:Object.fromEntries(Object.entries(canonical).map(([day,value])=>[day,value.functionalHash])),artifact:artifact(testFile)};
  fs.writeFileSync(completionPath,JSON.stringify({schemaVersion:1,generatedAt:new Date().toISOString(),rootReportConfirmed:false,automated,workflows:rows},null,2)+'\n');
  fs.writeFileSync(path.join(PUB,'upgraded-verification.json'),JSON.stringify({schemaVersion:1,generatedAt:new Date().toISOString(),rootReportConfirmed:false,workflows:rows.map(row=>({...row,functionalHash:row.functionalSha256,artifactSha256:canonical[row.day].artifactSha256,executionId:row.manual?.executionId||null,checks:{eligibility:row.checks.eligibility?{passed:true,...row.checks.eligibility}:false,deduplication:row.checks.deduplication?{passed:true,...row.checks.deduplication}:false,resumeAccepted:row.checks.resumeAccepted?{passed:true,...row.checks.resumeAccepted}:false,deliveryRecovery:row.checks.deliveryRecovery?{passed:true,...row.checks.deliveryRecovery}:false}}))},null,2)+'\n');
  fs.writeFileSync(path.join(PUB,'upgraded-role-diagnostics.json'),JSON.stringify({generatedAt:new Date().toISOString(),rootReportConfirmed:false,totalDays:days.length,observedCompleteDays:days.filter(day=>day.observedRolesComplete).map(day=>day.day),days:days.map(({proofs,...day})=>day)},null,2)+'\n');
  process.stdout.write(JSON.stringify({observedCompleteDays:days.filter(day=>day.observedRolesComplete).map(day=>day.day),rootReportConfirmed:false,proofExecutions:days.reduce((sum,day)=>sum+day.proofs.length,0),automatedPassed:automated.passed,automatedFailed:automated.failed,pendingDayCount:days.filter(day=>!day.observedRolesComplete).length,diagnostics:'upgraded-role-diagnostics.json'})+'\n');
  return {days,rows};
}
if(require.main===module)build();
module.exports={deriveDay,delivered,renderRole,qualified,build,requiredRoles,fileBytesHash,artifact,matchingMedia};
