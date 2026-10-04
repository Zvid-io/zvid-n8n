'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const {deriveDay,delivered,fileBytesHash,artifact,matchingMedia}=require('./assemble-native-role-evidence');
const {adapters,fixtureFor,prepareSource}=require('../../../scripts/series-two-source-adapters');
const NOW='2026-10-01T12:00:00.000Z';
function observations(day=31){
  const adapter=adapters[day],fixture=fixtureFor(day,NOW),revision=day===50?'r2':'r1';fixture.primary.revision=revision;for(const row of fixture.details)row.revision=revision;const context=prepareSource(day,fixture.primary,fixture.details,NOW).context;
  const canonical={functionalHash:'a'.repeat(64)},privateQa={folderId:'private-folder',shared:false,executionId:736,spreadsheetId:'private-workbook'};
  const frozen={sourceId:fixture.primary.source_id,revision,requestKey:[adapter.slug,fixture.primary.source_id,revision,...(adapter.refreshPeriod==='day'?['2026-10-01']:[]),privateQa.folderId].join('|'),status:'delivered',jobId:'accepted-job-'+day,inputHash:'b'.repeat(64),projectSha256:'c'.repeat(64),driveFileId:'drive-'+day,videoUrl:'https://media.example.com/v.mp4',driveUrl:'https://drive.google.com/file/d/drive-'+day+'/view'};
  const types={'Test manually':'manualTrigger','Read source register':'googleSheets','Read related records':'googleSheets','Apply domain policy':'code','Eligible work found?':'if','Prepare durable request':'code','Read back delivery receipt':'googleSheets','Persist delivered outcome':'dataTable','Read saved requests':'dataTable'};
  const attempts=[],native=[];
  function add(id,kind){
    const nodeTypes={...types};
    if(kind==='created'){nodeTypes['Submit render once']='zvid';nodeTypes['Persist accepted job']='dataTable';nodeTypes['Wait for completed render']='zvid';nodeTypes['Upload private review video']='googleDrive';}
    if(kind==='accepted'){nodeTypes['Look up saved request']='dataTable';nodeTypes['Wait for completed render']='zvid';nodeTypes['Find existing delivery']='googleDrive';}
    if(kind==='uploaded')nodeTypes['Find existing delivery']='googleDrive';
    if(kind==='dedup')nodeTypes['No work report']='code';
    const nodes=Object.fromEntries(Object.entries(nodeTypes).map(([name,type],index)=>[name,{status:'success',totalItems:1,runs:1,startedAtMs:index,type:type==='zvid'?'@zvid/n8n-nodes-zvid.zvid':'n8n-nodes-base.'+type}]));
    if(kind==='created'){nodes['Persist accepted job'].startedAtMs=30;nodes['Wait for completed render'].startedAtMs=31;}
    if(kind==='accepted'){nodes['Look up saved request'].startedAtMs=30;nodes['Wait for completed render'].startedAtMs=31;}
    const state={...frozen,status:kind==='created'?'new':kind==='dedup'?'delivered':kind};
    const saved={...state,status:kind==='dedup'?'delivered':kind};
    const file={fileId:frozen.driveFileId,name:'fixture.mp4',mimeType:'video/mp4',bytes:1000,requestHash:frozen.inputHash};
    const observation={executionId:id,day,workflowId:'ZvidSeries2Day'+day,mode:'manual',status:'success',syntheticFixture:true,expectedSourceId:frozen.sourceId,sourceSpreadsheetId:privateQa.spreadsheetId,destinationFolderId:privateQa.folderId,functionalSha256:canonical.functionalHash,canonicalFunctionalSha256:canonical.functionalHash,nodes,policyNode:'Apply domain policy',sourceRowCount:1,sourceIdOccurrences:1,source:[{sourceId:frozen.sourceId,revision:'r1',approval:'approved',automationStatus:kind==='dedup'?'delivered':'',requestKey:kind==='dedup'?frozen.requestKey:null,jobId:kind==='dedup'?frozen.jobId:null,driveFileId:kind==='dedup'?frozen.driveFileId:null}],relatedRowCount:fixture.details.length,relatedMatchingSourceRevisionCount:fixture.details.length,policy:[{sourceId:frozen.sourceId,revision:'r1',ready:true,decision:'ready',sourceRecordPresent:true,detailRevisionJoinValid:true,joinedDetailCount:fixture.details.length}],states:{'Read saved requests':kind==='dedup'?[saved]:[],'Look up saved request':kind==='accepted'?[saved]:[],'Decide recovery':kind==='dedup'?[]:[state],'Persist accepted job':kind==='created'?[{...frozen,status:'accepted'}]:[]},files:{uploaded:kind==='created'?[file]:[],searched:['accepted','uploaded'].includes(kind)?[file]:[],reconciled:['accepted','uploaded'].includes(kind)?[{...frozen,status:kind,existingDelivery:true}]:[]},renderCreateCalls:kind==='created'?1:0,driveUploadCalls:kind==='created'?1:0,sharingNodeExecuted:false};
    observation.source[0].revision=revision;observation.policy[0].revision=revision;
    const attempt={id,day,workflowId:observation.workflowId,mode:'manual',status:'success',startedAt:NOW,functionalMatch:true,executionFunctionalHash:canonical.functionalHash,canonicalFunctionalHash:canonical.functionalHash,nodes:Object.fromEntries(Object.entries(nodes).map(([name,value])=>[name,[{status:value.status,totalOutputItems:value.totalItems}]])),context:structuredClone(context),frozen:kind==='dedup'?null:{...frozen},outcome:kind==='dedup'?{status:'nothing_to_render'}:{...frozen,status:'delivered'},receipt:kind==='dedup'?null:{...frozen,status:'delivered'}};
    attempts.push(attempt);native.push(observation);
  }
  add(800,'created');add(801,'dedup');add(802,'accepted');add(803,'uploaded');
  return {adapter,canonical,privateQa,attempts,native};
}
const derive=data=>deriveDay(data.adapter,data.canonical,data.attempts,data.native,data.privateQa);
test('all real phases are independently required and automatic evidence stays unconfirmed',()=>{
  const data=observations(),day=derive(data);
  assert.equal(day.observedRolesComplete,true);assert.equal(day.rootConfirmed,false);
  assert.equal(day.refs.resumeAccepted,802);assert.equal(day.refs.deliveryRecovery,803);assert.equal(day.refs.deduplication,801);
  data.attempts=data.attempts.slice(0,2);data.native=data.native.slice(0,2);
  const pending=derive(data);assert.equal(pending.observedRolesComplete,false);assert.ok(pending.missingRoles.includes('resumeAccepted'));assert.ok(pending.missingRoles.includes('deliveryRecovery'));assert.equal(pending.dedupObservedExecutionId,801);assert.equal(pending.nativeFileUniquenessObserved,false);
});
test('D38 records a real empty related tab without inventing a child join',()=>{
  const data=observations(38),day=derive(data),proof=day.proofs.find(row=>row.executionId===day.refs.sourceRead);
  assert.equal(day.observedRolesComplete,true);assert.equal(proof.roles.sourceRead.referenceRowsRead,0);assert.equal(proof.roles.sourceRead.referenceRowsRequired,false);assert.deepEqual(proof.roles.sourceRead.detailKinds,[]);assert.equal(proof.roles.domainPolicy.sourceRevisionVerified,true);
});
test('D50 requires the corrected r2 delivery and never reuses r1 as current render proof',()=>{
  const current=derive(observations(50));assert.equal(current.revision,'r2');assert.equal(current.observedRolesComplete,true);assert.ok(current.requestKey.includes('|r2|'));
  const legacy=observations(50);for(const attempt of legacy.attempts)for(const field of ['frozen','receipt','outcome'])if(attempt[field]?.revision)attempt[field].revision='r1';
  const rejected=derive(legacy);assert.equal(rejected.mainExecutionId,null);assert.equal(rejected.observedRolesComplete,false);assert.ok(rejected.missingRoles.includes('mainCurrentRender'));
});
test('D31 current accepted recovery proves the frozen job without rebadging its older submission',()=>{
  const data=observations(31),original=data.attempts[0],originalNative=data.native[0];
  const older=structuredClone(original),olderNative=structuredClone(originalNative);
  older.id=740;older.executionFunctionalHash='d'.repeat(64);older.functionalMatch=false;
  olderNative.executionId=740;olderNative.functionalSha256='d'.repeat(64);
  data.attempts.unshift(older);data.native.unshift(olderNative);
  // The current completed delivery uploaded the retained video but did not
  // submit or poll. Its native upload remains original media provenance.
  for(const name of ['Submit render once','Persist accepted job','Wait for completed render']){
    delete original.nodes[name];delete originalNative.nodes[name];
  }
  originalNative.renderCreateCalls=0;
  originalNative.states['Persist accepted job']=[];
  originalNative.states['Decide recovery'][0].status='completed';
  const result=derive(data),main=result.proofs.find(row=>row.executionId===802);
  assert.equal(result.mainExecutionId,802);
  assert.equal(result.refs.ledgerAcceptance,802);
  assert.equal(main.roles.ledgerAcceptance.acceptanceMode,'native_saved_checkpoint_read');
  assert.equal(main.roles.render.mode,'reusedAccepted');
  assert.equal(main.roles.render.renderCreateCalls,0);
  assert.equal(result.refs.driveFile,800);
  assert.equal(result.proofs.some(row=>row.executionId===740),false);
  assert.equal(result.observedRolesComplete,true);
  originalNative.files.uploaded[0].requestHash='unrelated-original-upload';
  assert.ok(derive(data).missingRoles.includes('driveFile'));
});
test('different canonical hashes, failed runs and partial-node executions cannot supply roles',()=>{
  for(const mutate of [data=>data.attempts.forEach(row=>row.executionFunctionalHash='d'.repeat(64)),data=>data.native.forEach(row=>row.status='error'),data=>data.native.forEach(row=>delete row.nodes['Test manually'])]){
    const data=observations();mutate(data);const result=derive(data);assert.equal(result.observedRolesComplete,false);assert.equal(result.proofs.length,0);
  }
});
test('final source receipt must agree with its complete frozen ledger identity',()=>{
  for(const field of ['sourceId','revision','requestKey','jobId','driveFileId','videoUrl','driveUrl']){
    const data=observations(),attempt=data.attempts[0];
    assert.equal(delivered(attempt),true);
    attempt.frozen[field]='different-'+field;
    assert.equal(delivered(attempt),false,'Frozen/receipt mismatch for '+field);
  }
});
test('media bytes bind the actual original job, request hash and Drive file across replays',()=>{
  const data=observations(),day=derive(data),media={day:day.day,workflowId:day.workflowId,passed:true,mediaPassed:true,visualReview:'passed',functionalHash:data.canonical.functionalHash,jobId:day.jobId,projectSha256:day.projectSha256,inputHash:day.inputHash,driveFileId:day.driveFileId,sha256:'f'.repeat(64)};
  assert.equal(matchingMedia(day,media,data.canonical.functionalHash,media.sha256),true);
  for(const field of ['workflowId','jobId','projectSha256','inputHash','driveFileId','sha256']){
    assert.equal(matchingMedia(day,{...media,[field]:'unrelated'},data.canonical.functionalHash,media.sha256),false,field);
  }
  assert.equal(matchingMedia(day,media,'d'.repeat(64),media.sha256),false);
  assert.equal(matchingMedia(day,media,data.canonical.functionalHash,'e'.repeat(64)),false);
});
test('uploaded retry cannot stand in for accepted resume and the accepted job must match frozen content',()=>{
  const data=observations();data.native.find(row=>row.executionId===802).states['Decide recovery'][0].status='completed';assert.ok(derive(data).missingRoles.includes('resumeAccepted'));
  const changed=observations();changed.native.find(row=>row.executionId===802).states['Decide recovery'][0].projectSha256='e'.repeat(64);assert.ok(derive(changed).missingRoles.includes('resumeAccepted'));
});
test('duplicate source and ledger rows or mismatching Drive metadata do not become dedup evidence',()=>{
  for(const mutate of [data=>data.native.find(row=>row.executionId===801).source.push({...data.native.find(row=>row.executionId===801).source[0]}),data=>data.native.find(row=>row.executionId===801).states['Read saved requests'].push({...data.native.find(row=>row.executionId===801).states['Read saved requests'][0]}),data=>data.native.filter(row=>[802,803].includes(row.executionId)).forEach(row=>row.files.searched.push({...row.files.searched[0]})),data=>data.native.filter(row=>[802,803].includes(row.executionId)).forEach(row=>row.files.searched[0].requestHash='wrong')]){
    const data=observations();mutate(data);assert.ok(derive(data).missingRoles.includes('deduplication'));
  }
});
test('native source approval, required related rows, policy validation and private upload are material',()=>{
  for(const mutate of [data=>data.native.forEach(row=>row.source[0].approval='pending'),data=>data.native.forEach(row=>row.relatedMatchingSourceRevisionCount=0),data=>data.native.forEach(row=>row.policy[0].detailRevisionJoinValid=false)]){
    const data=observations();mutate(data);assert.ok(derive(data).missingRoles.includes('domainPolicy'));
  }
  const data=observations();data.privateQa.shared=true;assert.ok(derive(data).missingRoles.includes('driveFile'));
});
test('binary and exact-file artifact hashes match independent byte validators',async()=>{
  const bytes=Buffer.from([0x89,0x50,0x4e,0x47,0x00,0xff,0x0d,0x0a,0xc3,0xa9]);
  const directory=fs.mkdtempSync(path.join(__dirname,'byte-hash-guard-'));
  const file=path.join(directory,'actual-bytes.bin');
  try{
    fs.writeFileSync(file,bytes,{flag:'wx'});
    const independent=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    const readiness=await import(pathToFileURL(path.join(__dirname,'../flowlu-upgrade-readiness.mjs')).href);
    const exact=artifact(file);
    assert.equal(exact.sha256,independent);
    assert.equal(exact.sha256,readiness.sha256(fs.readFileSync(file)));
    assert.equal(fileBytesHash(bytes),independent);
    assert.notEqual(exact.sha256,require('./infra-functional-fingerprint').sha256(bytes));
    const textFile=artifact(__filename);
    assert.equal(textFile.sha256,crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'));
    assert.equal(artifact(path.join(__dirname,'../../../../.env')),null);
  }finally{fs.unlinkSync(file);fs.rmdirSync(directory);}
});
