'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {buildPublicationWorkflow,chooseRequest,writebackHeaders}=require('../series-two-publication-framework');
const {assertWorkflow}=require('../series-two-framework');
const ZVID='@zvid/n8n-nodes-zvid.zvid',STICKY='n8n-nodes-base.stickyNote';

function stable(value){return JSON.stringify(value===null||typeof value!=='object'?value:Array.isArray(value)?value.map(x=>JSON.parse(stable(x))):Object.fromEntries(Object.keys(value).sort().map(k=>[k,JSON.parse(stable(value[k]))])));}
function intake(rows,details,saved,cfg,info,template){
 const ids=new Set(),results=[];
 if(rows.length>cfg.maxSourceRows||details.length>5000||saved.length>2000)throw Error('Source/ledger bounds exceeded; archive completed records or narrow the source.');
 const history=saved.filter(x=>x.status==='delivered').map(x=>{try{return {...x,...JSON.parse(x.context_json)};}catch{return x;}});
 const unfinished=saved.filter(x=>x.workflow_slug===info.slug&&x.status!=='delivered'&&typeof x.request_key==='string'&&x.request_key.endsWith('|'+cfg.driveFolderId));
 const retained=x=>({request_key:x.request_key,source_id:x.source_id,revision:x.revision,savedStatus:x.status,jobId:x.job_id||null,videoUrl:x.video_url||null,driveFileId:x.drive_file_id||null,driveUrl:x.drive_url||null});
 // Deleted or revised source rows must not hide accepted or ambiguous work.
 // Include every orphan, not only the first one, so batch cleanup is reviewable.
 for(const savedRow of unfinished){
  if(rows.some(row=>String(row.source_id)===String(savedRow.source_id)&&String(row.revision)===String(savedRow.revision)))continue;
  const reference=retained(savedRow);
  results.push({source_id:savedRow.source_id,revision:savedRow.revision,workflow_slug:info.slug,status:'review',ready:false,fingerprint:'',reason:'An unfinished saved request has a deleted or revised source. Reconcile its retained paid work before retiring this request.',retainedRequests:[reference],decision:{retainedRequests:[reference]},artifacts:[]});
 }
 for(const row of rows){
  if(!row.source_id)continue;
  const id=String(row.source_id);if(ids.has(id))throw Error('Duplicate source_id '+id);ids.add(id);
  const pending=unfinished.filter(x=>String(x.source_id)===id);
  const state={source_id:id,revision:String(row.revision||''),sourceRow:row,workflow_slug:info.slug,config:{...cfg,nowISO:new Date().toISOString()},template:JSON.parse(JSON.stringify(template)),defaults:{...template.variables},variables:{},decision:{},artifacts:[],history,status:'pending',retainedRequests:pending.map(retained)};
  try{
   if(!/^[A-Za-z0-9_-]{1,80}$/.test(id)||!/^[A-Za-z0-9_-]{1,40}$/.test(state.revision))throw Error('source_id and revision must be stable letters, numbers, underscores or dashes.');
   if(row.approval!=='approved'){results.push({...state,status:pending.length?'review':'skip',ready:false,reason:pending.length?'The request approval was withdrawn while paid work remains unfinished. Reconcile the retained job before delivery.':'The request is not approved.',fingerprint:'',decision:pending.length?{retainedRequests:pending.map(retained)}:{}});continue;}
   state.request=JSON.parse(row.brief_json);if(!state.request||typeof state.request!=='object'||Array.isArray(state.request))throw Error('brief_json must contain one JSON object.');
   for(const field of ['source_id','request_id'])if(Object.prototype.hasOwnProperty.call(state.request,field)&&String(state.request[field])!==id)throw Error('brief_json '+field+' disagrees with the request sheet source_id.');
   if(Object.prototype.hasOwnProperty.call(state.request,'revision')&&String(state.request.revision)!==state.revision)throw Error('brief_json revision disagrees with the request sheet revision.');
   if(Object.prototype.hasOwnProperty.call(state.request,'approval')&&state.request.approval!==row.approval)throw Error('brief_json approval disagrees with the request sheet approval.');
   const selected=details.filter(d=>String(d.parent_id)===id&&String(d.revision)===state.revision);
   const recordIds=new Set();state.records=selected.map(d=>{const key=String(d.record_id||'');if(!key||recordIds.has(key))throw Error('Related records need unique record_id values.');recordIds.add(key);const data=JSON.parse(d.data_json);if(!data||typeof data!=='object'||Array.isArray(data))throw Error('data_json must contain an object.');for(const [field,expected]of Object.entries({kind:String(d.kind),record_id:key,parent_id:id,revision:state.revision}))if(Object.prototype.hasOwnProperty.call(data,field)&&String(data[field])!==expected)throw Error('data_json '+field+' disagrees with its record sheet envelope.');return {...data,kind:String(d.kind),record_id:key,parent_id:id,revision:state.revision};});
   state.records.sort((a,b)=>a.record_id.localeCompare(b.record_id));
   state.fingerprint=stable({request:state.request,records:state.records,source_id:id,revision:state.revision,approval:row.approval,designRevision:cfg.designRevision,driveFolderId:cfg.driveFolderId});
   const key=[info.slug,id,state.revision,cfg.driveFolderId].join('|');
   const prior=saved.filter(r=>r.request_key===key);if(prior.length>1)throw Error('Duplicate request ledger key; reconcile before running.');
   const otherPending=pending.filter(r=>r.request_key!==key);
   if(otherPending.length)throw Error('An earlier revision has unfinished paid work. Reconcile its retained job before approving a new revision.');
   if(prior[0]){state.saved=prior[0];state.savedStatus=prior[0].status;state.status='ready';state.ready=true;}
  }catch(error){state.status='review';state.ready=false;state.reason=error.message;state.fingerprint='';if(state.retainedRequests.length)state.decision.retainedRequests=state.retainedRequests;}
  results.push(state);
 }
 return results.length?results:[{status:'skip',ready:false,reason:'The request sheet contains no source rows.',fingerprint:'',artifacts:[]}];
}
function resolveDesign(state){
 const raw=JSON.parse(JSON.stringify(state.project||state.template)),values={...raw.variables,...state.defaults,...state.variables};
 const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function walk(value,key){
  if(Array.isArray(value))return value.map(v=>walk(v,key));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>k!=='variables').map(([k,v])=>[k,walk(v,k)]));
  if(typeof value!=='string')return value;
  const exact=/^\{\{\s*(\w+)\s*\}\}$/.exec(value);
  if(exact){if(!(exact[1]in values))throw Error('Missing design variable '+exact[1]);return values[exact[1]];}
  return value.replace(/\{\{\s*(\w+)\s*\}\}/g,(_,name)=>{if(!(name in values))throw Error('Missing design variable '+name);const v=values[name];if(v!==null&&typeof v==='object')throw Error('Design variable '+name+' must be scalar.');if((state.trustedMarkupVariables||[]).includes(name)){if(!/^\s*<svg[\s>]/i.test(v)||/<\s*(script|foreignObject|iframe|image|use|a)\b|\bon\w+\s*=|(?:href|url)\s*[=(]/i.test(v))throw Error('Unsafe generated diagram '+name);return v;}return ['html','svg','customCode'].includes(key)?escape(v):String(v);});
 }
 const project=walk(raw,'');
 if(/\{\{/.test(JSON.stringify(project)))throw Error('Unresolved project placeholders.');
 return project;
}
function decide(candidates,cfg){
 const report={examined:candidates.length,review:[],skipped:[],alreadyDelivered:0},ready=[];
 for(const c of candidates){
  if(!c.ready){report[c.status==='review'?'review':'skipped'].push({source_id:c.source_id,revision:c.revision,status:c.status,reason:c.reason,retainedRequests:c.retainedRequests||[],decision:c.decision,artifacts:c.artifacts});continue;}
  if(c.saved&&c.saved.input_hash!==c.input_hash){report.review.push({source_id:c.source_id,revision:c.revision,reason:'Approved content changed for an existing revision; increment revision and reconcile any accepted job.',retainedRequests:[{request_key:c.saved.request_key,savedStatus:c.saved.status,jobId:c.saved.job_id||null,videoUrl:c.saved.video_url||null,driveFileId:c.saved.drive_file_id||null,driveUrl:c.saved.drive_url||null}]});continue;}
  if(c.saved?.status==='delivered'&&c.sourceRow.automation_status==='delivered'&&c.sourceRow.input_hash===c.input_hash){report.alreadyDelivered++;continue;}
  ready.push(c);
 }
 ready.sort((a,b)=>Number(Boolean(b.saved))-Number(Boolean(a.saved))||a.source_id.localeCompare(b.source_id));
 if(!ready.length)return {ready:false,status:report.review.length?'needs_review':'nothing_to_render',report,renderSubmitted:false};
 const selected=ready[0];return {...selected,request_key:[selected.workflow_slug,selected.source_id,selected.revision,cfg.driveFolderId].join('|'),report,remaining:ready.length-1};
}
function prepare(state){
 if(state.saved)return {...state.saved};
 const payload=resolveDesign(state);
 return {request_key:state.request_key,workflow_slug:state.workflow_slug,source_id:state.source_id,revision:state.revision,request_period:'',input_hash:state.input_hash,input_json:JSON.stringify({request:state.request,records:state.records}),project_json:JSON.stringify(payload),brief_json:JSON.stringify({title:payload.name||state.workflow_slug,decision:state.decision}),context_json:JSON.stringify({decision:state.decision,artifacts:state.artifacts,report:state.report,variables:state.variables}),delivery_filename:state.workflow_slug+'-'+state.source_id+'-'+state.input_hash.slice(0,24)+'.mp4',status:'new',last_error:''};
}
function checkSource(rows,details,state,cfg){
 const row=rows.find(r=>String(r.source_id)===state.source_id);
 if(rows.filter(r=>String(r.source_id)===state.source_id).length!==1||String(row?.revision)!==state.revision||row.approval!=='approved')throw Error('Request approval or revision changed; the completed asset is retained for review.');
 const records=details.filter(d=>String(d.parent_id)===state.source_id&&String(d.revision)===state.revision).map(d=>({...JSON.parse(d.data_json),kind:String(d.kind),record_id:String(d.record_id),parent_id:state.source_id,revision:state.revision})).sort((a,b)=>a.record_id.localeCompare(b.record_id));
 const fingerprint=stable({request:JSON.parse(row.brief_json),records,source_id:state.source_id,revision:state.revision,approval:row.approval,designRevision:cfg.designRevision,driveFolderId:cfg.driveFolderId});
 return {fingerprint,sourceRow:row};
}
function submissionFailure(item,state,nowISO){
 const now=Date.parse(nowISO);if(!Number.isFinite(now))throw Error('A valid rejection timestamp is required.');
 const error=item?.error&&typeof item.error==='object'?item.error:item?.json?.error&&typeof item.json.error==='object'?item.json.error:null;
 const explicit=error?[error.httpCode,error.statusCode,error.response?.status].filter(v=>v!==undefined&&v!==null):[];
 const status=explicit.length&&explicit.every(v=>String(v)==='429')?429:null;
 if(status!==429||state.job_id||item?.json?.jobId||item?.json?.id)return {...state,status:'submitting',last_error:JSON.stringify({kind:'ambiguous_submission',at:nowISO,message:'Submission outcome is not positively identified as HTTP 429. Reconcile the accepted job before another paid request.'})};
 let previous;try{previous=JSON.parse(state.last_error||'{}');}catch{previous={};}
 const attempts=previous.kind==='rate_limit_rejected'&&Number.isInteger(previous.attempts)?previous.attempts+1:1;
 const headers=error.response?.headers||error.headers||{},raw=headers['retry-after']??headers['Retry-After'];
 const delay=raw!==undefined&&/^\d+(?:\.\d+)?$/.test(String(raw).trim())?Number(raw)*1000:0;
 const date=typeof raw==='string'&&!delay?Date.parse(raw):NaN;
 const retryAt=Math.max(now+30000,now+delay,Number.isFinite(date)?date:0);
 return {...state,status:'rejected',last_error:JSON.stringify({kind:'rate_limit_rejected',httpStatus:429,rejectedAt:nowISO,retryAfter:new Date(retryAt).toISOString(),attempts,maxAttempts:3,message:'The service rejected this request before accepting a job. Run manually after retryAfter; automatic paid retries are disabled.'})};
}
function recoverSubmission(prepared,rows,nowISO,executionMode){
 const found=rows.filter(r=>r.request_key);if(found.length>1)throw Error('Duplicate ledger request_key. Reconcile the ledger before rendering.');
 if(!found.length)return {...prepared,status:'new',job_id:'',video_url:'',drive_file_id:'',drive_url:'',quoted_credits:0};
 const saved=found[0];if(saved.input_hash!==prepared.input_hash)throw Error('The saved request has different content for this revision. Increment revision; do not overwrite its accepted job.');
 if(saved.status==='submitting'&&!saved.job_id)throw Error('Paid submission is ambiguous for '+saved.request_key+'. Reconcile it in https://app.zvid.io and save the accepted job_id before retrying. Automatic resubmission is blocked.');
 if(saved.status==='rejected'&&!saved.job_id&&!saved.video_url){
  let rejection;try{rejection=JSON.parse(saved.last_error);}catch{throw Error('Rejected request has no verified HTTP evidence; reconcile before retrying.');}
  const retryAt=Date.parse(rejection.retryAfter),rejectedAt=Date.parse(rejection.rejectedAt),now=Date.parse(nowISO);
  if(rejection.kind!=='rate_limit_rejected'||rejection.httpStatus!==429||!Number.isInteger(rejection.attempts)||rejection.attempts<1||rejection.maxAttempts!==3||!Number.isFinite(retryAt)||!Number.isFinite(rejectedAt)||retryAt<rejectedAt+30000||!Number.isFinite(now))throw Error('Rejected request has invalid HTTP evidence; reconcile before retrying.');
  if(rejection.attempts>=3)throw Error('Three explicit rate-limit rejections reached the manual retry bound. Reconcile account capacity before resetting this request.');
  if(now<retryAt)throw Error('Rate-limit cooldown has not expired. Retry manually after '+rejection.retryAfter+'.');
  // n8n get-additional-keys maps its internal manual mode to $execution.mode='test'; every other mode is production.
  if(executionMode!=='test')throw Error('An explicitly rejected request can be retried only by a manual execution after its cooldown.');
  return {...prepared,...saved};
 }
 if(!saved.video_url&&!saved.job_id&&saved.status!=='new')throw Error('Incomplete ledger state '+saved.status+'. Reconcile the existing request before retrying.');
 return {...prepared,...saved};
}
function layout(workflow,spec){
 workflow.nodes=workflow.nodes.filter(n=>n.type!==STICKY);const n=name=>workflow.nodes.find(x=>x.name===name),groups=[];
 const blocks=[
  ['Configure the source and recovery ledger','Read approved request rows, related records and saved outcomes. One request is rendered per execution; run each workflow serially.', ['Test manually','Check register hourly','Config','Check source configuration','Ensure publication ledger','Read saved requests','Read source register','Read related records']],
  [spec.stageNames[0],spec.need,['Join approved request data',spec.stageNames[0]]],
  [spec.stageNames[1],spec.outcome,[spec.stageNames[1],spec.stageNames[2],'Fingerprint approved content','Choose one pending revision','Eligible work found?','No work report']],
  ['Freeze the decision and recover paid work','Freeze the business decision and finished design. Recover accepted jobs and completed deliveries. Changed revisions and unknown paid outcomes require reconciliation.', ['Prepare durable request','Look up saved request','Decide recovery','Inspect saved request only?','Saved request inspection','Completed media saved?','Accepted job saved?']],
  ['Validate the designed video and credit ceiling','Native Zvid validation checks the project and quote. Preview returns resolved JSON and the quote without rendering or writing tracking rows.', ['Validate project (free)','Check validation and credit cap','Dry run?','Draft and credit quote']],
  ['Submit once and retain the accepted job','Persist intent before the paid request. Uncertain outcomes stop. Explicit HTTP 429 rejections allow at most two manual retries after cooldown. Save accepted jobs and completed media for recovery.', ['Mark submission pending','Persist submission intent','Submit render once','Capture accepted job','Persist accepted job','Poll saved job context','Wait for completed render','Video result','Persist completed media']],
  ['Retain rejected or uncertain submissions','Capture only structured HTTP evidence. A definite 429 stores a minimum 30-second cooldown and bounded manual retry count. Unknown failures remain ambiguous; inspect the saved job before retrying.', ['Classify submission failure','Persist submission failure','Submission failure report']],
  ['Deliver the video privately','Check deterministic filenames and content hashes before uploading. Preserve completed video URLs when download or delivery fails. No public-sharing action is configured.', ['Delivery context','Find existing delivery','Reconcile delivery file','Delivery file exists?','Download delivery media','Check downloaded media','Upload private review video','Remember delivery','Persist delivery file']],
  ['Verify the source and record the handoff','Recheck approval, revision and content before writing output columns. Read the receipt back before marking the delivery complete.', ['Recheck source revision','Recheck related content','Prepare writeback check','Fingerprint source before writeback','Protect source writeback','Update business register','Read back delivery receipt','Read related receipt content','Prepare receipt check','Fingerprint delivery receipt','Mark delivered','Persist delivered outcome']],
  ['Review the decision report and video','The output includes business decisions and review artifacts as downloadable JSON. Watch video → Binary → data → View plays completed media; failed previews retain the delivered video URL.', ['Business outcome','Decision report file','Completed video available?','Watch video']],
 ];
 let x=0;
 blocks.forEach(([title,text,names],i)=>{
  const columns=Math.ceil(names.length/2),width=columns*260+130,height=930;
  const label=(i+1)+'. '+title;
  const note={id:'studio-'+spec.day+'-section-'+i,name:label,type:STICKY,typeVersion:1,position:[x,0],parameters:{color:7,width,height,content:'## '+label+'\n'+text.split(/\s+/).slice(0,35).join(' ')}};
  workflow.nodes.push(note);
  names.forEach((name,j)=>{const node=n(name);if(!node)throw Error('Missing layout node '+name);node.position=[x+65+Math.floor(j/2)*260,300+(j%2)*285];});
  groups.push({note:label,nodes:names});x+=width+95;
 });
 const overview=`## ${spec.title}\n\n### How it works\n${spec.need} ${spec.outcome} Three named domain stages qualify the source, calculate the business decision and prepare the approved design. The output includes a private video, decision report and a verified source receipt. Saved snapshots recover accepted jobs without paying for a duplicate. Review cases return reasons and draft artifacts.\n\n### Setup\n1. Install **\`@zvid/n8n-nodes-zvid\`** from **Settings → Community nodes** before Zvid credentials. A workspace owner/admin may need to install it.\n2. Create **Zvid API** credentials at https://app.zvid.io/api-keys, Base URL \`https://api.zvid.io\`; assign them to all Zvid nodes. Connect Google Sheets and Google Drive OAuth2.\n3. Configure the workbook, Requests/Records tabs and private Drive folder in **Config**. Requests require source_id, revision, approval and brief_json; Records require parent_id, revision, kind, record_id and data_json. Use the companion \`${spec.slug}.md\` and sample JSON.\n4. **dryRun: false renders and spends credits** within maxRenderCredits. True returns validated JSON and a quote, not an editor draft. Run serially; reconcile ambiguous submissions.\n5. Inspect **Decision report file** and **Watch video → Binary → data → View** before enabling the schedule.\n\n[Zvid setup reference](https://docs.zvid.io). Support: https://zvid.io/contact`;
 workflow.nodes.push({id:'studio-'+spec.day+'-overview',name:'Overview — day '+spec.day,type:STICKY,typeVersion:1,position:[-760,0],parameters:{color:1,width:660,height:1180,content:overview}});
 workflow.meta={templateCredsSetupCompleted:false,seriesTwo:{day:spec.day,slug:spec.slug,groups},studioSeries:{designHash:crypto.createHash('sha256').update(JSON.stringify(spec.template)).digest('hex'),domainStages:spec.stageNames}};
}
function build(spec,template){
 const stub={...spec,description:spec.need,fields:Object.keys(spec.sample.request),transform:'return src;',sample:spec.sample};
 const {workflow}=buildPublicationWorkflow(stub);const nodes=workflow.nodes,n=name=>nodes.find(x=>x.name===name);
 const code=(name,jsCode)=>{n(name).parameters={jsCode};};
 const cfg={spreadsheetId:'',sourceSheet:'D'+spec.day+'Requests',detailsSheet:'D'+spec.day+'Records',driveFolderId:'',dryRun:false,maxRenderCredits:100,pollSeconds:10,maxWaitSeconds:900,maxSourceRows:100,designRevision:crypto.createHash('sha256').update(JSON.stringify(template)).digest('hex')};
 n('Config').parameters.jsonOutput=JSON.stringify(cfg,null,2);
 n('Ensure publication ledger').parameters.tableName='Zvid Studio D'+spec.day+' decision ledger';
 code('Check source configuration','const c=$("Config").first().json;for(const k of ["spreadsheetId","sourceSheet","detailsSheet","driveFolderId"])if(typeof c[k]!=="string"||!c[k].trim())throw Error(k+" must be configured");if(typeof c.dryRun!=="boolean"||!Number.isFinite(c.maxRenderCredits)||c.maxRenderCredits<=0||c.maxRenderCredits>1000)throw Error("Check dryRun and maxRenderCredits");return [{json:c}];');
 const oldPolicy=nodes.find(x=>x.name.startsWith('Apply ')&&x.type==='n8n-nodes-base.code');const oldName=oldPolicy.name;oldPolicy.name='Join approved request data';
 for(const [from,branch]of Object.entries(workflow.connections))for(const edges of branch.main)for(const e of edges)if(e.node===oldName)e.node=oldPolicy.name;
 workflow.connections[oldPolicy.name]=workflow.connections[oldName];delete workflow.connections[oldName];
 code(oldPolicy.name,[stable,intake].map(f=>f.toString()).join('\n')+'\nreturn intake($("Read source register").all().map(i=>i.json),$("Read related records").all().map(i=>i.json),$("Read saved requests").all().map(i=>i.json).filter(x=>x.request_key),$("Config").first().json,'+JSON.stringify({day:spec.day,slug:spec.slug})+','+JSON.stringify(template)+').map(json=>({json}));');
 const wire=(a,b,branch=0)=>{workflow.connections[a]||={main:[]};while(workflow.connections[a].main.length<=branch)workflow.connections[a].main.push([]);workflow.connections[a].main[branch].push({node:b,type:'main',index:0});};
 code('Decide recovery',recoverSubmission.toString()+'\nreturn [{json:recoverSubmission($("Prepare durable request").first().json,$input.all().map(i=>i.json),new Date().toISOString(),$execution.mode)}];');
 n('Submit render once').onError='continueErrorOutput';
 nodes.push({id:'studio-'+spec.day+'-submission-failure',name:'Classify submission failure',type:'n8n-nodes-base.code',typeVersion:2,position:[0,0],parameters:{jsCode:submissionFailure.toString()+'\nreturn [{json:submissionFailure($input.first(),$("Persist submission intent").first().json,new Date().toISOString())}];'}});
 nodes.push({...JSON.parse(JSON.stringify(n('Persist accepted job'))),id:'studio-'+spec.day+'-persist-submission-failure',name:'Persist submission failure'});
 nodes.push({id:'studio-'+spec.day+'-submission-failure-report',name:'Submission failure report',type:'n8n-nodes-base.code',typeVersion:2,position:[0,0],parameters:{jsCode:'const s=$input.first().json;return [{json:{status:s.status==="rejected"?"rate_limit_rejected":"ambiguous_submission",source_id:s.source_id,revision:s.revision,request_key:s.request_key,renderSubmitted:s.status==="rejected"?false:null,acceptedJobId:s.job_id||null,recovery:JSON.parse(s.last_error)}}];'}});
 wire('Submit render once','Classify submission failure',1);wire('Classify submission failure','Persist submission failure');wire('Persist submission failure','Submission failure report');
 workflow.connections[oldPolicy.name]={main:[]};let last=oldPolicy.name;
 spec.stages.forEach((fn,i)=>{
  const name=spec.stageNames[i];nodes.push({id:'studio-'+spec.day+'-domain-'+i,name,type:'n8n-nodes-base.code',typeVersion:2,position:[0,0],parameters:{jsCode:'const stage='+fn.toString()+';return $input.all().map(item=>{const s=item.json;if(s.saved||["review","skip"].includes(s.status))return item;try{const result=stage(s);result.ready=result.status==="ready";return {json:result};}catch(e){return {json:{...s,status:"review",ready:false,reason:e.message}};}});'}});wire(last,name);last=name;
 });wire(last,'Fingerprint approved content');
 code('Choose one pending revision',decide.toString()+'\nreturn [{json:decide($input.all().map(i=>i.json),$("Config").first().json)}];');
 code('No work report','const value=$input.first().json;const file=await this.helpers.prepareBinaryData(Buffer.from(JSON.stringify(value,null,2)),"review-decisions.json","application/json");return [{json:value,binary:{data:file}}];');
 code('Prepare durable request',[resolveDesign,prepare].map(f=>f.toString()).join('\n')+'\nreturn [{json:prepare($input.first().json)}];');
 // The published node may not expose Project→Create on older installed versions.
 // A validation-only preview is accurate on every supported installation.
 const draftNode=n('Save draft to editor');workflow.nodes=nodes.filter(x=>x!==draftNode);
 delete workflow.connections['Save draft to editor'];workflow.connections['Dry run?'].main[0]=[{node:'Draft and credit quote',type:'main',index:0}];
 code('Draft and credit quote','const s=$("Check validation and credit cap").first().json;return [{json:{status:"validated_preview",dryRun:true,renderSubmitted:false,editorDraftSaved:false,quotedCredits:s.quoted_credits,project:JSON.parse(s.project_json),decision:JSON.parse(s.context_json),source_id:s.source_id,revision:s.revision}}];');
 const recheck=source=>[stable,checkSource].map(f=>f.toString()).join('\n')+'\nreturn [{json:checkSource($('+JSON.stringify(source)+').all().map(i=>i.json),$input.all().map(i=>i.json),$("Persist delivery file").first().json,$("Config").first().json)}];';
 code('Prepare writeback check',recheck('Recheck source revision'));code('Prepare receipt check',recheck('Read back delivery receipt'));
 n('Update business register').parameters.columns.value.outcome_summary='={{ JSON.parse($json.context_json).decision.summary || "Decision report and video ready for review" }}';
 code('Business outcome','const s=$input.first().json;return [{json:{status:"delivered",source_id:s.source_id,revision:s.revision,request_key:s.request_key,jobId:s.job_id,videoUrl:s.video_url,driveFileId:s.drive_file_id,driveUrl:s.drive_url,quotedCredits:s.quoted_credits,decisionReport:JSON.parse(s.context_json),outcome:'+JSON.stringify(spec.outcome)+',dryRun:false}}];');
 workflow.nodes.push({id:'studio-'+spec.day+'-decision-file',name:'Decision report file',type:'n8n-nodes-base.code',typeVersion:2,position:[0,0],parameters:{jsCode:'const value=$input.first().json;const file=await this.helpers.prepareBinaryData(Buffer.from(JSON.stringify(value,null,2)),"decision-"+value.source_id+"-"+value.revision+".json","application/json");return [{json:value,binary:{report:file}}];'}});
 workflow.connections['Business outcome']={main:[[{node:'Decision report file',type:'main',index:0}]]};wire('Decision report file','Completed video available?');
 workflow.name='D'+spec.day+' '+spec.title+' (Zvid Studio)';workflow.settings.timezone='Africa/Cairo';workflow.active=false;
 layout(workflow,{...spec,template});assertWorkflow(workflow);return workflow;
}
module.exports={stable,intake,resolveDesign,decide,prepare,checkSource,submissionFailure,recoverSubmission,build,layout};
