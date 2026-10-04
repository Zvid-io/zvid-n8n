'use strict';
const fs=require('node:fs');
const path=require('node:path');
const proof=JSON.parse(fs.readFileSync(path.join(__dirname,'infra-quota-error-794.json'),'utf8'));
const reason=proof.quotaFields.find(field=>field.path==='error.context.data.error')?.value;
if(proof.executionId!==794||reason!=='concurrent_limit_exceeded'||proof.acceptedCaptureExecuted||proof.acceptedCheckpointExecuted||proof.frozenIntent?.jobId)throw new Error('Unexpected rejection evidence.');
const expected={...proof.frozenIntent,failedExecutionId:794,failedStartedAt:proof.startedAt,failedStoppedAt:proof.stoppedAt};
const jsCode=`const expected=${JSON.stringify(expected)};
const jobs=$input.all().flatMap(item=>Array.isArray(item.json)?item.json:Array.isArray(item.json.jobs)?item.json.jobs:[item.json]).filter(job=>job.id||job.jobId||job.job_id);
const safe=jobs.map(job=>({jobId:String(job.id||job.jobId||job.job_id),name:job.name||null,status:job.status||job.state||null,type:job.job_type||job.type||null,createdAt:job.created_at||job.createdAt||job.ts?.created||null,completedAt:job.completed_at||job.ts?.finished||null}));
const failedAt=Date.parse(expected.failedStartedAt.replace(' ','T')+'Z');
if(!Number.isFinite(failedAt)||!safe.length||safe.some(job=>!Number.isFinite(Date.parse(job.createdAt))))throw new Error('Native job-list time coverage cannot be verified.');
const earliest=Math.min(...safe.map(job=>Date.parse(job.createdAt)));
const coverageSinceFailure=earliest<=failedAt-10000;
const matchingD51Jobs=safe.filter(job=>job.name===expected.attemptedProjectName);
const candidatesAfterFailure=matchingD51Jobs.filter(job=>Date.parse(job.createdAt)>=failedAt-10000);
const terminal=new Set(['completed','complete','failed','cancelled','canceled']);
const activeJobs=safe.filter(job=>!terminal.has(String(job.status).toLowerCase()));
return [{json:{resource:'native_readonly_render_acceptance_audit',auditedAt:new Date().toISOString(),failedExecutionId:794,expected,page:1,limit:100,returnedJobCount:safe.length,coverageSinceFailure,earliestJobAt:new Date(earliest).toISOString(),matchingD51Jobs,candidatesAfterFailure,nonterminalJobs:activeJobs,nonterminalJobCount:activeJobs.length,rejectedRequestHasNoAcceptedJob:coverageSinceFailure&&candidatesAfterFailure.length===0}}];`;
const nodes=[
  {id:'infra-jobs-audit-trigger',name:'Audit recent jobs manually',type:'n8n-nodes-base.manualTrigger',typeVersion:1,position:[0,200],parameters:{}},
  {id:'infra-jobs-audit-native',name:'Read recent account renders',type:'@zvid/n8n-nodes-zvid.zvid',typeVersion:1,position:[280,200],parameters:{resource:'render',operation:'getAll',limit:100,page:1,filterType:'all'},credentials:{zvidApi:{id:'e3b494f287402c80c13bf080',name:'Zvid workflow series'}},executeOnce:true,alwaysOutputData:true},
  {id:'infra-jobs-audit-safe',name:'Sanitize acceptance and active-job evidence',type:'n8n-nodes-base.code',typeVersion:2,position:[570,200],parameters:{mode:'runOnceForAllItems',jsCode}},
  {id:'infra-jobs-audit-note',name:'Read-only quota reconciliation audit',type:'n8n-nodes-base.stickyNote',typeVersion:1,position:[-20,-190],parameters:{color:5,width:900,height:290,content:'### Read-only quota rejection audit\n\nThis native Zvid Get Many fixture lists100 recent jobs with the existing account credential. It does not create, mutate, cancel, rerender or delete jobs, change plan counters, or spend render credits.\n\nRun manually and inspect the sanitized output. It checks timestamp coverage around rejected execution794 and identifies any travel-itinerary-video job created in that interval, plus nonterminal account jobs. A missing timestamp or incomplete coverage fails the audit. This is a private QA fixture, not a publishable template.'}},
];
const fixture={id:'ZvidSeries2PublicationAuditRecentJobs',name:'QA read-only Zvid acceptance and concurrent jobs audit',active:false,nodes,connections:{'Audit recent jobs manually':{main:[[{node:'Read recent account renders',type:'main',index:0}]]},'Read recent account renders':{main:[[{node:'Sanitize acceptance and active-job evidence',type:'main',index:0}]]}},settings:{executionOrder:'v1',timezone:'Africa/Cairo'}};
fs.writeFileSync(path.join(__dirname,'infra-job-audit-fixture.json'),JSON.stringify([fixture],null,2)+'\n');
console.log(JSON.stringify({workflowId:fixture.id,localUrl:'http://localhost:5678/workflow/'+fixture.id,readonly:true,paidNodes:[]}));
