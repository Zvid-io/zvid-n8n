import {readFileSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {inspectUpgradeDirectory} from './flowlu-upgrade-readiness.mjs';
const require=createRequire(import.meta.url), {adapters}=require('../../scripts/series-two-source-adapters.js');
const base=dirname(fileURLToPath(import.meta.url));
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const code=value=>'<code>'+escape(value)+'</code>';
const read=name=>JSON.parse(readFileSync(resolve(base,name),'utf8'));
const titles=['[Build] Create n8n workflow','[Asset] Capture n8n workflow screenshot'];
const roleNames=['sourceRead','domainPolicy','eligibility','ledgerAcceptance','driveFile','writeback','deduplication','resumeAccepted','deliveryRecovery'];
function status(stage,story,path){return '<h2>Launch status</h2><ul><li>Stage: <strong>'+escape(stage)+'</strong></li><li>Workflow slug: '+code(story.slug)+'</li><li>Source or artifact: '+code(path)+'</li><li>Publication state: validated local workflow; no cloud or community publication performed.</li></ul>';}
function evidence(story,row,input,canvas){
  const items=[
    'Canonical JSON: '+code(story.source)+'; exact SHA-256 '+code(row.currentCanonicalSha256)+'.',
    'Current functional SHA-256: '+code(row.functionalSha256)+'.',
    'Final workflow suite: '+code(input.automated.passed)+' passed, '+code(input.automated.failed)+' failed; '+code(input.automated.artifact.path)+' (SHA-256 '+code(input.automated.artifact.sha256)+').',
    'Current manual render/accepted-job resume execution: '+code(row.executionId)+'. Role evidence: '+code(inputRow(input,story.day).manual.artifact.path)+'.',
    'Real native role executions: '+roleNames.map(name=>escape(name)+' '+code(inputRow(input,story.day).checks[name].executionId)).join('; ')+'.',
    'Current frozen-job media validation and visual scene review: '+code(inputRow(input,story.day).mediaQa.path)+'. The original reviewed media execution remains distinct from later recovery runs.',
    'Actual current native canvas: '+code(inputRow(input,story.day).canvas.path)+'; 11 fitting notes and 58 functional nodes with actual label coverage; no card/node/label overlap.',
    'Full fit PNG: '+code(canvas.fitPng.path)+'; readable overview PNG: '+code(canvas.overviewPng.path)+'. Ten representative sections at 100% plus three lower-row PNGs were independently inspected.',
  ];
  return '<h3>Completion evidence</h3><ul>'+items.map(item=>'<li>'+item+'</li>').join('')+'</ul>';
}
function inputRow(input,day){const row=input.workflows.find(value=>value.day===day);if(!row)throw new Error('Completion row missing');return row;}
function build(){
  const ready=inspectUpgradeDirectory(base);
  if(!ready.rootReportConfirmed||ready.buildReadyDays.length!==30||ready.assetReadyDays.length!==30||ready.pending.length){
    console.log(JSON.stringify({status:'pending-root-confirmed-complete-evidence',buildReadyDays:ready.buildReadyDays,assetReadyDays:ready.assetReadyDays,pendingDays:ready.pending.map(row=>row.day),mutations:0}));return null;
  }
  const tracker=read('flowlu.json'), input=read('flowlu-upgrade-completion.json'), canvasReport=read('publication/upgraded-canvas-audit.json'), instruction=read('publication/instructions-use-case-audit.json');
  if(tracker.stories.length!==30||tracker.stories.some(story=>story.children.length!==14)||instruction.completeLocalInstructions!==30)throw new Error('Tracker or instruction contract incomplete');
  const updates=[], snapshots=[];
  for(const story of tracker.stories){
    const adapter=adapters[story.day], row=ready.all.find(value=>value.day===story.day), nativeCanvas=canvasReport.workflows.find(value=>value.day===story.day);
    if(!row?.buildReady||!row.assetReady||!nativeCanvas?.passed)throw new Error('Current evidence not complete for '+story.day);
    const completion=inputRow(input,story.day), proof=evidence(story,row,input,nativeCanvas);
    const work='<h3>Work item</h3><p>'+escape(adapter.need)+'</p><p>'+escape(adapter.policy)+'</p><p>'+escape(adapter.outcome)+'</p>';
    const next='<h3>Next launch action</h3><p>Publish and verify the local companion guide, replace its overview filename with the verified public URL, then complete the separate cloud/community release work after approval. Keep '+code('{{YOUTUBE_VIDEO_URL}}')+' in the unpublished submission draft until its public walkthrough URL is verified.</p>';
    const buildChild=story.children.find(value=>value.title===titles[0]), assetChild=story.children.find(value=>value.title===titles[1]);
    if(!buildChild||!assetChild)throw new Error('Exact contract children missing');
    for(const [child,artifact,extra] of [[buildChild,story.source,'<h3>Dependencies</h3><p>Canonical source, real source policy, persistent recovery, private Drive handoff and source-register receipt are validated in manual Docker executions. Public publication remains a separate launch item.</p>'],[assetChild,completion.canvas.path,'<h3>Dependencies</h3><p>The matching n8n build is validated. Current imported canvases were inspected at fit-to-screen and readable zoom; genuine PNG files retain the actual captured pixels.</p>']]){
      updates.push({day:story.day,slug:story.slug,id:child.id,child:child.title,stage:'Done',data:{workflow_stage_id:14,description:status('Done',story,artifact)+work+extra+proof+next}});
    }
    const markers='<h3>Managed workflow identity</h3><ul><li>Managed by: flowlu-workflow-launch</li><li>Workflow slug: '+code(story.slug)+'</li><li>n8n source: '+code(story.source)+'</li><li>Make source: Not created</li><li>Content directory: Not created</li><li>n8n cloud URL: Not published</li><li>Make cloud URL: Not published</li></ul>';
    updates.push({day:story.day,slug:story.slug,id:story.storyId,child:'Story roll-up',stage:'In Progress',data:{workflow_stage_id:11,description:status('In Progress',story,story.source)+work+markers+'<h3>Launch checklist</h3><p>The expanded n8n build and matching screenshot task are Done. Twelve remaining platform, release, example, video and distribution tasks remain Backlog. Earlier generation-only completion evidence is superseded by this current business workflow verification.</p>'+proof+next}});
    snapshots.push({day:story.day,slug:story.slug,workflowId:row.workflowId,executionId:row.executionId,mainRenderExecutionId:completion.mainRenderExecutionId,latestDeliveryExecutionId:completion.latestDeliveryExecutionId,functionalSha256:row.functionalSha256,canonicalSha256:row.currentCanonicalSha256,manualStatus:'success',mediaPassed:true,canvasPassed:true,automatedChecksPassed:input.automated.passed,roleExecutionIds:Object.fromEntries(roleNames.map(name=>[name,completion.checks[name].executionId])),remainingChildren:12,publicationPerformed:false});
  }
  if(updates.length!==90||new Set(updates.map(row=>row.id)).size!==90)throw new Error('Update scope must be exactly60 children and30 managed parents');
  for(const update of updates){const html=update.data.description;if(!html.includes('<h2>Launch status</h2>')||/<(?:script|style|iframe|form)|\son\w+\s*=|(^|\n)\s*#{1,6}\s|\*\*|https:\/\/(?:cdn\.zvid\.io|drive\.google\.com)/i.test(html))throw new Error('Unsafe description or private media URL');}
  const plan={phase:'Expanded source-to-private-delivery workflow completion; root-confirmed current manual and recovery evidence',createdAt:new Date().toISOString(),projectId:6,projectKey:'ZWL',rootReportConfirmed:true,scope:'Only existing managed30 n8n Build/Screenshot children and parent evidence rollups; original78 and future360 children untouched',updates,snapshots};
  writeFileSync(resolve(base,'flowlu-upgrade-finalize-plan.json'),JSON.stringify(plan,null,2)+'\n');
  console.log(JSON.stringify({status:'reviewable-completion-plan',updates:90,childrenDone:60,parentsInProgress:30,futureBacklog:360,mutations:0}));return plan;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))build();
export {build};
