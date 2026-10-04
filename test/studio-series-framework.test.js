'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {intake,stable,decide,prepare,checkSource,resolveDesign,submissionFailure,recoverSubmission,build}=require('../scripts/studio-series/framework');
const {specs,template}=require('../scripts/build-studio-series');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const cfg={maxSourceRows:100,driveFolderId:'qa-private',designRevision:'approved-v1'};
function input(spec){const source_id=spec.sample.request.source_id||spec.sample.request.request_id,revision=String(spec.sample.request.revision);const rows=[{source_id,revision,approval:'approved',brief_json:JSON.stringify(spec.sample.request)}];const details=spec.sample.records.map(r=>{const {kind,record_id,parent_id,revision:_rev,...data}=r;return {parent_id:source_id,revision,kind,record_id,data_json:JSON.stringify(data)}});return {rows,details};}
const all=specs();
test('The series contains 30 distinct business workflows',()=>{assert.equal(all.length,30);assert.equal(new Set(all.map(s=>s.slug)).size,30);assert.equal(new Set(all.map(s=>s.stageNames.join('|'))).size,30);});
for(const spec of all)test('D'+spec.day+' joined source resolves the complete approved design and matching receipt',()=>{
 const t=template(spec.day),{rows,details}=input(spec);let state=intake(rows,details,[],cfg,spec,t)[0];state.config.nowISO=spec.sampleAnchorISO||spec.sample.request.as_of||'2026-10-03T12:00:00Z';
 for(const f of spec.stages)state=f(state);assert.equal(state.status,'ready',state.reason);state.ready=true;state.input_hash=hash(state.fingerprint);
 const selected=decide([state],cfg),frozen=prepare(selected),project=JSON.parse(frozen.project_json);assert.ok(project.scenes.length>=3);assert.doesNotMatch(frozen.project_json,/\{\{/);assert.deepEqual(JSON.parse(frozen.context_json).decision,state.decision);
 const receipt=checkSource(rows,details,frozen,cfg);assert.equal(hash(receipt.fingerprint),state.input_hash);
 const wf=build(spec,t);assert.equal(wf.active,false);assert.ok(!JSON.stringify(wf).includes('CUSTOM.'));assert.ok(wf.nodes.filter(n=>n.type.includes('n8n-nodes-zvid')).every(n=>n.type==='@zvid/n8n-nodes-zvid.zvid'));
 const notes=wf.nodes.filter(n=>n.type==='n8n-nodes-base.stickyNote');for(let a=0;a<notes.length;a++)for(let b=a+1;b<notes.length;b++){const x=notes[a],y=notes[b];assert.ok(x.position[0]+x.parameters.width<=y.position[0]||y.position[0]+y.parameters.width<=x.position[0]||x.position[1]+x.parameters.height<=y.position[1]||y.position[1]+y.parameters.height<=x.position[1]);}
});
test('All completed rows return an explicit zero-work report',()=>{const s=all[0],{rows,details}=input(s),t=template(s.day);let c=intake(rows,details,[],cfg,s,t)[0];c.ready=true;c.input_hash=hash(c.fingerprint);const saved={request_key:[s.slug,c.source_id,c.revision,cfg.driveFolderId].join('|'),input_hash:c.input_hash,status:'delivered'};c.saved=saved;c.sourceRow={...c.sourceRow,automation_status:'delivered',input_hash:c.input_hash};const out=decide([c],cfg);assert.equal(out.status,'nothing_to_render');assert.equal(out.report.alreadyDelivered,1);assert.equal(out.renderSubmitted,false);});
test('Changed same-revision data never reuses an accepted job',()=>{const c={ready:true,source_id:'x',input_hash:'new',saved:{input_hash:'old',status:'accepted',job_id:'j'}};const out=decide([c],cfg);assert.equal(out.status,'needs_review');assert.match(out.report.review[0].reason,/changed/);});
test('Unfinished older revision blocks a new paid request and preserves its retained job',()=>{const s=all[0],{rows,details}=input(s),id=rows[0].source_id;const out=intake(rows,details,[{request_key:[s.slug,id,'old',cfg.driveFolderId].join('|'),workflow_slug:s.slug,source_id:id,revision:'old',status:'accepted',job_id:'retained'}],cfg,s,template(s.day));const current=out.find(x=>x.revision===rows[0].revision);assert.equal(current.status,'review');assert.match(current.reason,/earlier revision/);assert.equal(current.retainedRequests[0].jobId,'retained');assert.ok(out.some(x=>x.revision==='old'&&x.retainedRequests[0].jobId==='retained'));});
test('Source withdrawal after rendering is caught before writeback',()=>{const s=all[0],{rows,details}=input(s);rows[0].approval='withdrawn';assert.throws(()=>checkSource(rows,details,{source_id:rows[0].source_id,revision:rows[0].revision},cfg),/approval or revision changed/);});
test('Trusted generated diagrams remain SVG; arbitrary text is escaped',()=>{const state={template:{scenes:[{html:'<div>{{title}}</div>{{diagram}}'}]},defaults:{},variables:{title:'A & B < C',diagram:'<svg><rect width="4" height="5"/></svg>'},trustedMarkupVariables:['diagram']};const p=resolveDesign(state);assert.match(p.scenes[0].html,/A &amp; B &lt; C/);assert.match(p.scenes[0].html,/<svg><rect/);state.variables.diagram='<svg onload="bad()"></svg>';assert.throws(()=>resolveDesign(state),/Unsafe generated/);});
test('Drafts are validation-only and paid submission has no retry',()=>{const w=build(all[0],template(31)),by=Object.fromEntries(w.nodes.map(n=>[n.name,n]));assert.ok(!by['Save draft to editor']);assert.equal(by['Submit render once'].retryOnFail,undefined);assert.equal(w.connections['Dry run?'].main[0][0].node,'Draft and credit quote');assert.equal(JSON.parse(by.Config.parameters.jsonOutput).dryRun,false);});

test('Only a structured, definite HTTP 429 can become retryable; uncertain responses remain ambiguous',()=>{
 const state={request_key:'one',input_hash:'hash',project_json:'frozen',status:'submitting',last_error:''},at='2026-10-03T12:00:00Z';
 for(const item of [{json:{error:'HTTP 429 too many requests'}},{error:{message:'429'}},{error:{httpCode:500}},{error:{httpCode:429,response:{status:502}}}]){const result=submissionFailure(item,state,at);assert.equal(result.status,'submitting');assert.equal(result.project_json,'frozen');assert.throws(()=>recoverSubmission(state,[result],'2026-10-03T12:01:00Z','manual'),/ambiguous/);}
 const rejected=submissionFailure({error:{name:'NodeApiError',httpCode:'429'}},state,at);assert.equal(rejected.status,'rejected');assert.equal(JSON.parse(rejected.last_error).retryAfter,'2026-10-03T12:00:30.000Z');assert.equal(JSON.parse(rejected.last_error).attempts,1);assert.equal(rejected.project_json,'frozen');
 assert.equal(submissionFailure({error:{httpCode:429}},{...state,job_id:'already-accepted'},at).status,'submitting');
});

test('Explicit rejections respect Retry-After and permit at most two manual reattempts without modifying frozen content',()=>{
 const state={request_key:'one',input_hash:'hash',project_json:'frozen',status:'submitting',last_error:''},at='2026-10-03T12:00:00Z';
 let saved=submissionFailure({error:{httpCode:429,response:{headers:{'retry-after':'120'}}}},state,at);assert.equal(JSON.parse(saved.last_error).retryAfter,'2026-10-03T12:02:00.000Z');
 assert.throws(()=>recoverSubmission(state,[saved],'2026-10-03T12:01:00Z','manual'),/cooldown/);assert.throws(()=>recoverSubmission(state,[saved],'2026-10-03T12:03:00Z','production'),/only by a manual/);assert.equal(recoverSubmission(state,[saved],'2026-10-03T12:03:00Z','test').project_json,'frozen');assert.throws(()=>recoverSubmission(state,[saved],'2026-10-03T12:03:00Z','manual'),/only by a manual/);
 saved=submissionFailure({error:{httpCode:'429'}},saved,'2026-10-03T12:03:00Z');assert.equal(JSON.parse(saved.last_error).attempts,2);assert.equal(recoverSubmission(state,[saved],'2026-10-03T12:04:00Z','test').status,'rejected');
 saved=submissionFailure({error:{httpCode:'429'}},saved,'2026-10-03T12:04:00Z');assert.equal(JSON.parse(saved.last_error).attempts,3);assert.throws(()=>recoverSubmission(state,[saved],'2026-10-03T12:05:00Z','test'),/retry bound/);
});

test('Malformed rejection evidence cannot unlock a submission and accepted/completed jobs still recover',()=>{
 const state={request_key:'one',input_hash:'hash',project_json:'frozen',status:'submitting',last_error:''};
 assert.throws(()=>recoverSubmission(state,[{...state,status:'rejected',last_error:'429'}],new Date().toISOString(),'manual'),/invalid HTTP evidence/);
 const accepted={...state,status:'accepted',job_id:'job-saved'};assert.equal(recoverSubmission(state,[accepted],new Date().toISOString(),'manual').job_id,'job-saved');
 const delivered={...accepted,status:'delivered',video_url:'https://example.test/paid.mp4',drive_file_id:'file-saved'};assert.equal(recoverSubmission(state,[delivered],new Date().toISOString(),'manual').drive_file_id,'file-saved');
 const workflow=build(all[0],template(31)),submit=workflow.nodes.find(n=>n.name==='Submit render once');assert.equal(submit.onError,'continueErrorOutput');assert.equal(submit.retryOnFail,undefined);assert.equal(workflow.connections['Submit render once'].main[0][0].node,'Capture accepted job');assert.equal(workflow.connections['Submit render once'].main[1][0].node,'Classify submission failure');assert.equal(workflow.connections['Persist submission failure'].main[0][0].node,'Submission failure report');
});
test('All thirty orphaned requests remain visible with paid job and delivery identifiers',()=>{
 const s=all[0],saved=Array.from({length:30},(_,i)=>({request_key:[s.slug,'deleted-'+i,'r1',cfg.driveFolderId].join('|'),workflow_slug:s.slug,source_id:'deleted-'+i,revision:'r1',status:i===0?'submitting':'accepted',job_id:i===0?'':'job-'+i,video_url:i===29?'https://cdn.zvid.io/retained.mp4':'',drive_file_id:i===29?'retained-file':'',drive_url:i===29?'https://drive.google.com/file/d/retained-file/view':''}));
 const out=decide(intake([],[],saved,cfg,s,template(s.day)),cfg);
 assert.equal(out.status,'needs_review');assert.equal(out.report.review.length,30);assert.equal(out.renderSubmitted,false);
 assert.equal(out.report.review[0].retainedRequests[0].savedStatus,'submitting');assert.equal(out.report.review[0].retainedRequests[0].jobId,null);
 assert.equal(out.report.review[29].retainedRequests[0].jobId,'job-29');assert.equal(out.report.review[29].retainedRequests[0].driveFileId,'retained-file');
});
test('Withdrawn approval with an accepted job is review, not a silent skip or resumed delivery',()=>{
 const s=all[0],{rows,details}=input(s);rows[0].approval='withdrawn';const saved=[{request_key:[s.slug,rows[0].source_id,rows[0].revision,cfg.driveFolderId].join('|'),workflow_slug:s.slug,source_id:rows[0].source_id,revision:rows[0].revision,status:'accepted',job_id:'keep-this-job'}];
 const out=decide(intake(rows,details,saved,cfg,s,template(s.day)),cfg);assert.equal(out.status,'needs_review');assert.equal(out.report.review.length,1);assert.match(out.report.review[0].reason,/withdrawn/);assert.equal(out.report.review[0].retainedRequests[0].jobId,'keep-this-job');
});
test('Completed or other-destination ledger entries do not create orphan alarms',()=>{
 const s=all[0],saved=[{request_key:[s.slug,'removed','r1',cfg.driveFolderId].join('|'),workflow_slug:s.slug,source_id:'removed',revision:'r1',status:'delivered'},{request_key:[s.slug,'removed','r1','other-folder'].join('|'),workflow_slug:s.slug,source_id:'removed',revision:'r1',status:'accepted'}];
 const out=decide(intake([],[],saved,cfg,s,template(s.day)),cfg);assert.equal(out.status,'nothing_to_render');assert.equal(out.report.review.length,0);
});
for(const field of ['source_id','request_id','revision','approval'])test('Request '+field+' cannot disagree with the sheet envelope',()=>{
 const s=all[0],{rows,details}=input(s);const brief=JSON.parse(rows[0].brief_json);brief[field]=field==='approval'?'rejected':'different';rows[0].brief_json=JSON.stringify(brief);
 const out=intake(rows,details,[],cfg,s,template(s.day))[0];assert.equal(out.status,'review');assert.match(out.reason,new RegExp(field+' disagrees'));
});
for(const field of ['kind','record_id','parent_id','revision'])test('Related-record '+field+' cannot be silently overwritten by its sheet envelope',()=>{
 const s=all[0],{rows,details}=input(s);const data=JSON.parse(details[0].data_json);data[field]='different';details[0].data_json=JSON.stringify(data);
 const out=intake(rows,details,[],cfg,s,template(s.day))[0];assert.equal(out.status,'review');assert.match(out.reason,new RegExp(field+' disagrees'));
});
test('Changed source and changed related content both produce different delivery fingerprints',()=>{
 const s=all[0],{rows,details}=input(s),current=intake(rows,details,[],cfg,s,template(s.day))[0],state={source_id:rows[0].source_id,revision:rows[0].revision};
 const baseline=checkSource(rows,details,state,cfg);assert.equal(baseline.fingerprint,current.fingerprint);
 const changedRows=structuredClone(rows),brief=JSON.parse(changedRows[0].brief_json);brief.auditMarker='changed';changedRows[0].brief_json=JSON.stringify(brief);assert.notEqual(checkSource(changedRows,details,state,cfg).fingerprint,baseline.fingerprint);
 const changedDetails=structuredClone(details),data=JSON.parse(changedDetails[0].data_json);data.auditMarker='changed';changedDetails[0].data_json=JSON.stringify(data);assert.notEqual(checkSource(rows,changedDetails,state,cfg).fingerprint,baseline.fingerprint);
});
