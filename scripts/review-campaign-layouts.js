'use strict';
function group(workflow,key,title,body,rect,locations) {
  return [key,title,body,rect,locations.map(([id,x,y])=>{const n=workflow.nodes.find(n=>n.id===id);if(!n)throw new Error('Missing layout node '+id);return [n.name,x,y];})];
}
function campaignLayout(w,kind) {
  const hiring=kind==='were-hiring-video';
  const config=w.nodes.find(n=>n.type==='n8n-nodes-base.set');
  const trigger=w.nodes.find(n=>n.type==='n8n-nodes-base.manualTrigger');
  const other=w.nodes.find(n=>/formTrigger|scheduleTrigger/.test(n.type));
  const source=w.nodes.find(n=>n.type==='n8n-nodes-base.googleSheets'&&!n.id.startsWith('campaign-v3-'));
  const builder=w.nodes.find(n=>n.id==='campaign-v3-build'||n.id==='zvid-rws-0006');
  const watch=w.nodes.find(n=>/Watch video/.test(n.name)&&n.type==='n8n-nodes-base.httpRequest');
  const sections=[
    ['brief',hiring?'Receive a recruiter brief':'Set the weekly menu rules',hiring?'Choose spotlight with one JobKey, or roundup filtered by Team, Location or JobKeys. Configure Basic Auth for the form. Manual tests use manualBrief.':'Set timezone, minimum dishes, minimum categories, booking URL and campaign revision. Start with approved menu data and your own dish photos.',[[other.id,0,260],[trigger.id,0,620],[config.id,280,500]],660],
    ['selection',hiring?'Match approved openings to the brief':'Build a balanced menu from available dishes',hiring?'Read the job catalog and Hiring Campaigns log. Match explicit roles, check approval and open dates, then prioritize closing dates. Explain missing or ineligible selections before rendering.':'Read the menu and Menu Campaigns log. Exclude unavailable or partially available dishes. Select category variety, prioritize nominated dishes and rotate equal-priority dishes using last week’s history.',[[source.id,0,500],['campaign-v3-ledger',280,500],['campaign-v3-plan',560,500],['campaign-v3-ready',840,500],['campaign-v3-no-work',840,840]],1220],
    ['design',hiring?'Compose spotlight or roundup and check cost':'Create the menu reel and three caption drafts','Saved jobs use their original campaign snapshot. New campaigns validate their design and credit ceiling. dryRun=true returns the full plan, design and quote without logging or rendering.',[['campaign-v3-resume',0,500],['campaign-v3-resume-context',280,260],[builder.id,280,500],['campaign-v3-validate',560,500],['campaign-v3-quote',840,500],['campaign-v3-preview',1120,500],['campaign-v3-preview-report',1120,840]],1500],
    ['reserve','Reserve the campaign and save its accepted job','Save submitting before the paid request, then persist the accepted job ID. No paid submission retries. Run one execution at a time; a Sheets log is not an atomic lock.',[['campaign-v3-claim',0,500],['campaign-v3-submit',280,500],['campaign-v3-accepted',560,500],['campaign-v3-save-job',840,500],['campaign-v3-restore-new',1120,500],['campaign-v3-track',1400,260]],1780],
    ['complete','Wait for completion and record the outcome','Zvid polls the saved job within the deadline. Inspect failed or uncertain jobs before resetting state. Log headers: CampaignKey, Status, JobId, CreditsQuoted, VideoUrl, Caption, PlanJson, CompletedAt.',[['campaign-v3-status',0,500],['campaign-v3-classify',280,500],['campaign-v3-finish',560,500]],940],
    ['watch',hiring?'Review the recruitment campaign handoff':'Review the weekly promotion pack',hiring?'Open Watch video → Binary → data → View. Download the CSV for role links and employee referral copy. Review and share manually; no applications are evaluated and no messages are sent.':'Open Watch video → Binary → data → View. Download the Monday, Wednesday and Friday caption plan. Review dates, menu availability and captions before scheduling; no social posts are published.',[['campaign-v3-report',0,500],['zvid-watch-ready',280,500],[watch.id,560,500],['campaign-v3-handoff',280,840],['campaign-v3-download',560,840]],940],
  ];
  if(hiring){
    const design=sections.find(g=>g[0]==='design');
    design[3]=[['campaign-v3-resume',0,500],['campaign-v3-resume-context',280,260],['campaign-v3-format',280,500],['campaign-v3-build',560,400],['campaign-v3-build-roundup',560,760],['campaign-v3-validate',840,500],['campaign-v3-quote',1120,500],['campaign-v3-preview',1400,500],['campaign-v3-preview-report',1400,840]];
    design[4]=1780;
  }
  let x=0;
  const groups=sections.map(([key,title,body,positions,width],i)=>{const result=group(w,key,(i+1)+'. '+title,body,[x,0,width,1120],positions.map(([id,dx,y])=>[id,x+60+dx,y]));x+=width+100;return result;});
  const overview=`## ${hiring?'Build a recruiter-requested hiring campaign':'Plan and promote a balanced weekly menu'}\n\n### How it works\n${hiring?'A recruiter requests one role spotlight or a multi-role roundup using a form. The workflow matches the brief to approved open jobs, builds one campaign video, and prepares tracked application links and employee referral copy in a downloadable CSV.':'Turn approved, available menu dishes into a balanced weekly specials reel. Enforce category variety, consider last week’s dishes, and prepare dated launch, midweek and weekend captions with tracked reservation links.'} A campaign log prevents duplicate completed campaigns and resumes saved jobs using the original snapshot. Review all media and copy before sharing manually.\n\n### Setup\n1. Install **\`@zvid/n8n-nodes-zvid\`** from **Settings → Community nodes** before credentials. A workspace owner/admin may need to install it.\n2. Create a **Zvid API** credential with [your key](https://app.zvid.io/api-keys), Base URL \`https://api.zvid.io\`, and select it on every Zvid node.\n3. Connect Google Sheets nodes to one document: ${hiring?'the job catalog plus Hiring Campaigns':'the menu plus Menu Campaigns'}. Add the exact headers in the [setup guide](https://github.com/Zvid-io/zvid-n8n/blob/master/workflows/${kind}.md).\n4. ${hiring?'Supply JobKey, Role, Approval=approved and ApplyUrl. Set careersUrl and a manualBrief; configure a Basic Auth credential for the recruiter form.':'Supply DishKey, Dish, Category, Price, PhotoUrl, ThisWeek, InStock and Approval=approved. Set bookingUrl, timezone and campaign selection limits.'}\n5. **dryRun=false spends credits.** true returns the plan, JSON and quote only; no editor draft or log writes.\n6. Test manually, inspect the video and handoff, then enable ${hiring?'the protected form':'the weekly schedule'}. Avoid overlapping runs; keep job IDs for recovery.\n\n### Customization\n${hiring?'Reuse CampaignKey to resume; change it only for an intentional new campaign.':'Change campaignRevision only when deliberately replacing this week’s campaign.'}`;
  return {overview,groups};
}

function workoutLayout(w,oldGroups,overview) {
  const byKey=Object.fromEntries(oldGroups.map(g=>[g[0],g]));
  const groups=[];
  let x=0;
  const add=(key,locations,width,height=1120)=>{const spec=byKey[key];const number=groups.length+(groups.length>=2?2:1);groups.push(group(w,key,number+'. '+spec[1],spec[2],[x,0,width,height],locations.map(([id,dx,y])=>[id,x+60+dx,y])));x+=width+100;};
  const cfg=w.nodes.find(n=>n.type==='n8n-nodes-base.set').id;
  const manual=w.nodes.find(n=>n.type==='n8n-nodes-base.manualTrigger').id;
  const schedule=w.nodes.find(n=>n.type==='n8n-nodes-base.scheduleTrigger').id;
  add('configure',[[schedule,0,260],[manual,0,620],[cfg,280,500]],660);
  const read=w.nodes.find(n=>n.type==='n8n-nodes-base.googleSheets'&&!n.id.startsWith('review-v2-')).id;
  add('queue',[[read,0,500],['review-v2-select',280,500],['review-v2-pending',560,500],['review-v2-empty',560,840]],940);
  const loopX=x+60;
  add('build',[['zvid-wod-0006',0,500],['review-v2-resume',280,500],['review-v2-resume-context',560,260]],940);
  add('quote',[['review-v2-validate',0,500],['review-v2-quote',280,500],['review-v2-preview',560,500],['review-v2-preview-report',560,840]],940);
  add('claim',[['review-v2-claim-variant',0,500],['review-v2-claim-standard',280,400],['review-v2-claim-scaled',280,760],['review-v2-submit',560,500]],940);
  add('accepted',[['review-v2-accepted-context',0,500],['review-v2-accepted-variant',280,500],['review-v2-accepted-standard',560,400],['review-v2-accepted-scaled',560,760],['review-v2-restore-accepted',840,500],['review-v2-track',1120,260]],1500);
  add('poll',[['review-v2-wait',0,500],['review-v2-status',280,500],['review-v2-classify',560,500],['review-v2-keep-polling',840,760]],1220);
  const recordX=x;
  add('record',[['review-v2-result-context',0,500],['review-v2-finish-variant',280,500],['review-v2-finish-standard',560,400],['review-v2-finish-scaled',560,760]],940);
  // The batch return travels through the clear lane beneath all main sections.
  // Keep the two output branches beside the report instead of wrapping the main
  // execution stages back across earlier rows.
  groups.push(group(w,'batch','3. Process one version and collect the batch','The loop submits one version at a time. The completed-item return runs below the main stages. The done output summarizes standard and scaled results and skipped reasons.',[loopX-60,1280,680,760],[['review-v2-loop',loopX,1540],['review-v2-summary',loopX+280,1840]]));
  const watch=w.nodes.find(n=>/Watch video/.test(n.name)&&n.type==='n8n-nodes-base.httpRequest');
  groups.push(group(w,'watch','10. Review saved results and completed videos','Each version keeps its own tracking fields and caption. Open Watch video → Binary → data → View and select the output item. Sharing is manual.',[recordX,1280,940,640],[['review-v2-report',recordX+60,1540],['zvid-watch-ready',recordX+340,1540],[watch.id,recordX+620,1540]]));
  return {overview,groups};
}
module.exports={campaignLayout,workoutLayout};
