/** Inspect local evidence readiness without contacting any external service. */
import {readFileSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {inspectUpgradeDirectory} from './flowlu-upgrade-readiness.mjs';
const base=dirname(fileURLToPath(import.meta.url));
const read=name=>JSON.parse(readFileSync(resolve(base,name),'utf8'));
const report=read('flowlu.json'), executions=read('executions.json'), media=read('media-results.json').results;
if (report.upgrade) {
 const upgraded=inspectUpgradeDirectory(base);
 const summary={buildsDone:report.stories.filter(story=>story.children.find(child=>child.title==='[Build] Create n8n workflow').stage==='Done').length,
   readyDays:upgraded.buildReadyDays,assetReadyDays:upgraded.assetReadyDays,pending:upgraded.pending,
   integrationStatus:upgraded.integrationStatus,all:upgraded.all};
 writeFileSync(resolve(base,'flowlu-readiness.json'),JSON.stringify(summary,null,2)+'\n');
 console.log(JSON.stringify({buildsDone:summary.buildsDone,readyDays:summary.readyDays,assetReadyDays:summary.assetReadyDays,
   pendingDays:summary.pending.map(row=>row.day),integrationStatus:summary.integrationStatus}));
 process.exit(0);
}
const items=report.stories.map(story=>{
 const latest=executions.filter(x=>x.workflowId==='ZvidSeries2Day'+story.day && x.mode==='manual').sort((a,b)=>Number(b.id)-Number(a.id))[0];
 const matched=media.find(x=>x.day===story.day && Number(x.executionId)===Number(latest?.id));
 const build=story.children.find(x=>x.title==='[Build] Create n8n workflow');
 const priorRevisionOnly=report.upgrade && Number(latest?.id||0)<=Number(story.upgradeBaseline?.previousManualExecutionId||0);
 const upgradeEvidenceRequired=Boolean(report.upgrade);
 return {day:story.day,slug:story.slug,buildStage:build.stage,executionId:latest?.id,executionStatus:latest?.status||'Not tested',lastNode:latest?.lastNode,mediaPassed:matched?.mediaPassed===true,visualReview:matched?.visualReview||'Pending',priorRevisionOnly,upgradeEvidenceRequired,eligible:!upgradeEvidenceRequired && build.stage!=='Done' && latest?.status==='success' && latest?.lastNode==='Watch video' && matched?.mediaPassed===true && matched?.visualReview==='passed'};
});
const summary={buildsDone:items.filter(x=>x.buildStage==='Done').length,readyDays:items.filter(x=>x.eligible).map(x=>x.day),pending:items.filter(x=>x.buildStage!=='Done'&&!x.eligible).map(x=>({day:x.day,executionStatus:x.executionStatus,visualReview:x.visualReview,reason:x.priorRevisionOnly?'Superseded generation-only revision':x.upgradeEvidenceRequired?'Expanded business workflow evidence required':'Render/media verification pending'})),all:items};
writeFileSync(resolve(base,'flowlu-readiness.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({buildsDone:summary.buildsDone,readyDays:summary.readyDays,pending:summary.pending}));
