/** Prepare final screenshot Asset updates after root all-30 actual-canvas approval. */
import {readFileSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {esc,validateHtml,FLOWLU} from './flowlu-plan.mjs';
if(!process.argv.includes('--root-all30-approved')) throw new Error('Root all-30 canvas inspection approval is required.');
const base=dirname(fileURLToPath(import.meta.url)),read=n=>JSON.parse(readFileSync(resolve(base,n),'utf8'));
const report=read('flowlu.json'),checks=read('flowlu-final-canvas-check.json'),fit=read('flowlu-canvas-evidence.json'),overviews=read('flowlu-overview-evidence.json');
if(checks.pairCount!==30 || checks.rootAll30ActualCanvasesInspected!==true) throw new Error('All 30 screenshot pairs are not verified');
const updates=[];
for(const story of report.stories){
 const pair=checks.pairs.find(x=>x.day===story.day),f=fit.find(x=>x.day===story.day),o=overviews.find(x=>x.day===story.day);
 if(!pair?.pngsVerified || pair.cards!==7 || !pair.allTextFits || pair.overlapCount!==0 || !o?.publicationReadable) throw new Error('Screenshot pair incomplete for day '+story.day);
 const child=story.children.find(x=>x.title==='[Asset] Capture n8n workflow screenshot');
 const description='<h2>Launch status</h2><ul><li>Stage: Done</li><li>Workflow slug: <code>'+esc(story.slug)+'</code></li><li>Source: <code>'+esc(story.source)+'</code></li><li>Publication state: Not published</li></ul>'+
 '<h2>Work item</h2><p>Capture and inspect the actual local Docker n8n workflow canvas and readable overview.</p>'+
 '<h2>Completion evidence</h2><ul>'+
 '<li>Full fit PNG: <code>'+esc(f.path)+'</code>; '+f.width+' by '+f.height+'; SHA-256 <code>'+esc(f.sha256)+'</code>.</li>'+
 '<li>Readable overview PNG: <code>'+esc(o.path)+'</code>; '+o.width+' by '+o.height+'; SHA-256 <code>'+esc(o.sha256)+'</code>.</li>'+
 '<li>Actual canvas QA: <code>'+esc(pair.qa)+'</code>; 7 cards, allTextFits=true, no overlaps.</li>'+
 '<li>The root task confirmed all 30 actual n8n canvases and notes were inspected, with readable overview content in the viewport. The original browser captures are preserved; the PNG copies use identical decoded pixels.</li>'+
 '<li>PNG pair verification: <code>zvid-integrations/n8n/local-test/series-2/flowlu-final-canvas-check.json</code>.</li></ul>'+
 '<h2>Dependencies and next action</h2><p>The authored canvas, note layout and screenshot pair are verified. Recapture only if the canvas or note content changes. Public companion guide publication is tracked separately in the release/community items.</p>';
 updates.push({id:child.id,slug:story.slug,child:child.title,stage:'Done',data:{description:validateHtml(description),workflow_stage_id:FLOWLU.stages.Done}});
 const stages=story.children.map(x=>x.id===child.id?'Done':x.stage),counts=stages.reduce((a,s)=>(a[s]=(a[s]||0)+1,a),{}),remaining=stages.filter(x=>x!=='Done').length;
 const parent='<h2>Launch status</h2><p>The current request covers local n8n templates and Docker manual testing. Current child stages: '+Object.entries(counts).map(([s,n])=>n+' '+esc(s)).join('; ')+'. Remaining children: '+remaining+'; blocked children: 0. The screenshot Asset is complete; public releases and distribution are separate launch items.</p>'+
 '<h2>Managed workflow</h2><ul><li>Managed by: flowlu-workflow-launch</li><li>Workflow slug: <code>'+esc(story.slug)+'</code></li><li>n8n source: <code>'+esc(story.source)+'</code></li><li>Make source: Not created</li><li>Content directory: Not created</li><li>n8n cloud URL: Not published</li><li>Make cloud URL: Not published</li></ul>'+
 '<h2>Completion evidence</h2><p>The actual full canvas and readable overview PNG pair are checked, with 7 notes fitting and no overlap. See <code>zvid-integrations/n8n/local-test/series-2/flowlu-final-canvas-check.json</code>. Manual execution and media verification remain in the n8n Build child.</p>'+
 '<h2>Public companion prerequisite</h2><p>The local guide is <code>'+esc(story.companionGuide)+'</code>. Before a future public template/community release, publish it, verify its public URL, and replace the inline filename in the overview with that verified guide link.</p>'+
 '<h2>Next action</h2><p>Complete remaining local manual execution/media work, then finish other launch items when requested. Keep this Story In Progress until every required child is Done or explicitly completed as out of scope.</p>';
 updates.push({id:story.storyId,slug:story.slug,child:'Story roll-up',stage:'In Progress',data:{description:validateHtml(parent)}});
}
const plan={phase:'All 30 actual canvases approved; screenshot PNG pairs verified',snapshots:[],updates};
writeFileSync(resolve(base,'flowlu-asset-updates.json'),JSON.stringify(plan,null,2)+'\n');
console.log(JSON.stringify({assetTasks:30,parentRollups:30,updates:updates.length}));

