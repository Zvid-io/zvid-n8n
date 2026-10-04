'use strict';
const domain = require('./review-campaign-runtime');
const runtime = require('./review-template-runtime');
const ZVID = '@zvid/n8n-nodes-zvid.zvid';
const STICKY = 'n8n-nodes-base.stickyNote';

function buildCampaign(original, kind) {
  if (!['were-hiring-video','restaurant-weekly-specials'].includes(kind)) return original;
  const hiring = kind === 'were-hiring-video', w = structuredClone(original);
  const old = id => w.nodes.find(n => n.id === id);
  const cfg = w.nodes.find(n => n.type === 'n8n-nodes-base.set');
  const configName = hiring ? 'Set recruitment campaign defaults' : 'Set weekly menu campaign rules';
  const sourceName = hiring ? 'Read approved job catalog' : 'Read nominated menu dishes';
  const planName = hiring ? 'Match the hiring brief to open roles' : 'Balance available dishes across menu categories';
  const buildName = hiring ? 'Build the single-role spotlight with benefits' : 'Build the selected weekly menu video';
  const roundupName='Build the multi-role recruitment roundup';
  const ledgerName = hiring ? 'Read recruitment campaign history' : 'Read weekly menu campaign history';
  const existingCfg = JSON.parse(cfg.parameters.jsonOutput);
  const defaults = hiring ? {
    maxRoles:2,careersUrl:'https://example.com/careers',manualBrief:{CampaignKey:'recruitment-demo-01',Mode:'roundup',JobKeys:'',Team:'',Location:'',MaxRoles:2}
  } : {timezone:'UTC',maxCreditsPerVideo:30,minDishes:3,minCategories:2,campaignRevision:'1',bookingUrl:'https://example.com/reservations'};
  cfg.parameters.jsonOutput = JSON.stringify({...defaults,...existingCfg},null,2); cfg.name = configName;
  // Remove obsolete per-row knobs from public configurations only. The local
  // migration retains previous values in its backup before applying this schema.
  if (hiring) { const c = JSON.parse(cfg.parameters.jsonOutput); for(const key of ['maxPerRun','musicUrl','maxMusicBytes','heroVideoUrl','companyLogoUrl','musicVolume']) delete c[key]; cfg.parameters.jsonOutput=JSON.stringify(c,null,2); }
  const source = w.nodes.find(n => n.type === 'n8n-nodes-base.googleSheets' && (!n.parameters.operation || n.parameters.operation === 'read'));
  source.name = sourceName; source.alwaysOutputData = true;
  const manual = w.nodes.find(n => n.type === 'n8n-nodes-base.manualTrigger'); manual.name = hiring ? 'Test the configured recruiter brief' : 'Test weekly menu planning';
  const watch = w.nodes.find(n => /Watch video/.test(n.name) && n.type === 'n8n-nodes-base.httpRequest'); watch.name = '▶ Watch video — ' + (hiring ? 'recruitment campaign' : 'weekly menu campaign');
  const gate = w.nodes.find(n => n.id === 'zvid-watch-ready'); gate.name = 'Completed campaign video URL available?';
  const overview = w.nodes.find(n => n.id === 'publication-overview-' + kind);
  const restaurantBuilder = !hiring ? old('zvid-rws-0006') : null;
  w.nodes = [manual,cfg,source,gate,watch,...(overview?[overview]:[])]; w.connections = {};
  const add = (id,name,type,parameters,extra={}) => { const n = {id:'campaign-v3-'+id,name,type,typeVersion:2,position:[0,0],parameters,...extra}; w.nodes.push(n); return n; };
  const code = (id,name,jsCode) => add(id,name,'n8n-nodes-base.code',{jsCode});
  const iff = (id,name,condition) => add(id,name,'n8n-nodes-base.if',{conditions:{options:{caseSensitive:true,leftValue:'',typeValidation:'strict',version:2},conditions:[{id:id+'-condition',leftValue:'={{ '+condition+' }}',rightValue:'',operator:{type:'boolean',operation:'true',singleValue:true}}],combinator:'and'},options:{}},{typeVersion:2.2});
  const connect = (from,...branches) => w.connections[from] = {main:branches.map(nodes=>nodes.map(node=>({node,type:'main',index:0})))};
  if (hiring) {
    add('request','Receive a recruiter campaign brief','n8n-nodes-base.formTrigger',{
      authentication:'basicAuth',formTitle:'Recruitment video campaign',formDescription:'Create a role spotlight or a hiring roundup from your approved job catalog. Reuse a campaign key to recover an existing render. New campaigns spend Zvid credits unless dryRun is enabled in the workflow.',
      formFields:{values:[{fieldLabel:'CampaignKey',fieldType:'text',requiredField:true},{fieldLabel:'Mode',fieldType:'dropdown',fieldOptions:{values:[{option:'roundup'},{option:'spotlight'}]},requiredField:true},{fieldLabel:'JobKeys',fieldType:'text',placeholder:'One key for spotlight; optional comma-separated keys for roundup'},{fieldLabel:'Team',fieldType:'text'},{fieldLabel:'Location',fieldType:'text'},{fieldLabel:'MaxRoles',fieldType:'number',placeholder:'1–4, default from workflow (2)'}]},responseMode:'onReceived',options:{buttonLabel:'Request campaign',respondWith:'text',formSubmittedText:'Request received. Your n8n operator can review the video, campaign log and downloadable handoff in the execution.'}
    },{typeVersion:2.2,webhookId:'zvid-recruitment-campaign-brief'});
    connect('Receive a recruiter campaign brief',[configName]);
  } else {
    const schedule = original.nodes.find(n => n.type === 'n8n-nodes-base.scheduleTrigger');
    schedule.name = 'Plan the weekly menu every Monday'; w.nodes.push(structuredClone(schedule)); connect(schedule.name,[configName]);
  }
  const log = structuredClone(source); log.id='campaign-v3-ledger'; log.name=ledgerName;
  // Each template has a separate campaign log tab in the selected document.
  const oldLog = original.nodes.find(n=>n.id==='campaign-v3-ledger');
  log.parameters.sheetName = oldLog?.parameters.sheetName || {__rl:true,value:hiring?'Hiring Campaigns':'Menu Campaigns',mode:'name'};
  w.nodes.push(log);
  const planning = domain.campaignState.toString()+'\n'+domain.trackedLink.toString()+'\n'+(hiring?domain.planHiring:domain.planRestaurant).toString();
  const brief = hiring ? `const brief=$('Receive a recruiter campaign brief').isExecuted ? $('Receive a recruiter campaign brief').first().json : cfg.manualBrief;\n` : '';
  code('plan',planName,planning+`\nconst cfg=$('${configName}').first().json;\n${brief}return [{json:${hiring?'planHiring(cfg,brief,':'planRestaurant(cfg,'}$('${sourceName}').all().map(i=>i.json),$input.all().map(i=>i.json),new Date())}];`);
  iff('ready','Campaign has eligible content to process?','$json.ready === true');
  code('no-work','Explain campaign selection or recovery needs','return $input.all();');
  iff('resume','Resume the saved campaign render?','Boolean($json.jobId)');
  code('resume-context','Restore the saved campaign snapshot','return $input.all();');
  if (hiring) {
    iff('format','Recruiter requested a single-role spotlight?',"$json.mode === 'spotlight'");
    code('build',buildName,domain.buildHiringCampaign.toString()+`\nreturn [{json:buildHiringCampaign($('${configName}').first().json,$json)}];`);
    code('build-roundup',roundupName,domain.buildHiringCampaign.toString()+`\nreturn [{json:buildHiringCampaign($('${configName}').first().json,$json)}];`);
  } else {
    restaurantBuilder.name = buildName;
    const glueIndex=restaurantBuilder.parameters.jsCode.indexOf('\nconst plan=$json;');
    restaurantBuilder.parameters.jsCode = restaurantBuilder.parameters.jsCode.slice(0,glueIndex>=0?glueIndex:restaurantBuilder.parameters.jsCode.lastIndexOf('\nconst cfg = ')) + `\nconst plan=$json;\nconst cfg={...$('${configName}').first().json,weekLabel:plan.weekLabel,fallbackDishPhotos:[]};\nconst {payload,meta}=buildProject(cfg,plan.dishes);\nreturn [{json:{...plan,payload,meta}}];`;
    w.nodes.push(restaurantBuilder);
  }
  add('validate','Validate campaign design and quote credits',ZVID,{resource:'render',operation:'validate',source:'json',projectJson:'={{ JSON.stringify($json.payload) }}'},{typeVersion:1});
  const built=hiring?`($('${buildName}').isExecuted ? $('${buildName}').first().json : $('${roundupName}').first().json)`:`$('${buildName}').first().json`;
  code('quote','Enforce the campaign credit ceiling',runtime.checkQuote.toString()+`\nconst data=checkQuote($('${configName}').first().json,${built},$json);\nif(JSON.stringify(data).length>45000)throw new Error('Campaign snapshot exceeds the Google Sheets cell budget. Shorten the source copy. No paid render was submitted.');\nreturn [{json:data}];`);
  iff('preview','Return a preview without spending render credits?',`$('${configName}').first().json.dryRun === true`);
  code('preview-report','Return campaign plan design and credit quote',"return [{json:{...$json,status:'preview',dryRun:true,videoUrl:null,nextStep:'Review the plan, design JSON and credit quote. Preview does not write the campaign log or create an editor draft.'}}];");
  const write = (id,name,source,phase) => {
    const ref=`$('${source}').first().json`, val = {CampaignKey:`={{ ${ref}.campaignKey }}`};
    if(phase==='claim') Object.assign(val,{Status:'submitting',JobId:'',CreditsQuoted:`={{ ${ref}.creditsRequired }}`,Caption:`={{ ${ref}.caption }}`,PlanJson:`={{ JSON.stringify(${ref}) }}`,VideoUrl:'',CompletedAt:''});
    if(phase==='accepted') Object.assign(val,{Status:'rendering',JobId:`={{ ${ref}.jobId }}`});
    if(phase==='finish') Object.assign(val,{Status:`={{ ${ref}.status }}`,JobId:`={{ ${ref}.jobId }}`,VideoUrl:`={{ ${ref}.videoUrl || '' }}`,CompletedAt:`={{ ${ref}.renderedAt || '' }}`});
    add(id,name,'n8n-nodes-base.googleSheets',{resource:'sheet',operation:phase==='claim'?'appendOrUpdate':'update',documentId:structuredClone(sourceNodeDocument()),sheetName:structuredClone(log.parameters.sheetName),columns:{mappingMode:'defineBelow',value:val,matchingColumns:['CampaignKey'],schema:Object.keys(val).map(k=>({id:k,displayName:k,required:false,defaultMatch:false,display:true,type:'string',canBeUsedToMatch:true,removed:false}))},options:{cellFormat:'RAW'}},{typeVersion:4.7,retryOnFail:true,maxTries:3,waitBetweenTries:2000});
  };
  function sourceNodeDocument() { return source.parameters.documentId; }
  write('claim','Reserve the campaign key before a paid request','Enforce the campaign credit ceiling','claim');
  add('submit','Submit the new campaign video to Zvid',ZVID,{resource:'render',operation:'create',source:'json',projectJson:"={{ JSON.stringify($('Enforce the campaign credit ceiling').first().json.payload) }}",renderType:'video',waitForCompletion:false},{typeVersion:1,retryOnFail:false});
  code('accepted','Capture the accepted campaign job ID',runtime.trackJob.toString()+"\nreturn [{json:trackJob($('Enforce the campaign credit ceiling').first().json,$json,Date.now())}];");
  write('save-job','Save the accepted campaign job for recovery','Capture the accepted campaign job ID','accepted');
  code('restore-new','Restore the accepted campaign context',"return [{json:$('Capture the accepted campaign job ID').first().json}];");
  code('track','Keep the campaign with its render job',runtime.trackJob.toString()+'\nreturn [{json:trackJob($json,{},Date.now())}];');
  add('status','Wait for the saved campaign render to complete',ZVID,{resource:'render',operation:'get',jobId:'={{ $json.jobId }}',waitForCompletion:true,waitOptions:{pollInterval:`={{ Number($('${configName}').first().json.pollSeconds) || 10 }}`,maxWaitTime:`={{ (Number($('${configName}').first().json.timeoutMinutes) || 20)*60 }}`}},{typeVersion:1,onError:'continueRegularOutput',retryOnFail:false});
  code('classify','Keep the completed URL or failed job for inspection',runtime.classifyJob.toString()+`\nconst context=$('Keep the campaign with its render job').first().json;\nlet response=$json;\nif(response.error){const message=typeof response.error==='string'?response.error:JSON.stringify(response.error);response={state:/did not finish within|timed? ?out/i.test(message)?'timed_out':/failed/i.test(message)?'failed':'needs_review',failedReason:message};}\nconst result=classifyJob(context,response,Date.now(),$('${configName}').first().json.timeoutMinutes);\nif(response.state==='timed_out')result.status='timed_out';\nreturn [{json:result}];`);
  write('finish','Save the campaign outcome and video URL','Keep the completed URL or failed job for inspection','finish');
  code('report',hiring?'Prepare the recruiter referral and application pack':'Prepare the weekly promotion schedule',"const {payload,...result}=$('Keep the completed URL or failed job for inspection').first().json;\nreturn [{json:{...result,nextStep:'Review the completed video and handoff file before sharing. No posts or messages were sent.'}}];");
  const report = hiring?'Prepare the recruiter referral and application pack':'Prepare the weekly promotion schedule';
  code('handoff',hiring?'Prepare one application handoff row per role':'Prepare Monday Wednesday and Friday caption rows',hiring?"return $json.roles.map(r=>({json:{CampaignKey:$json.campaignKey,VideoUrl:$json.videoUrl || '',Role:r.role,Team:r.team,Location:r.location,ClosesOn:r.closesOn,ApplyUrl:r.applyUrl,ReferralMessage:$json.referralMessage}}));":"return $json.posts.map(p=>({json:{CampaignKey:$json.campaignKey,VideoUrl:$json.videoUrl || '',Date:p.date,Purpose:p.purpose,Caption:p.caption,ReviewStatus:p.reviewStatus}}));");
  code('download',hiring?'Download the recruiter handoff CSV':'Download the weekly posting plan CSV',"const rows=$input.all().map(i=>i.json);\nconst keys=Object.keys(rows[0]||{});\nconst cell=value=>{let s=String(value??'');if(/^[=+@\\-\\t\\r]/.test(s))s=\"'\"+s;return '\"'+s.replace(/\"/g,'\"\"')+'\"';};\nconst csv=[keys.map(cell).join(','),...rows.map(row=>keys.map(k=>cell(row[k])).join(','))].join('\\r\\n');\nreturn [{json:{campaignKey:rows[0]?.CampaignKey,rowCount:rows.length},binary:{data:{data:Buffer.from(csv,'utf8').toString('base64'),mimeType:'text/csv',fileName:'campaign-handoff.csv'}}}];");
  connect(manual.name,[configName]); connect(configName,[sourceName]); connect(sourceName,[ledgerName]); connect(ledgerName,[planName]);
  connect(planName,['Campaign has eligible content to process?']); connect('Campaign has eligible content to process?',['Resume the saved campaign render?'],['Explain campaign selection or recovery needs']);
  connect('Resume the saved campaign render?',['Restore the saved campaign snapshot'],[hiring?'Recruiter requested a single-role spotlight?':buildName]); connect('Restore the saved campaign snapshot',['Keep the campaign with its render job']);
  if(hiring){connect('Recruiter requested a single-role spotlight?',[buildName],[roundupName]);connect(roundupName,['Validate campaign design and quote credits']);}
  connect(buildName,['Validate campaign design and quote credits']); connect('Validate campaign design and quote credits',['Enforce the campaign credit ceiling']); connect('Enforce the campaign credit ceiling',['Return a preview without spending render credits?']);
  connect('Return a preview without spending render credits?',['Return campaign plan design and credit quote'],['Reserve the campaign key before a paid request']);
  connect('Reserve the campaign key before a paid request',['Submit the new campaign video to Zvid']); connect('Submit the new campaign video to Zvid',['Capture the accepted campaign job ID']); connect('Capture the accepted campaign job ID',['Save the accepted campaign job for recovery']); connect('Save the accepted campaign job for recovery',['Restore the accepted campaign context']); connect('Restore the accepted campaign context',['Keep the campaign with its render job']);
  connect('Keep the campaign with its render job',['Wait for the saved campaign render to complete']); connect('Wait for the saved campaign render to complete',['Keep the completed URL or failed job for inspection']); connect('Keep the completed URL or failed job for inspection',['Save the campaign outcome and video URL']); connect('Save the campaign outcome and video URL',[report]);
  connect(report,[gate.name,hiring?'Prepare one application handoff row per role':'Prepare Monday Wednesday and Friday caption rows']); connect(gate.name,[watch.name],[]); connect(hiring?'Prepare one application handoff row per role':'Prepare Monday Wednesday and Friday caption rows',[hiring?'Download the recruiter handoff CSV':'Download the weekly posting plan CSV']);
  w.name=hiring?'Build recruiter-requested spotlight and roundup hiring video campaigns':'Plan balanced weekly restaurant menus and create a video promotion pack';
  w.meta={...(w.meta||{}),campaignReviewVersion:3};
  return w;
}
module.exports={buildCampaign};
