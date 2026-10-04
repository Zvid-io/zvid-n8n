'use strict';
const fs = require('node:fs');
const path = require('node:path');
const runtime = require('./review-template-runtime');
const STICKY = 'n8n-nodes-base.stickyNote';
const ZVID = '@zvid/n8n-nodes-zvid.zvid';
const files = ['were-hiring-video','workout-of-the-day','restaurant-weekly-specials'];
const restaurantNames = {
  'Every Monday at 9am':'Start weekly menu campaign at 9am',
  'Test manually':'Test restaurant specials manually',
  'Config':'Set restaurant branding and render limits',
  'Read menu sheet':'Read specials from Google Sheets',
  'Pick weekly dishes':'Select up to five dishes marked ThisWeek',
  'Build project JSON':'Build dish scenes and booking end card',
  'Validate project (free)':'Validate specials video and quote credits',
  'Check validation':'Stop on invalid specials video design',
  'Dry run?':'Preview specials without a paid render?',
  'Save draft to editor':'Save specials draft when supported',
  'Dry run summary':'Return specials draft link and credit quote',
  'Submit render':'Submit weekly specials video to Zvid',
  'Wait':'Wait before checking specials render',
  'Get render status':'Fetch weekly specials render status',
  'Render finished?':'Weekly specials MP4 completed?',
  'Still rendering?':'Stop failed or timed-out specials renders',
  'Run summary':'Prepare specials video URL and caption',
  'Video ready to watch?':'Specials video URL available?',
  '▶ Watch video':'▶ Watch video — weekly specials',
};
function renameNodes(workflow, names) {
  const change = value => {
    if (typeof value === 'string') {
      for (const [before,after] of Object.entries(names)) {
        value=value.split("$('"+before+"')").join("$('"+after+"')").split('$("'+before+'")').join('$("'+after+'")');
        value=value.split('$node["'+before+'"]').join('$node["'+after+'"]');
      }
      return value;
    }
    if (Array.isArray(value)) return value.map(change);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,change(v)]));
    return value;
  };
  for (const node of workflow.nodes) { node.name=names[node.name] || node.name;node.parameters=change(node.parameters); }
  workflow.connections=Object.fromEntries(Object.entries(workflow.connections).map(([name,types])=>[
    names[name] || name,Object.fromEntries(Object.entries(types).map(([type,outputs])=>[type,outputs.map(branch=>branch.map(edge=>({...edge,node:names[edge.node] || edge.node})))]))
  ]));
  return workflow;
}
const edge = node => ({node,type:'main',index:0});
const refs = {__rl:true,mode:'list',value:''};
function upgradeWorkflow(original, kind) {
  if(['were-hiring-video','restaurant-weekly-specials'].includes(kind)) return require('./build-review-campaigns').buildCampaign(original,kind);
  const w=structuredClone(original);
  if(kind==='restaurant-weekly-specials') return renameNodes(w,restaurantNames);
  if(!['were-hiring-video','workout-of-the-day'].includes(kind)) return w;
  if(w.nodes.some(n=>n.id==='review-v2-loop')) {
    const select=w.nodes.find(n=>n.id==='review-v2-select');
    const fn=kind==='were-hiring-video'?runtime.selectHiring:runtime.selectWorkout;
    select.parameters.jsCode=fn.toString()+select.parameters.jsCode.slice(select.parameters.jsCode.lastIndexOf('\nreturn '));
    return w;
  }
  const hiring=kind==='were-hiring-video';
  const old=name=>w.nodes.find(n=>n.name===name);
  const cfgNode=old(hiring?'Company Config':'Config'), builder=old('Build project JSON'), read=old(hiring?'Read job openings':'Read workout sheet');
  const cfg=JSON.parse(cfgNode.parameters.jsonOutput);
  cfg.maxCreditsPerVideo=20;cfg.timezone ||= 'UTC';
  const label=hiring?'hiring':'workout';
  const configName=hiring?'Set company brand and campaign limits':'Set gym branding and workout limits';
  const readName=hiring?'Read hiring campaign queue':'Read dated coach workout plans';
  const buildName=hiring?'Build role perks and application scenes':'Build selected workout variant scenes';
  cfgNode.name=configName;cfgNode.parameters.jsonOutput=JSON.stringify(cfg,null,2);
  read.name=readName;read.alwaysOutputData=true;
  const manual=old('Test manually'), schedule=w.nodes.find(n=>n.type==='n8n-nodes-base.scheduleTrigger');
  manual.name='Test '+label+' campaign manually';schedule.name=hiring?'Start daily hiring campaign at 9am':'Start daily workout campaign at 6am';
  builder.name=buildName;
  if(hiring) {
    builder.parameters.jsCode=builder.parameters.jsCode.replace('return [{ json: { payload, meta } }];',
      'const caption = [row.Role, row.Team, row.Location, row.SalaryRange, ...[row.Perk1,row.Perk2,row.Perk3].filter(Boolean), "Apply: "+row.ApplyUrl].filter(Boolean).join("\\n");\nreturn [{ json: { ...row, payload, meta, caption: row.savedCaption || caption } }];');
  } else {
    builder.parameters.jsCode=builder.parameters.jsCode.replace("const data = $('Pick today\\'s row').first().json;",'const data = $json;').replace('const data = $("Pick today\'s row").first().json;','const data = $json;');
    // The original builder uses the incoming normalized row directly.
    builder.parameters.jsCode=builder.parameters.jsCode.replace(/const data = [^\n]+;/,'const data = $json;');
    builder.parameters.jsCode=builder.parameters.jsCode.replace('return [{ json: { payload, meta: { ...meta, dateIso: data.dateIso, usedFallback: data.usedFallback === true } } }];',
      'return [{ json: { ...data, payload, meta: { ...meta, dateIso: data.dateIso, usedFallback: data.usedFallback === true }, caption: data.savedCaption || meta.caption } }];');
  }
  const music=hiring?old('Check music track'):null;
  if(music) music.name='Check optional hiring soundtrack';
  const watch=old('▶ Watch video'), gate=old('Video ready to watch?');
  watch.name='▶ Watch video — '+label;gate.name='Completed '+label+' video URL available?';
  const retained=[manual,schedule,cfgNode,read,builder,...(music?[music]:[]),gate,watch];
  w.nodes=[...retained,...original.nodes.filter(n=>n.type===STICKY && n.id.startsWith('publication-overview-'))];w.connections={};
  const add=(id,name,type,parameters,extra={})=>{const n={id:'review-v2-'+id,name,type,typeVersion:2,position:[0,0],parameters,...extra};w.nodes.push(n);return n;};
  const code=(id,name,jsCode)=>add(id,name,'n8n-nodes-base.code',{jsCode});
  const iff=(id,name,condition)=>add(id,name,'n8n-nodes-base.if',{conditions:{options:{caseSensitive:true,leftValue:'',typeValidation:'strict',version:2},conditions:[{id:id+'-condition',leftValue:'={{ '+condition+' }}',rightValue:'',operator:{type:'boolean',operation:'true',singleValue:true}}],combinator:'and'},options:{}},{typeVersion:2.2});
  const connect=(from,...branches)=>w.connections[from]={main:branches.map(nodes=>nodes.map(edge))};
  const sheets=(id,name,values)=>add(id,name,'n8n-nodes-base.googleSheets',{
    resource:'sheet',operation:'update',documentId:structuredClone(refs),sheetName:structuredClone(refs),
    columns:{mappingMode:'defineBelow',value:values,matchingColumns:[hiring?'JobKey':'WorkoutKey'],schema:Object.keys(values).map(key=>({id:key,displayName:key,required:false,defaultMatch:false,display:true,type:'string',canBeUsedToMatch:true,removed:false}))},options:{cellFormat:'RAW'}
  },{typeVersion:4.7,retryOnFail:true,maxTries:3,waitBetweenTries:2000});
  const selectName=hiring?'Select approved open roles by priority':'Select approved standard and scaled workouts';
  const selectFn=hiring?runtime.selectHiring:runtime.selectWorkout;
  code('select',selectName,selectFn.toString()+`\nreturn ${selectFn.name}($('${configName}').first().json,$input.all().map(i=>i.json),new Date()).map(json=>({json}));`);
  iff('pending','Unfinished videos are eligible?','Number($json.pendingCount) > 0');
  code('empty','Explain why no videos are eligible','return $input.all();');
  add('loop','Process one approved video at a time','n8n-nodes-base.splitInBatches',{batchSize:1,options:{}},{typeVersion:3});
  iff('resume','Resume a saved render job?','Boolean($json.jobId)');
  code('resume-context','Restore saved render without resubmitting',runtime.trackJob.toString()+'\nreturn [{json:trackJob($json,{},Date.now())}];');
  add('validate','Validate video and request credit quote',ZVID,{resource:'render',operation:'validate',source:'json',projectJson:'={{ JSON.stringify($json.payload) }}'},{typeVersion:1});
  code('quote','Enforce per-video credit ceiling',runtime.checkQuote.toString()+`\nreturn [{json:checkQuote($('${configName}').first().json,$('${buildName}').first().json,$json)}];`);
  iff('preview','Return validation preview only?',`$('${configName}').first().json.dryRun === true`);
  code('preview-report','Return quote and design without rendering',
    "return [{json:{key:$json.key,variant:$json.variant,status:'preview',dryRun:true,creditsRequired:$json.creditsRequired,caption:$json.caption,payload:$json.payload,warnings:$json.warnings,videoUrl:null,nextStep:'Review the design JSON and credit quote; set dryRun=false to render. This preview does not create an editor draft.'}}];");
  // Sheet update mappings contain only the current variant's fields. Separate
  // standard/scaled branches prevent blanking another variant's saved state.
  const mapping=(source,prefix,phase)=>{
    const field=hiring?{status:'RenderStatus',job:'RenderJobId',credits:'CreditsQuoted',video:'VideoUrl',caption:'Caption',at:'RenderedAt'}:{status:prefix+'Status',job:prefix+'JobId',credits:prefix+'Credits',video:prefix+'VideoUrl',caption:prefix+'Caption',at:prefix+'RenderedAt'};
    const ref=`$('${source}').first().json`;
    const result={[hiring?'JobKey':'WorkoutKey']:`={{ ${ref}.matchValue }}`};
    if(phase==='claim') Object.assign(result,{[field.status]:'submitting',[field.credits]:`={{ ${ref}.creditsRequired }}`,[field.caption]:`={{ ${ref}.caption }}`});
    if(phase==='accepted') Object.assign(result,{[field.status]:'rendering',[field.job]:`={{ ${ref}.jobId }}`});
    if(phase==='finish') Object.assign(result,{[field.status]:`={{ ${ref}.status }}`,[field.job]:`={{ ${ref}.jobId }}`,[field.credits]:`={{ ${ref}.creditsRequired }}`,[field.caption]:`={{ ${ref}.caption }}`,[field.video]:`={{ ${ref}.videoUrl || '' }}`,[field.at]:`={{ ${ref}.renderedAt || '' }}`});
    return result;
  };
  const addWriteStage=(stage,source,next)=>{
    const verb={claim:'Mark submission pending',accepted:'Save accepted render job ID',finish:'Save video result and caption'}[stage];
    if(hiring) {sheets(stage,verb,mapping(source,'',stage));connect(source,[verb]);connect(verb,[next]);return verb;}
    const branch=iff(stage+'-variant','Write '+stage+' state for standard workout?',`$('${source}').first().json.variant === 'Standard'`);
    const standard=verb+' — standard',scaled=verb+' — scaled';
    sheets(stage+'-standard',standard,mapping(source,'Standard',stage));sheets(stage+'-scaled',scaled,mapping(source,'Scaled',stage));
    connect(source,[branch.name]);connect(branch.name,[standard],[scaled]);connect(standard,[next]);connect(scaled,[next]);return branch.name;
  };
  // Deliberately no retry on paid submissions: a timeout may hide an accepted job.
  add('submit','Submit one approved video to Zvid',ZVID,{resource:'render',operation:'create',source:'json',projectJson:"={{ JSON.stringify($('Enforce per-video credit ceiling').first().json.payload) }}",renderType:'video',waitForCompletion:false},{typeVersion:1,retryOnFail:false});
  code('accepted-context','Capture accepted render ID',runtime.trackJob.toString()+"\nreturn [{json:trackJob($('Enforce per-video credit ceiling').first().json,$json,Date.now())}];");
  code('restore-accepted','Restore accepted video context',"return [{json:$('Capture accepted render ID').first().json}];");
  code('track','Track current video render','return $input.all();');
  add('wait','Wait before checking current render','n8n-nodes-base.wait',{amount:`={{ $('${configName}').first().json.pollSeconds }}`,unit:'seconds'},{typeVersion:1.1});
  add('status','Fetch current video render status',ZVID,{resource:'render',operation:'get',jobId:"={{ $('Track current video render').first().json.jobId }}",waitForCompletion:false},{typeVersion:1,retryOnFail:true,maxTries:3,waitBetweenTries:5000});
  code('classify','Classify completion failure or timeout',runtime.classifyJob.toString()+`\nreturn [{json:classifyJob($('Track current video render').first().json,$json,Date.now(),$('${configName}').first().json.timeoutMinutes)}];`);
  iff('keep-polling','Render still within polling deadline?',"$json.status === 'rendering'");
  code('result-context','Prepare final video tracking fields','return $input.all();');
  code('report','Return saved video outcome',"const d=$('Prepare final video tracking fields').first().json;\nconst {payload,...report}=d;return [{json:report}];");
  code('summary','Summarize campaign results and skipped work',`const rows=$input.all().map(i=>i.json);\nconst queue=$('${selectName}').all().map(i=>i.json);\nreturn [{json:{processed:rows.length,completed:rows.filter(r=>r.status==='completed').length,previews:rows.filter(r=>r.status==='preview').length,needsAttention:rows.filter(r=>!['completed','preview'].includes(r.status)).length,creditsQuoted:rows.reduce((s,r)=>s+(Number(r.creditsRequired)||0),0),audit:queue[0]?.audit || {},results:rows,nextStep:'Review saved video URLs and captions before sharing. For submitting or failed rows inspect Zvid before resetting state; never run overlapping executions.'}}];`);
  connect(manual.name,[configName]);connect(schedule.name,[configName]);
  if(music) {connect(configName,[music.name]);connect(music.name,[readName]);} else connect(configName,[readName]);
  connect(readName,[selectName]);connect(selectName,['Unfinished videos are eligible?']);
  connect('Unfinished videos are eligible?',['Process one approved video at a time'],['Explain why no videos are eligible']);
  connect('Process one approved video at a time',['Summarize campaign results and skipped work'],[buildName]);
  connect(buildName,['Resume a saved render job?']);connect('Resume a saved render job?',['Restore saved render without resubmitting'],['Validate video and request credit quote']);
  connect('Restore saved render without resubmitting',['Track current video render']);
  connect('Validate video and request credit quote',['Enforce per-video credit ceiling']);connect('Enforce per-video credit ceiling',['Return validation preview only?']);
  const claimEntry=addWriteStage('claim','Return validation preview only?','Submit one approved video to Zvid');
  // Replace the helper's plain edge with the actual preview branch.
  connect('Return validation preview only?',['Return quote and design without rendering'],[claimEntry]);
  // Claim values reference the validated item, independent of branch output.
  for(const node of w.nodes.filter(n=>n.id.startsWith('review-v2-claim')&&n.type==='n8n-nodes-base.googleSheets'))node.parameters.columns.value=mapping('Enforce per-video credit ceiling',node.name.endsWith('scaled')?'Scaled':'Standard','claim');
  const claimVariant=w.nodes.find(n=>n.id==='review-v2-claim-variant');
  if(claimVariant)claimVariant.parameters.conditions.conditions[0].leftValue="={{ $('Enforce per-video credit ceiling').first().json.variant === 'Standard' }}";
  connect('Return quote and design without rendering',['Process one approved video at a time']);
  connect('Submit one approved video to Zvid',['Capture accepted render ID']);addWriteStage('accepted','Capture accepted render ID','Restore accepted video context');
  connect('Restore accepted video context',['Track current video render']);connect('Track current video render',['Wait before checking current render']);connect('Wait before checking current render',['Fetch current video render status']);
  connect('Fetch current video render status',['Classify completion failure or timeout']);connect('Classify completion failure or timeout',['Render still within polling deadline?']);connect('Render still within polling deadline?',['Wait before checking current render'],['Prepare final video tracking fields']);
  addWriteStage('finish','Prepare final video tracking fields','Return saved video outcome');
  connect('Return saved video outcome',['Process one approved video at a time',gate.name]);connect(gate.name,[watch.name],[]);
  renameNodes(w,{[hiring?'Company Config':'Config']:configName,'Check music track':music?.name || 'Check music track'});
  w.name=hiring?'Create approved hiring campaign videos with Google Sheets and Zvid':'Create standard and scaled daily workout videos with Google Sheets and Zvid';
  w.meta={...(w.meta || {}),reviewUpgradeVersion:2};
  return w;
}

function getReviewLayout(workflow,kind) {
  if(workflow.nodes.some(n=>n.id==='campaign-v3-plan')) return require('./review-campaign-layouts').campaignLayout(workflow,kind);
  const hiring=kind==='were-hiring-video',workout=kind==='workout-of-the-day',restaurant=kind==='restaurant-weekly-specials';
  if(!restaurant && !(hiring || workout)) return null;
  if(!restaurant && !workflow.nodes.some(n=>n.id==='review-v2-loop')) return null;
  if(restaurant && !workflow.nodes.some(n=>n.name===restaurantNames.Config)) return null;
  const node=id=>workflow.nodes.find(n=>n.id===id);
  let groups,overview;
  if(restaurant) {
    groups=[
      ['configure','Start the weekly specials campaign','Set branding and timings, then test manually before enabling the weekly schedule.',['zvid-rws-0001','zvid-rws-0002','zvid-rws-0003']],
      ['menu','Select this week’s dishes','Use Dish, Description, Price, PhotoUrl and ThisWeek. Mark up to five dishes; bound custom photos to 1920×1920 without distortion.',['zvid-rws-0004','zvid-rws-0005']],
      ['validate','Build dish cards and check the quote','Build a hook, a photo card per dish and a booking end card. Stop on invalid designs before spending credits.',['zvid-rws-0006','zvid-rws-0007','zvid-rws-0008']],
      ['preview','Choose the optional editor preview','dryRun=false renders by default. Editor drafts require Zvid Project → Create, unavailable in published v0.1.8; keep false with that version.',['zvid-rws-0009','zvid-rws-0010','zvid-rws-0011']],
      ['render','Render the weekly specials MP4','Submit the video and poll until completion. Stop on render failure or timeout, then inspect Zvid before retrying.',['zvid-rws-0012','zvid-rws-0013','zvid-rws-0014','zvid-rws-0015','zvid-rws-0016']],
      ['watch','Review the weekly specials reel','Review the caption and open Watch video → Binary → data → View. Sharing to social platforms is manual.',['zvid-rws-0017','zvid-watch-ready','zvid-rws-0023']],
    ];
    overview=`## Create weekly restaurant specials videos\n\n### How it works\nFor restaurant owners and marketers: read this week’s marked dishes from Google Sheets and create a vertical video with a photo, description and price for each dish, followed by a booking call to action. Descriptive node names explain each action. Review the video and caption before sharing manually.\n\n### Setup\n1. Install **\`@zvid/n8n-nodes-zvid\`** from **Settings → Community nodes** before credentials. A workspace owner/admin may need to install it.\n2. Create a **Zvid API** credential with [your key](https://app.zvid.io/api-keys), Base URL \`https://api.zvid.io\`, and select it on every Zvid node.\n3. Connect **Read specials from Google Sheets** and select the document and tab. Headers: Dish, Description, Price, PhotoUrl, ThisWeek.\n4. Configure restaurant branding, media and timing. Mark ThisWeek=true for the dishes to include.\n5. **dryRun=false spends credits.** Optional editor drafts need Project → Create support, unavailable in published v0.1.8. Keep false with that version.\n6. Run manually, review **Watch video → Binary → data → View**, then check the timezone and enable the schedule.\n\n### Customization\nUse your own dish photos and booking details. [Detailed setup guide](https://github.com/Zvid-io/zvid-n8n/blob/master/workflows/restaurant-weekly-specials.md).`;
  } else {
    const functional=workflow.nodes.filter(n=>n.type!==STICKY);
    const ids=regex=>functional.filter(n=>regex.test(n.id)).map(n=>n.id);
    const initial=functional.filter(n=>!n.id.startsWith('review-v2-')&&!['zvid-watch-ready'].includes(n.id)&&!(/Watch video/.test(n.name))&&n.type!=='n8n-nodes-base.code'&&n.type!=='n8n-nodes-base.googleSheets').map(n=>n.id);
    groups=[
      ['configure','Set the brand and run schedule',hiring?'Set company branding, optional music, timezone, polling deadline, maxPerRun and maxCreditsPerVideo. Review role details before enabling the daily campaign.':'Set gym branding, timezone, media, polling deadline and maxCreditsPerVideo. At most two coach-approved versions are selected for the chosen date.',initial],
      ['queue',hiring?'Choose approved open roles':'Choose coach-approved workout versions',hiring?'Require unique JobKey, Approval=approved, Role and an HTTPS ApplyUrl. Honor OpensOn, ClosesOn and Priority; completed or uncertain submissions are skipped.':'Require one date per plan, unique WorkoutKey, Approval=approved and Ex1. Optional ScaledEx1–ScaledEx5 are coach-written alternatives. Preserve original dates when fallbackToLatest is enabled.',[...ids(/^review-v2-(select|pending|empty)$/),...functional.filter(n=>n.type==='n8n-nodes-base.googleSheets'&&!n.id.startsWith('review-v2-')).map(n=>n.id)]],
      ['build','Build one video or resume its saved job','Each item is processed sequentially. Existing job IDs resume polling without submitting another paid render.',['review-v2-loop',...functional.filter(n=>n.type==='n8n-nodes-base.code'&&!n.id.startsWith('review-v2-')).map(n=>n.id),'review-v2-resume','review-v2-resume-context']],
      ['quote','Validate the design and enforce the credit cap','Stop when validation fails or the quote exceeds maxCreditsPerVideo. dryRun=true returns the quote, caption and design JSON without saving an editor draft.',ids(/^review-v2-(validate|quote|preview|preview-report)$/)],
      ['claim','Record a pending submission before rendering','Write submitting before the paid request. An interrupted or uncertain submission stays blocked for inspection. Run only one execution at a time; Sheets updates are not atomic locks.',ids(/^review-v2-(claim(?:-.*)?|submit)$/)],
      ['accepted','Save the accepted job for recovery','Persist the accepted job ID before polling. On later runs, saved jobs are resumed without paying for another submission.',ids(/^review-v2-(accepted(?:-.*)?|restore-accepted|track)$/)],
      ['poll','Poll until completion failure or timeout','Each video gets its own polling deadline. Failed, timed-out and unknown outcomes retain the job ID for inspection and deliberate recovery.',ids(/^review-v2-(wait|status|classify|keep-polling)$/)],
      ['record','Write the video result and ready-to-share caption',hiring?'Add tracking headers: RenderStatus, RenderJobId, CreditsQuoted, VideoUrl, Caption, RenderedAt. Updates match JobKey. Review failed jobs in Zvid before clearing state.':'Add tracking headers: StandardStatus, StandardJobId, StandardCredits, StandardVideoUrl, StandardCaption, StandardRenderedAt, ScaledStatus, ScaledJobId, ScaledCredits, ScaledVideoUrl, ScaledCaption, ScaledRenderedAt. Updates match WorkoutKey and preserve the other version’s fields.',ids(/^review-v2-(result-context|finish(?:-.*)?|report)$/)],
      ['watch','Review the results and watch completed media','Review completed, preview and attention counts plus skipped reasons. Open Watch video → Binary → data → View; select an item for each video. Social sharing is manual.',[...ids(/^review-v2-summary$/),'zvid-watch-ready',functional.find(n=>/Watch video/.test(n.name)).id]],
    ];
    const readIds=functional.filter(n=>n.type==='n8n-nodes-base.googleSheets'&&!n.id.startsWith('review-v2-')).map(n=>n.id);
    groups.find(g=>g[0]==='queue')[3]=[...readIds,...ids(/^review-v2-(select|pending|empty)$/)];
    groups.find(g=>g[0]==='claim')[3]=[...ids(/^review-v2-claim(?:-.*)?$/),'review-v2-submit'];
    groups.find(g=>g[0]==='accepted')[3]=['review-v2-accepted-context',...ids(/^review-v2-accepted(?:-(?:variant|standard|scaled))?$/),'review-v2-restore-accepted','review-v2-track'];
    groups.find(g=>g[0]==='record')[3]=['review-v2-result-context',...ids(/^review-v2-finish(?:-.*)?$/),'review-v2-report'];
    overview=`## ${hiring?'Create approved hiring campaign videos':'Create standard and scaled workout videos'}\n\n### How it works\n${hiring?'For recruitment teams: turn approved, currently open roles into branded hiring videos. Prioritize urgent openings, cap the queue and skip completed videos. Each result includes an application caption.':'For gyms and coaches: turn today’s approved training plan into standard and optional scaled videos using the exercises the coach supplies. Keep separate video URLs and captions for each version, and skip completed versions.'} Both paths validate the credit quote, save accepted render IDs, resume interrupted jobs and record outcomes in Google Sheets. Review completed media before sharing manually.\n\n### Setup\n1. Install **\`@zvid/n8n-nodes-zvid\`** from **Settings → Community nodes** before credentials. A workspace owner/admin may need to install it.\n2. Create a **Zvid API** credential with [your key](https://app.zvid.io/api-keys) and Base URL \`https://api.zvid.io\`; select it on every Zvid node.\n3. Connect every Google Sheets node to the same document and tab. Add the input and tracking headers from the [setup guide](https://github.com/Zvid-io/zvid-n8n/blob/master/workflows/${kind}.md).\n4. ${hiring?'Supply unique JobKey, Role and an HTTPS ApplyUrl; set Approval=approved after review.':'Supply unique WorkoutKey, Date (YYYY-MM-DD), WorkoutName and Ex1; set Approval=approved after coach review.'}\n5. Set branding, timezone and maxCreditsPerVideo. **dryRun=false spends credits.** true returns validation, quote and design JSON only; no editor draft.\n6. Test manually, inspect the saved results, then enable the schedule. Avoid overlapping runs. Keep job IDs when investigating failures.\n\n### Customization\n${hiring?'Use Priority, OpensOn, ClosesOn and maxPerRun to manage the campaign queue.':'Fill ScaledEx1–ScaledEx5 for the optional scaled version; fallbackToLatest preserves the selected workout’s date.'}`;
  }
  if(workout) return require('./review-campaign-layouts').workoutLayout(workflow,groups,overview);
  let x=0,y=0,rowHeight=0;
  const layoutGroups=groups.map(([key,title,body,ids],index)=>{
    const members=ids.map(id=>{const n=node(id);if(!n)throw new Error('Missing reviewed workflow node '+id);return n;});
    const columns=Math.min(4,members.length),width=columns*280+100,height=Math.ceil(members.length/4)*250+300;
    if(x&&x+width>3900){x=0;y+=rowHeight+180;rowHeight=0;}
    const positions=members.map((n,i)=>[n.name,x+50+(i%4)*280,y+260+Math.floor(i/4)*250]);
    const result=[key,(index+1)+'. '+title,body,[x,y,width,height],positions];x+=width+140;rowHeight=Math.max(rowHeight,height);return result;
  });
  return {overview,groups:layoutGroups};
}
module.exports={upgradeWorkflow,getReviewLayout,renameNodes,restaurantNames};
if(require.main===module){
  const {organizeWorkflow}=require('./organize-workflow-series');
  for(const kind of files){const file=path.join(__dirname,'../workflows/zvid-'+kind+'.json');const next=organizeWorkflow(upgradeWorkflow(JSON.parse(fs.readFileSync(file)),kind)).workflow;fs.writeFileSync(file,JSON.stringify(next,null,2)+'\n');console.log(kind+': '+next.nodes.filter(n=>n.type!==STICKY).length+' functional nodes');}
}
