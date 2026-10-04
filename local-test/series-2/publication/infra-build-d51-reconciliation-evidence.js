'use strict';
// Combine only the isolated D51 rejection, guarded recovery and later delivery.
const fs=require('node:fs');
const path=require('node:path');
const read=name=>JSON.parse(fs.readFileSync(path.join(__dirname,name),'utf8'));
const rejection=read('infra-quota-error-794.json');
const audit=read('infra-job-audit-evidence.json').results.find(row=>row.executionId===796);
const requeue=read('infra-requeue-d51-evidence.json').results.find(row=>row.executionId===798);
const attempts=read('upgraded-executions.json').attempts;
const failed=attempts.find(row=>row.id===794);
const delivered=attempts.find(row=>row.id===800);
if(!audit||!requeue||!failed||!delivered)throw new Error('All four native D51 evidence records are required.');
const frozenMatches=['requestKey','sourceId','revision','inputHash','projectSha256','quotedCredits'].every(key=>failed.frozen?.[key]===delivered.frozen?.[key]);
const noFailedAcceptance=!failed.acceptedExecutionId&&!failed.acceptedSubmission?.jobId&&!rejection.acceptedCaptureExecuted&&!rejection.acceptedCheckpointExecuted;
const verified=failed.status==='error'&&noFailedAcceptance&&audit.status==='success'&&audit.evidence.rejectedRequestHasNoAcceptedJob===true&&requeue.status==='success'&&requeue.evidence.frozenFieldsPreserved===true&&requeue.evidence.accountCountersModified===false&&frozenMatches&&delivered.status==='success'&&delivered.functionalMatch===true&&delivered.acceptedExecutionId===800&&delivered.outcome?.status==='delivered'&&delivered.receipt?.status==='delivered'&&delivered.receipt?.jobId===delivered.frozen?.jobId;
if(!verified)throw new Error('Native rejection, no-acceptance, frozen recovery and delivery evidence must all agree.');
const report={generatedAt:new Date().toISOString(),day:51,rejectedExecutionId:794,readOnlyAcceptanceAuditExecutionId:796,guardedRequeueExecutionId:798,acceptedAndDeliveredExecutionId:800,noFailedAcceptance,noAcceptedJobFoundByAudit:true,frozenFieldsPreserved:true,frozenProjectAndInputMatchDelivered:true,changedFields:requeue.evidence.onlyChangedFields,paidNodesInRequeue:requeue.evidence.paidNodesExecuted,accountCountersModified:false,requestKey:delivered.frozen.requestKey,inputHash:delivered.frozen.inputHash,projectSha256:delivered.frozen.projectSha256,jobId:delivered.frozen.jobId,driveFileId:delivered.frozen.driveFileId,canonicalFunctionalHash:delivered.canonicalFunctionalHash,evidenceFiles:['infra-quota-error-794.json','infra-job-audit-evidence.json','infra-requeue-d51-evidence.json','upgraded-executions.json'],verified};
fs.writeFileSync(path.join(__dirname,'infra-d51-reconciliation-evidence.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({day:51,verified,acceptedAndDeliveredExecutionId:800,frozenProjectAndInputMatchDelivered:true,accountCountersModified:false}));
