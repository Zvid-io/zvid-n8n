'use strict';

// Business intake, durable paid-job recovery and private delivery around the
// tested renderer. The source adapters are deliberately domain-specific.
const { buildPayload, normalizeBrief, normalizeConfig, checkValidationResult, helpers, assertWorkflow } = require('./series-two-framework');
const { adapters, serializeRuntime } = require('./series-two-source-adapters');
const ZVID = '@zvid/n8n-nodes-zvid.zvid';
const STICKY = 'n8n-nodes-base.stickyNote';
const runtime = [...Object.values(helpers), normalizeBrief, normalizeConfig, buildPayload, checkValidationResult].map(f => f.toString()).join('\n');
const ledgerColumns = [
  'request_key','workflow_slug','source_id','revision','request_period','input_hash','input_json','project_json','brief_json','context_json','delivery_filename',
  'status','job_id','video_url','drive_file_id','drive_url','quoted_credits','execution_id','last_error','updated_at',
];
const writebackHeaders = ['automation_status','request_key','input_hash','job_id','video_url','drive_file_id','drive_url','completed_at','outcome_summary','automation_error'];
const schema = headers => headers.map(id => ({ id, displayName:id, required:false, defaultMatch:false, display:true, type:id==='quoted_credits'?'number':id==='updated_at'?'dateTime':'string', canBeUsedToMatch:true }));
const rl = value => ({__rl:true,mode:'id',value});
const bool = (expression, id) => ({conditions:{options:{caseSensitive:true,leftValue:'',typeValidation:'strict',version:2},conditions:[{id,leftValue:expression,rightValue:'',operator:{type:'boolean',operation:'true',singleValue:true}}],combinator:'and'},options:{}});

function chooseRequest(candidates, cfg) {
  const report = { examined:candidates.length, skipped:[], alreadyDelivered:0 };
  const pending=[];
  for (const candidate of candidates) {
    if (!candidate.ready) { report.skipped.push({source_id:candidate.source_id||'',decision:candidate.decision||'skip',reason:candidate.reason}); continue; }
    const request_key = [candidate.workflow_slug,candidate.source_id,candidate.revision,...(candidate.request_period?[candidate.request_period]:[]),cfg.driveFolderId].join('|');
    const prior=candidate.sourceRow||{};
    if (prior.automation_status==='delivered' && prior.request_key===request_key && prior.input_hash===candidate.input_hash && (!candidate.savedStatus||candidate.savedStatus==='delivered')) { report.alreadyDelivered++; continue; }
    if (prior.request_key===request_key && prior.input_hash && prior.input_hash!==candidate.input_hash) throw new Error('Source '+candidate.source_id+' changed without a new revision. Increment revision before requesting new media.');
    pending.push({...candidate,request_key});
  }
  if (!pending.length) return {ready:false,status:'nothing_to_render',reason:'No approved, eligible, undelivered revision.',report,renderSubmitted:false};
  pending.sort((a,b)=>Number(Boolean(b.savedStatus))-Number(Boolean(a.savedStatus))||String(a.source_id).localeCompare(String(b.source_id)));
  return {...pending[0],report,remaining:pending.length-1};
}
function decideRecovery(prepared, rows) {
  const found=rows.filter(r=>r.request_key);
  if(found.length>1) throw new Error('Duplicate ledger request_key. Reconcile the ledger before rendering.');
  if(!found.length) return {...prepared,status:'new',job_id:'',video_url:'',drive_file_id:'',drive_url:'',quoted_credits:0};
  const saved=found[0];
  if(saved.input_hash!==prepared.input_hash) throw new Error('The saved request has different content for this revision. Increment revision; do not overwrite its accepted job.');
  if(saved.status==='submitting'&&!saved.job_id) throw new Error('Paid submission is ambiguous for '+saved.request_key+'. Reconcile it in https://app.zvid.io and save the accepted job_id before retrying. Automatic resubmission is blocked.');
  if(!saved.video_url&&!saved.job_id&&saved.status!=='new') throw new Error('Incomplete ledger state '+saved.status+'. Reconcile the existing request before retrying.');
  return {...prepared,...saved};
}
function completedState(job, context) {
  const result=job.result||job.output||job.returnvalue||{};
  const url=job.outputUrl||job.videoUrl||(typeof result==='string'?result:result.url||result.outputUrl||result.videoUrl);
  const status=String(job.state||job.status||'');
  if(status!=='completed') throw new Error('Accepted job '+context.job_id+' is '+status+'. Retry this saved job; do not resubmit.');
  if(typeof url!=='string'||!/^https:\/\//i.test(url)) throw new Error('Completed job '+context.job_id+' has no HTTPS media URL. Reconcile its upload in https://app.zvid.io; the accepted job is retained.');
  return {...context,status:'completed',video_url:url,last_error:''};
}

function sourceCandidates(day, adapter, sources, details, saved, cfg, nowISO, prepare) {
  if(sources.length>cfg.maxSourceRows||details.length>5000||saved.length>1000) throw new Error('Source or ledger exceeds the safety bound. Archive finished ledger rows or narrow the source tables.');
  const ids=new Set();for(const row of sources){if(ids.has(String(row.source_id)))throw new Error('Duplicate source_id '+row.source_id);ids.add(String(row.source_id));}
  const orphaned=saved.filter(r=>r.workflow_slug===adapter.slug&&r.status!=='delivered'&&r.request_key.endsWith('|'+cfg.driveFolderId)&&!sources.some(row=>String(row.source_id)===r.source_id&&String(row.revision)===r.revision)).map(r=>({ready:false,source_id:r.source_id,decision:'review',reason:'Saved '+r.status+' request '+r.request_key+' has a deleted or revised source. Reconcile retained job '+(r.job_id||'(acceptance unknown)')+' before retiring this request.',fingerprint:''}));
  if(!sources.length)return orphaned.length?orphaned:[{ready:false,reason:'The source register is empty.',fingerprint:''}];
  const outputHeaders=['automation_status','request_key','input_hash','job_id','video_url','drive_file_id','drive_url','completed_at','outcome_summary','automation_error'];
  const primaryHeaders=adapter.primaryHeaders.filter(k=>!outputHeaders.includes(k));
  const pick=(row,headers)=>Object.fromEntries(headers.map(key=>[key,row[key]===undefined?'':row[key]]));
  const keyFor=(row,period)=>[adapter.slug,row.source_id,row.revision,...(period?[period]:[]),cfg.driveFolderId].join('|');
  const candidates=sources.map(row=>{
    const period=adapter.refreshPeriod==='day'?nowISO.slice(0,10):'';
    const currentKey=keyFor(row,period);
    const pending=saved.filter(r=>r.workflow_slug===adapter.slug&&r.source_id===String(row.source_id)&&r.revision===String(row.revision)&&r.status!=='delivered'&&r.request_key.endsWith('|'+cfg.driveFolderId));
    if(pending.length>1) throw new Error('Multiple pending requests for '+row.source_id+'. Reconcile before rendering.');
    const matches=saved.filter(r=>r.request_key===currentKey);
    if(matches.length>1)throw new Error('Duplicate ledger request_key '+currentKey);
    const existing=pending[0]||matches[0];
    const request_period=existing?existing.request_period||'':period;
    let policyRow=row;
    if(day===57){
      const historical=saved.filter(r=>r.workflow_slug===adapter.slug&&r.source_id===String(row.source_id)&&r.status==='delivered'&&r.request_key.endsWith('|'+cfg.driveFolderId));
      const previous=Math.max(Number(row.lastBriefedMilestone)||0,...historical.map(r=>Number(JSON.parse(r.context_json).milestonePercent)||0));
      policyRow={...row,lastBriefedMilestone:previous};
    }
    const prepared=prepare(day,policyRow,details,nowISO);
    const recovering=!!existing&&prepared.decision!=='review';
    const joined=details.filter(d=>String(d.parent_id)===String(row.source_id)&&String(d.revision)===String(row.revision)).map(d=>pick(d,adapter.detailHeaders)).sort((a,b)=>String(a.kind).localeCompare(String(b.kind))||Number(a.position)-Number(b.position));
    const fingerprint=JSON.stringify({record:pick(row,primaryHeaders),details:joined,period:request_period,brand:cfg.brandName,color:cfg.accentColor,seconds:cfg.sceneSeconds,layout:'business-v1'});
    return {...prepared,source_id:prepared.sourceId,request_period,ready:prepared.decision==='ready'||recovering,workflow_slug:adapter.slug,sourceRow:row,savedStatus:existing?existing.status:'',input:recovering?JSON.parse(existing.input_json):prepared.input,context:recovering?JSON.parse(existing.context_json):prepared.context,fingerprint};
  });
  return [...candidates,...orphaned];
}

function buildPublicationWorkflow(spec) {
  const adapter=adapters[spec.day];
  if(!adapter) throw new Error('Missing business adapter for day '+spec.day);
  const cfg={spreadsheetId:'',sourceSheet:'D'+spec.day+'Source',detailsSheet:'D'+spec.day+'Details',driveFolderId:'',
    brandName:'Zvid',accentColor:['#D8F17C','#FFCD8B','#A7DDD8','#D7C2F3','#F5ADA1','#ADD4FF'][(spec.day-31)%6],
    dryRun:false,maxRenderCredits:30,sceneSeconds:6,pollSeconds:5,maxWaitSeconds:600,maxSourceRows:500};
  const nodes=[], connections={},groups=[];
  let i=0;
  const versions={set:3.4,if:2.2,code:2,manualTrigger:1,scheduleTrigger:1.3,googleSheets:4.7,googleDrive:3,dataTable:1.1,crypto:1,httpRequest:2,stickyNote:1};
  const add=(name,type,parameters={},extra={})=>{const n={id:'zvid-business-'+spec.day+'-'+String(++i).padStart(2,'0'),name,type,typeVersion:type===ZVID?1:versions[type.split('.').pop()]||1,position:[0,0],parameters,...extra};nodes.push(n);return n;};
  const code=(name,jsCode)=>add(name,'n8n-nodes-base.code',{jsCode});
  const wire=(from,to,branch=0)=>{connections[from] ||= {main:[]};while(connections[from].main.length<=branch)connections[from].main.push([]);connections[from].main[branch].push({node:to,type:'main',index:0});};
  const chain=(...names)=>names.slice(1).forEach((name,index)=>wire(names[index],name));
  const group=(title,text,names,x,y,columns=3)=>{
    const rows=Math.ceil(names.length/columns),width=columns*250+130,height=rows*230+170;
    const note=add(title,STICKY,{color:7,width,height,content:'## '+title+'\n'+text});note.position=[x,y];
    names.forEach((name,j)=>nodes.find(n=>n.name===name).position=[x+65+(j%columns)*250,y+170+Math.floor(j/columns)*230]);
    groups.push({note:title,nodes:names});return {width,height};
  };
  const sheet=(name,tab,extra={})=>add(name,'n8n-nodes-base.googleSheets',{authentication:'oAuth2',resource:'sheet',operation:'read',documentId:rl('={{ $("Config").first().json.spreadsheetId }}'),sheetName:{__rl:true,mode:'name',value:'={{ $("Config").first().json.'+tab+' }}'},options:{returnFirstMatch:false,outputFormatting:{values:{general:'UNFORMATTED_VALUE',date:'FORMATTED_STRING'}}},...extra},{executeOnce:true,alwaysOutputData:true,retryOnFail:true,maxTries:3,waitBetweenTries:1000});
  const upsert=(name)=>add(name,'n8n-nodes-base.dataTable',{resource:'row',operation:'upsert',dataTableId:rl('={{ $("Ensure publication ledger").first().json.id }}'),matchType:'allConditions',filters:{conditions:[{keyName:'request_key',condition:'eq',keyValue:'={{ $json.request_key }}'}]},columns:{mappingMode:'defineBelow',value:Object.fromEntries(ledgerColumns.map(k=>[k,k==='execution_id'?'={{ $execution.id }}':k==='updated_at'?'={{ $now.toISO() }}':k==='quoted_credits'?'={{ Number($json.quoted_credits || 0) }}':'={{ $json.'+k+' || "" }}'])),schema:schema(ledgerColumns)},options:{}});
  add('Test manually','n8n-nodes-base.manualTrigger');
  add('Check register hourly','n8n-nodes-base.scheduleTrigger',{rule:{interval:[{field:'hours',hoursInterval:1,triggerAtMinute:(spec.day-31)*2%60}]}});
  add('Config','n8n-nodes-base.set',{mode:'raw',jsonOutput:JSON.stringify(cfg,null,2),includeOtherFields:false,options:{}});
  code('Check source configuration',`const cfg=$("Config").first().json;for(const field of ['spreadsheetId','sourceSheet','detailsSheet','driveFolderId'])if(typeof cfg[field]!=='string'||!cfg[field].trim())throw new Error(field+' must be configured.');if(!Number.isInteger(cfg.maxSourceRows)||cfg.maxSourceRows<1||cfg.maxSourceRows>1000)throw new Error('maxSourceRows must be 1–1000');return [{json:cfg}];`);
  sheet('Read source register','sourceSheet'); sheet('Read related records','detailsSheet');
  const policyOutput=spec.day===57?`.map(json=>{if(!json.savedStatus&&json.context&&json.sourceRow){json.context.effectiveLastBriefedMilestone=json.context.record.lastBriefedMilestone;json.context.record=Object.fromEntries(${JSON.stringify(adapter.primaryHeaders.filter(k=>!writebackHeaders.includes(k)))}.map(key=>[key,json.sourceRow[key]===undefined?'':json.sourceRow[key]]));}return {json};});`:'.map(json=>({json}));';
  code('Apply '+spec.slug.split('-').slice(0,2).join(' ')+' policy',serializeRuntime(spec.day)+'\n'+sourceCandidates.toString()+`\nreturn sourceCandidates(${spec.day},${JSON.stringify(adapter)},$("Read source register").all().map(i=>i.json).filter(r=>r.source_id),$("Read related records").all().map(i=>i.json).filter(r=>r.parent_id),$("Read saved requests").all().map(i=>i.json).filter(r=>r.request_key),$("Config").first().json,new Date().toISOString(),prepareSource)`+policyOutput);
  const policy=nodes.at(-1).name;
  add('Fingerprint approved content','n8n-nodes-base.crypto',{action:'hash',type:'SHA256',value:'={{ $json.fingerprint }}',dataPropertyName:'input_hash',encoding:'hex'});
  code('Choose one pending revision',chooseRequest.toString()+'\nreturn [{json:chooseRequest($input.all().map(i=>i.json),$("Config").first().json)}];');
  add('Eligible work found?','n8n-nodes-base.if',bool('={{ $json.ready === true }}','eligible-'+spec.day));
  code('No work report','return [{json:$input.first().json}];');
  code('Prepare durable request',runtime+`\nconst selected=$input.first().json;const cfg=normalizeConfig($("Config").first().json);const transform=src=>{${spec.transform}\n};const brief=normalizeBrief(transform(selected.input));if(brief.skip)throw new Error('Approved source unexpectedly has no renderable content: '+brief.reason);const project=buildPayload(brief,cfg,${JSON.stringify({slug:spec.slug,day:spec.day})});return [{json:{request_key:selected.request_key,workflow_slug:selected.workflow_slug,source_id:selected.source_id,revision:String(selected.revision),request_period:selected.request_period||'',input_hash:selected.input_hash,input_json:JSON.stringify(selected.input),project_json:JSON.stringify(project),brief_json:JSON.stringify(brief),context_json:JSON.stringify(selected.context),delivery_filename:'D${spec.day}-'+String(selected.source_id).replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,60)+'-'+selected.input_hash.slice(0,24)+'.mp4',status:'new',last_error:''}}];`);
  add('Ensure publication ledger','n8n-nodes-base.dataTable',{resource:'table',operation:'create',tableName:'Zvid D'+spec.day+' business delivery ledger',columns:{column:ledgerColumns.filter(k=>!['execution_id','updated_at'].includes(k)).map(name=>({name,type:name==='quoted_credits'?'number':'string'})).concat([{name:'execution_id',type:'string'},{name:'updated_at',type:'date'}])},options:{createIfNotExists:true}});
  add('Read saved requests','n8n-nodes-base.dataTable',{resource:'row',operation:'get',dataTableId:rl('={{ $("Ensure publication ledger").first().json.id }}'),matchType:'allConditions',filters:{conditions:[]},returnAll:true},{alwaysOutputData:true});
  add('Look up saved request','n8n-nodes-base.dataTable',{resource:'row',operation:'get',dataTableId:rl('={{ $("Ensure publication ledger").first().json.id }}'),matchType:'allConditions',filters:{conditions:[{keyName:'request_key',condition:'eq',keyValue:'={{ $("Prepare durable request").first().json.request_key }}'}]},returnAll:false,limit:2},{alwaysOutputData:true});
  code('Decide recovery',decideRecovery.toString()+'\nreturn [{json:decideRecovery($("Prepare durable request").first().json,$input.all().map(i=>i.json))}];');
  add('Inspect saved request only?','n8n-nodes-base.if',bool('={{ $("Config").first().json.dryRun === true && $json.status !== "new" }}','inspect-'+spec.day));
  code('Saved request inspection','const state=$input.first().json;return [{json:{status:"saved_request_inspection",dryRun:true,renderSubmitted:false,deliveryAttempted:false,savedStatus:state.status,jobId:state.job_id||null,videoUrl:state.video_url||null,driveUrl:state.drive_url||null,source_id:state.source_id,revision:state.revision,quotedCredits:state.quoted_credits,brief:JSON.parse(state.brief_json)}}];');
  add('Completed media saved?','n8n-nodes-base.if',bool('={{ typeof $json.video_url === "string" && $json.video_url.startsWith("https://") }}','completed-'+spec.day));
  add('Accepted job saved?','n8n-nodes-base.if',bool('={{ Boolean($json.job_id) }}','accepted-'+spec.day));
  add('Validate project (free)',ZVID,{resource:'render',operation:'validate',source:'json',projectJson:'={{ $json.project_json }}',additionalFields:{}});
  code('Check validation and credit cap',runtime+'\nconst state=$("Decide recovery").first().json;const checked=checkValidationResult($input.first().json,{payload:JSON.parse(state.project_json)},normalizeConfig($("Config").first().json));return [{json:{...state,quoted_credits:checked.quotedCredits,project_json:JSON.stringify(checked.payload)}}];');
  add('Dry run?','n8n-nodes-base.if',bool('={{ $("Config").first().json.dryRun === true }}','dry-'+spec.day));
  add('Save draft to editor',ZVID,{resource:'project',operation:'create',projectName:'={{ JSON.parse($json.brief_json).title }}',projectJson:'={{ $json.project_json }}'},{onError:'continueRegularOutput',alwaysOutputData:true});
  code('Draft and credit quote','const saved=$input.first().json;const state=$("Check validation and credit cap").first().json;const p=saved.project||saved;const id=p.id||p.projectId;const editorLink=typeof id==="string"&&/^prj_[a-zA-Z0-9_-]+$/.test(id)?"https://editor.zvid.io/?project="+encodeURIComponent(id):null;return [{json:{status:editorLink?"draft":"draft_unavailable",dryRun:true,renderSubmitted:false,editorDraftSaved:!!editorLink,editorLink,editorDraftError:saved.error?String(saved.error.message||saved.error).slice(0,500):null,source_id:state.source_id,revision:state.revision,quotedCredits:state.quoted_credits,brief:JSON.parse(state.brief_json)}}];');
  code('Mark submission pending','return [{json:{...$input.first().json,status:"submitting"}}];'); upsert('Persist submission intent');
  add('Submit render once',ZVID,{resource:'render',operation:'create',renderType:'video',source:'json',projectJson:'={{ $json.project_json }}',waitForCompletion:false,additionalFields:{}});
  code('Capture accepted job','const result=$input.first().json;const job_id=result.jobId||result.id;if(typeof job_id!=="string"||!job_id)throw new Error("Paid response has no job ID. Reconcile the persisted submitting request before retrying.");return [{json:{...$("Persist submission intent").first().json,status:"accepted",job_id}}];'); upsert('Persist accepted job');
  code('Poll saved job context','return [{json:$input.first().json}];');
  add('Wait for completed render',ZVID,{resource:'render',operation:'get',jobId:'={{ $json.job_id }}',waitForCompletion:true,waitOptions:{pollInterval:'={{ $("Config").first().json.pollSeconds }}',maxWaitTime:'={{ $("Config").first().json.maxWaitSeconds }}'}});
  code('Video result',completedState.toString()+'\nreturn [{json:completedState($input.first().json,$("Poll saved job context").first().json)}];');upsert('Persist completed media');
  code('Delivery context','const state=$input.first().json;if(typeof state.video_url!=="string"||!state.video_url.startsWith("https://"))throw new Error("A completed HTTPS video is required for delivery");return [{json:state}];');
  add('Find existing delivery','n8n-nodes-base.googleDrive',{authentication:'oAuth2',resource:'fileFolder',operation:'search',searchMethod:'query',queryString:'={{ "name = "+String.fromCharCode(39)+$("Delivery context").first().json.delivery_filename+String.fromCharCode(39) }}',returnAll:false,limit:2,filter:{driveId:{__rl:true,mode:'list',value:'My Drive'},folderId:rl('={{ $("Config").first().json.driveFolderId }}'),whatToSearch:'files',includeTrashed:false},options:{fields:['id','name','mimeType','webViewLink','appProperties']}},{alwaysOutputData:true,retryOnFail:true,maxTries:3,waitBetweenTries:1000});
  code('Reconcile delivery file','const matches=$input.all().map(i=>i.json).filter(r=>r.id);if(matches.length>1)throw new Error("Multiple delivery files match this request. Reconcile before uploading.");const state=$("Delivery context").first().json;if(matches[0]&&matches[0].mimeType!=="video/mp4")throw new Error("Existing delivery is not an MP4");if(matches[0]&&(!matches[0].appProperties||matches[0].appProperties.zvid_request_hash!==state.input_hash))throw new Error("Existing delivery has missing or different request metadata. Verify the file and reconcile its zvid_request_hash before retrying; automatic upload is blocked.");return [{json:{...state,existingDelivery:!!matches.length,...(matches[0]?{drive_file_id:matches[0].id,drive_url:matches[0].webViewLink||"https://drive.google.com/file/d/"+matches[0].id+"/view"}:{drive_file_id:"",drive_url:""})}}];');
  add('Delivery file exists?','n8n-nodes-base.if',bool('={{ $json.existingDelivery === true }}','file-'+spec.day));
  add('Download delivery media','n8n-nodes-base.httpRequest',{url:'={{ $json.video_url }}',responseFormat:'file',dataPropertyName:'data',options:{timeout:30000}},{retryOnFail:true,maxTries:3,waitBetweenTries:5000});
  code('Check downloaded media','const item=$input.first();const data=item.binary&&item.binary.data;if(!data||String(data.mimeType||"").split(";")[0]!=="video/mp4")throw new Error("Delivery download did not produce MP4 binary data. The completed URL is retained in the ledger.");return [{json:$("Delivery context").first().json,binary:item.binary}];');
  add('Upload private review video','n8n-nodes-base.googleDrive',{authentication:'oAuth2',resource:'file',operation:'upload',inputDataFieldName:'data',name:'={{ $json.delivery_filename }}',driveId:{__rl:true,mode:'list',value:'My Drive'},folderId:rl('={{ $("Config").first().json.driveFolderId }}'),options:{simplifyOutput:false,appPropertiesUi:{appPropertyValues:[{key:'zvid_request_hash',value:'={{ $json.input_hash }}'}]}}});
  code('Remember delivery','const current=$input.first().json;const state=current.request_key?current:$("Delivery context").first().json;const id=current.drive_file_id||current.id;if(typeof id!=="string"||!id)throw new Error("Drive returned no file ID; search the saved deterministic filename before retrying.");return [{json:{...state,status:"uploaded",drive_file_id:id,drive_url:current.drive_url||current.webViewLink||"https://drive.google.com/file/d/"+id+"/view",last_error:""}}];');upsert('Persist delivery file');
  sheet('Recheck source revision','sourceSheet',{filtersUI:{values:[{lookupColumn:'source_id',lookupValue:'={{ $("Persist delivery file").first().json.source_id }}'}]},combineFilters:'AND'});
  sheet('Recheck related content','detailsSheet');
  const recheckCode=sourceName=>serializeRuntime(spec.day)+'\n'+sourceCandidates.toString()+`\nconst state=$("Persist delivery file").first().json;const rows=$(${JSON.stringify(sourceName)}).all().map(i=>i.json).filter(r=>r.source_id);if(rows.length!==1||String(rows[0].revision)!==String(state.revision))throw new Error('Source row was deleted, duplicated or revised during rendering. The uploaded asset is retained.');return sourceCandidates(${spec.day},${JSON.stringify(adapter)},rows,$input.all().map(i=>i.json).filter(r=>r.parent_id),[state],$("Config").first().json,new Date().toISOString(),prepareSource).map(json=>({json}));`;
  code('Prepare writeback check',recheckCode('Recheck source revision'));
  add('Fingerprint source before writeback','n8n-nodes-base.crypto',{action:'hash',type:'SHA256',value:'={{ $json.fingerprint }}',dataPropertyName:'input_hash',encoding:'hex'});
  code('Protect source writeback','const state=$("Persist delivery file").first().json;const current=$input.first().json;if(current.input_hash!==state.input_hash)throw new Error("Source business content changed during rendering. The uploaded asset is retained; increment revision and reconcile the old request.");return [{json:state}];');
  add('Update business register','n8n-nodes-base.googleSheets',{authentication:'oAuth2',resource:'sheet',operation:'update',documentId:rl('={{ $("Config").first().json.spreadsheetId }}'),sheetName:{__rl:true,mode:'name',value:'={{ $("Config").first().json.sourceSheet }}'},columns:{mappingMode:'defineBelow',matchingColumns:['source_id'],value:{source_id:'={{ $json.source_id }}',automation_status:'delivered',request_key:'={{ $json.request_key }}',input_hash:'={{ $json.input_hash }}',job_id:'={{ $json.job_id }}',video_url:'={{ $json.video_url }}',drive_file_id:'={{ $json.drive_file_id }}',drive_url:'={{ $json.drive_url }}',completed_at:'={{ $now.toISO() }}',outcome_summary:adapter.outcome,automation_error:''},schema:schema(['source_id',...writebackHeaders]),attemptToConvertTypes:false,convertFieldsToString:true},options:{cellFormat:'RAW'}},{retryOnFail:true,maxTries:3,waitBetweenTries:1000});
  sheet('Read back delivery receipt','sourceSheet',{filtersUI:{values:[{lookupColumn:'source_id',lookupValue:'={{ $("Persist delivery file").first().json.source_id }}'}]},combineFilters:'AND'});
  sheet('Read related receipt content','detailsSheet');
  code('Prepare receipt check',recheckCode('Read back delivery receipt'));
  add('Fingerprint delivery receipt','n8n-nodes-base.crypto',{action:'hash',type:'SHA256',value:'={{ $json.fingerprint }}',dataPropertyName:'input_hash',encoding:'hex'});
  code('Mark delivered','const state=$("Protect source writeback").first().json;const current=$input.first().json;const row=current.sourceRow||{};if(current.input_hash!==state.input_hash||String(row.revision)!==String(state.revision)||row.automation_status!=="delivered"||row.request_key!==state.request_key||row.input_hash!==state.input_hash||row.video_url!==state.video_url||row.drive_url!==state.drive_url||row.drive_file_id!==state.drive_file_id||row.job_id!==state.job_id)throw new Error("Source delivery receipt did not match the saved request and frozen content. The uploaded asset is retained for retry.");return [{json:{...state,status:"delivered",last_error:""}}];');upsert('Persist delivered outcome');
  code('Business outcome','const state=$input.first().json;return [{json:{status:"delivered",source_id:state.source_id,revision:state.revision,request_key:state.request_key,jobId:state.job_id,videoUrl:state.video_url,driveFileId:state.drive_file_id,driveUrl:state.drive_url,quotedCredits:state.quoted_credits,brief:JSON.parse(state.brief_json),context:JSON.parse(state.context_json),outcome:'+JSON.stringify(adapter.outcome)+',dryRun:false}}];');
  add('Completed video available?','n8n-nodes-base.if',bool('={{ $json.status === "delivered" && $json.dryRun === false && typeof $json.videoUrl === "string" && $json.videoUrl.startsWith("https://") }}','watch-'+spec.day));
  add('Watch video','n8n-nodes-base.httpRequest',{url:'={{ $json.videoUrl }}',responseFormat:'file',dataPropertyName:'data',options:{timeout:30000}},{retryOnFail:true,maxTries:3,waitBetweenTries:5000,onError:'continueRegularOutput'});
  chain('Test manually','Config','Check source configuration','Ensure publication ledger','Read saved requests','Read source register','Read related records',policy,'Fingerprint approved content','Choose one pending revision','Eligible work found?');wire('Check register hourly','Config');wire('Eligible work found?','No work report',1);
  chain('Eligible work found?','Prepare durable request','Look up saved request','Decide recovery','Inspect saved request only?');wire('Inspect saved request only?','Saved request inspection');wire('Inspect saved request only?','Completed media saved?',1);wire('Completed media saved?','Delivery context');wire('Completed media saved?','Accepted job saved?',1);wire('Accepted job saved?','Poll saved job context');wire('Accepted job saved?','Validate project (free)',1);
  chain('Validate project (free)','Check validation and credit cap','Dry run?');chain('Dry run?','Save draft to editor','Draft and credit quote');wire('Dry run?','Mark submission pending',1);
  chain('Mark submission pending','Persist submission intent','Submit render once','Capture accepted job','Persist accepted job','Poll saved job context','Wait for completed render','Video result','Persist completed media','Delivery context','Find existing delivery','Reconcile delivery file','Delivery file exists?');
  wire('Delivery file exists?','Remember delivery');wire('Delivery file exists?','Download delivery media',1);chain('Download delivery media','Check downloaded media','Upload private review video','Remember delivery','Persist delivery file','Recheck source revision','Recheck related content','Prepare writeback check','Fingerprint source before writeback','Protect source writeback','Update business register','Read back delivery receipt','Read related receipt content','Prepare receipt check','Fingerprint delivery receipt','Mark delivered','Persist delivered outcome','Business outcome','Completed video available?','Watch video');
  group('1. Configure and read saved state','Manual and staggered hourly runs use the same private source and destination. Check configuration, create the Data Table when needed, and read saved requests before choosing new work. One record is processed per execution.',['Test manually','Check register hourly','Config','Check source configuration','Ensure publication ledger','Read saved requests'],0,0);
  group('2. Join and qualify a useful brief',adapter.policyShort||'Join the approved source revision to related rows, apply eligibility and timing rules, then compare its content fingerprint. Review and empty queues produce explicit reasons before paid work.',['Read source register','Read related records',policy,'Fingerprint approved content','Choose one pending revision','Eligible work found?','No work report','Prepare durable request'],1000,0);
  group('3. Recover durable state','Use frozen inputs and accepted jobs from the Data Table. Resume pending work even after its notice window expires. Changed content needs a new revision. Ambiguous paid responses stop for reconciliation. Saved media retries delivery; saved job IDs resume polling.',['Look up saved request','Decide recovery','Completed media saved?','Accepted job saved?'],2000,0);
  group('4. Validate and preview a draft','Free validation supplies the quote and enforces the credit cap. dryRun=true attempts a fresh editor draft or inspects saved state, without submitting paid work, uploading files or marking delivery.',['Inspect saved request only?','Saved request inspection','Validate project (free)','Check validation and credit cap','Dry run?','Save draft to editor','Draft and credit quote'],3000,0);
  group('5. Submit and checkpoint','Save intent before the nonretrying paid request, then persist the accepted job immediately. A lost acceptance response requires reconciliation. Polling retries reuse the saved job instead of paying for another render.',['Mark submission pending','Persist submission intent','Submit render once','Capture accepted job','Persist accepted job','Poll saved job context'],0,1100);
  group('6. Retain completed media','Poll within the configured budget. A timeout or missing upload retains the job for investigation. Only completed HTTPS media enters delivery, and its URL is saved before any file operation.',['Wait for completed render','Video result','Persist completed media','Delivery context'],1000,1100);
  group('7. Deliver a private asset','Search by deterministic filename and folder before uploading. Reuse an MP4 only when its saved content hash matches. Downloads are ordinary media GETs; supported Zvid operations use native nodes. Failed uploads are reconciled on the next run.',['Find existing delivery','Reconcile delivery file','Delivery file exists?','Download delivery media','Check downloaded media','Upload private review video'],2000,1100);
  group('8. Protect the business source','Persist the Drive ID and reread both registers. Compare their content fingerprint with the frozen request before writeback. Deleted, revised or edited sources stop with the uploaded asset retained.',['Remember delivery','Persist delivery file','Recheck source revision','Recheck related content','Prepare writeback check','Fingerprint source before writeback','Protect source writeback'],3000,1100);
  group('9. Verify the handoff receipt','Write delivery columns, then reread the source and related rows. Only a matching revision, content fingerprint, job and file receipt marks the ledger delivered. Failed verification retains the upload for retry.',['Update business register','Read back delivery receipt','Read related receipt content','Prepare receipt check','Fingerprint delivery receipt','Mark delivered'],4000,1100);
  group('10. Review the recorded outcome','The ledger and source register retain the result and private Drive link. Review Watch video → Binary → data → View. Preview retries are bounded; a failed preview leaves the completed delivery intact.',['Persist delivered outcome','Business outcome','Completed video available?','Watch video'],5000,1100);
  const overview='## '+spec.title+'\n\n### How it works\n'+adapter.need+' '+adapter.outcome+' The workflow reads a source register and related rows, applies its approval and eligibility rules, and creates a concise review video. Fingerprints suppress completed revisions; a Data Table retains accepted jobs and delivery checkpoints. Retries resume polling or delivery. An ambiguous paid response requires reconciliation. Each execution handles one record.\n\n### Setup\n1. Install **`@zvid/n8n-nodes-zvid`** from **Settings → Community nodes** before Zvid credentials; a workspace owner/admin may need to install it.\n2. Create **Zvid API** credentials at https://app.zvid.io/api-keys, Base URL `https://api.zvid.io`; select them on all Zvid nodes. Connect **Google Sheets** and **Google Drive OAuth2**.\n3. In **Config**, set spreadsheetId, sourceSheet, detailsSheet and driveFolderId. Create the domain columns and delivery headers from the included `'+spec.slug+'.md` guide. Keep source_id unique and increment revision for changed content.\n4. **`dryRun: false` renders and spends credits** within maxRenderCredits. True returns an editor draft attempt and quote.\n5. Run manually once, inspect the Drive asset and register update, then enable the hourly trigger. Avoid parallel manual runs. **Watch video → Binary → data → View** previews completed media.\n\n[Zvid setup reference](https://docs.zvid.io). Support: https://zvid.io/contact';
  const ov=add('Overview — day '+spec.day,STICKY,{color:1,width:660,height:1140,content:overview});ov.position=[-760,0];
  const workflow={name:'Day '+spec.day+' · '+spec.title+' (Zvid)',nodes,connections,pinData:{},active:false,settings:{executionOrder:'v1',executionTimeout:1500,timezone:'UTC'},meta:{templateCredsSetupCompleted:false,seriesTwo:{day:spec.day,slug:spec.slug,groups,businessUpgrade:true}}};
  assertWorkflow(workflow);
  return {workflow,doc:buildPublicationDoc(spec,adapter,cfg)};
}

function buildPublicationDoc(spec,adapter,cfg) {
  const now='2026-10-01T12:00:00.000Z';
  const sample=require('./series-two-source-adapters').fixtureFor(spec.day,now);
  const exampleRow=(row,headers)=>Object.fromEntries(headers.map(header=>[header,row[header]===undefined?'':row[header]]));
  const primaryExample=exampleRow(sample.primary,adapter.primaryHeaders);
  const detailExamples=sample.details.slice(0,5).map(row=>exampleRow(row,adapter.detailHeaders));
  const refresh=adapter.refreshPeriod==='day'
    ? 'This is a daily snapshot. The request key includes the UTC reporting date, so an unchanged approved revision may produce one new eligible snapshot on the next UTC day. Within that day, a delivered fingerprint is suppressed. A pending request from an earlier day resumes its frozen reporting period before fresh work is selected. Change business inputs with a new revision; a new day does not permit editing the content of an already recorded request.'
    : 'This is an event workflow: one request is created per approved source revision and destination folder. An unchanged delivered revision is suppressed. Increment the primary revision and every related row revision when business content or rendering configuration changes; changing an approval cell alone is not a new content version.';
  const milestone=spec.day===57
    ? '\n\nFor fundraising milestones, the policy uses the larger of the source `lastBriefedMilestone` and delivered milestones retained for the same immutable campaign source ID and destination folder. Keep this Data Table history when a campaign revision changes. The authoritative context keeps the actual source cell in `record.lastBriefedMilestone` and records the history-derived threshold separately as `effectiveLastBriefedMilestone`. Only a newly crossed settled-contribution milestone qualifies.'
    : '';
  const sampleNote=sample.details.length>5
    ? 'The example shows the first five of '+sample.details.length+' related rows. It illustrates the column schema; use the full related-record set for a runnable source.'
    : sample.details.length ? 'The example shows all '+sample.details.length+' related rows for this synthetic record.' : 'This use case can qualify without related rows. Keep the related tab and its headers for the join and safety checks.';
  return [
    '# Day '+spec.day+': '+spec.title,
    adapter.need,
    '## Business outcome',
    adapter.outcome+' This template delivers a private asset for the use-case team and verifies its source-register receipt. The business owner reviews the asset before customer messaging or public publication.',
    '## Why these steps are needed',
    adapter.policy||adapter.policyShort||spec.rules,
    'Source acquisition and joins prevent hand-copying a prepared video payload. Eligibility prevents misleading or stale notices. Fingerprints suppress completed content. Durable checkpoints retain accepted jobs through retries. Drive reconciliation recovers uploads whose response was lost. Source and detail rechecks protect writeback. Each step supports the business handoff.',
    '## Setup',
    '1. Install **`@zvid/n8n-nodes-zvid`** in **Settings → Community nodes**; a workspace owner/admin may need to install it before configuring Zvid credentials.\n2. Create **Zvid API** credentials using https://app.zvid.io/api-keys and Base URL `https://api.zvid.io`. Connect Google Sheets and Google Drive OAuth2 credentials.\n3. Create a private output folder and a workbook with `'+cfg.sourceSheet+'` and `'+cfg.detailsSheet+'`. The primary row describes one source revision; details join by the exact `parent_id` and `revision`. All headers are case-sensitive.\n4. Configure IDs and tab names in **Config**. Keep `source_id` immutable and unique. The workflow handles one eligible request per execution, ordered by source ID, and reports remaining queue size.\n5. Test manually, inspect the Drive asset and register receipt, then activate the staggered hourly schedule. Avoid overlapping manual runs. The 25-minute execution timeout is below the hourly interval; stagger templates within the Zvid account render quota.',
    'The workflow reads the two Google Sheets registers shown below. If your system of record is elsewhere, populate these scalar columns from that system before running this template. Keep a real, authorized `source_url` for provenance; the illustrative example URL is not a production source.',
    '### Source headers',
    '```text\n'+adapter.primaryHeaders.join(', ')+'\n```',
    '### Related-record headers',
    '```text\n'+adapter.detailHeaders.join(', ')+'\n```',
    '### Required delivery headers on the source tab',
    '```text\n'+writebackHeaders.join(', ')+'\n```',
    adapter.schemaDescription||'Use explicit scalar columns, approved source data and stable source/revision IDs. Related records must match the selected revision. Business `status` and `approval` remain separate from the automation delivery columns.',
    '### Illustrative source record',
    'These are synthetic examples evaluated at `'+now+'`, not a public factual claim. Replace identities, dates, values and the source URL with authorized data, and set dates for the intended execution window. Each key below is a separate Sheets column; do not paste the JSON into one cell. Delivery columns start blank.',
    '```json\n'+JSON.stringify(primaryExample,null,2)+'\n```',
    '### Illustrative related records',
    sampleNote+' Each object is one row. Blank fields belong to other supported detail kinds in this tab.',
    '```json\n'+JSON.stringify(detailExamples,null,2)+'\n```',
    '## Configuration and preview',
    '```json\n'+JSON.stringify(cfg,null,2)+'\n```',
    '`dryRun: false` renders and spends credits. Free validation checks the schema and quote before submission and rejects quotes above `maxRenderCredits`. For a fresh request, `dryRun: true` attempts an editable project and returns a free render quote; a full editor-project quota returns `draft_unavailable` while retaining the quote. For saved accepted, completed or uploaded requests, true returns **Saved request inspection** with their retained state and brief. It does not poll, submit paid work, upload a file or mark delivery. Initial ledger setup and reads still occur.',
    '## Revision and reporting policy',
    refresh+milestone,
    '## Persistent recovery',
    'The Data Table freezes input, project, brief and full authoritative context, keyed by workflow, immutable source ID, revision, reporting period when applicable, and destination folder. States progress through `submitting`, `accepted`, `completed`, `uploaded`, and `delivered`. Intent is saved before the nonretrying paid request, and the accepted job ID is saved before waiting. Accepted requests resume their frozen input even if the original notice window later expires, provided the raw source and detail fingerprint is unchanged.',
    'A lost paid response can leave `submitting` without a job ID. The workflow stops for reconciliation in https://app.zvid.io. Confirm which job was accepted and matches the frozen project, then retain that job ID and set the existing ledger row to `accepted` before retrying. Do not submit a replacement while acceptance is unknown. Deleted or revised sources with pending requests appear in the review report so their retained jobs can be reconciled.',
    'Retries of `accepted` poll the same job; retries of `completed` deliver its saved HTTPS video URL. A missing completed media URL stops for investigation with the accepted job retained. Delivery searches the configured private folder using a deterministic filename. It reuses only one MP4 whose Drive `appProperties.zvid_request_hash` matches the saved SHA-256 input hash. Multiple matches, a wrong media type, or missing or different metadata stop automatic delivery. Verify the file against the retained job and frozen request before correcting its metadata or reconciling a conflicting file; filename alone is insufficient evidence.',
    'Uploads have no blind retries because file creation can succeed while its response is lost. On replay, search and metadata verification recover that file. A failed source writeback reuses the retained upload. Both the primary and related records are reread and fingerprinted before writeback and after the receipt. A deleted, duplicated, revised or edited source stops completion and retains the uploaded asset for reconciliation.',
    'Data Table lookup and upsert do not form an atomic uniqueness lock. Concurrent manual executions can both reach submission before a claim becomes visible; this workflow does not guarantee exactly-once execution under concurrency. Run one execution at a time or serialize it in your n8n deployment. Hourly staggering reduces schedule overlap but does not prevent a manually overlapping run.',
    '## Output and review',
    'The source register receives delivery status, request fingerprint, accepted job ID, video URL, private Drive file ID and link, completion time and the domain outcome. The final **Business outcome** contains the calculated brief and authoritative context; the video summarizes those records and does not replace full procedures or source records. Full context remains in Sheets and the n8n ledger.',
    '**Watch video → Binary → data → View** plays completed MP4s. Its ordinary media GET has a 30-second timeout and at most three attempts five seconds apart; failed preview leaves the verified delivery intact. Mandatory media delivery uses a bounded download and stops on failure. All supported Zvid API operations use the published native Zvid node. The workflow adds no public-sharing permissions.',
    '## Publication submission draft',
    '**Who needs it:** '+adapter.need,
    '**What it automates:** '+adapter.outcome,
    '**Required services:** n8n with Data Tables, `@zvid/n8n-nodes-zvid`, Zvid credits, Google Sheets and Google Drive.',
    'Workflow walkthrough: {{YOUTUBE_VIDEO_URL}}',
    'Describe the domain policy, source joins, persistent recovery, private handoff and verified source writeback when submitting. Include screenshots and manual execution evidence. n8n decides acceptance. Publish this companion guide and replace the overview reference with its verified public link before submission.',
    'Support: https://zvid.io/contact'
  ].join('\n\n')+'\n';
}

module.exports={buildPublicationWorkflow,buildPublicationDoc,chooseRequest,decideRecovery,completedState,sourceCandidates,ledgerColumns,writebackHeaders};
