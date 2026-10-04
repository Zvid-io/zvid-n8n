'use strict';
// Independent read-only authoring audit. This is not a live execution or n8n acceptance claim.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { adapters, serializeRuntime } = require('../../../scripts/series-two-source-adapters');
const { functionalHash } = require('./infra-functional-fingerprint');
const ROOT = __dirname, N8N = path.resolve(ROOT, '../../..');
const STICKY = 'n8n-nodes-base.stickyNote', ZVID = '@zvid/n8n-nodes-zvid.zvid';
const bytesHash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const words = value => String(value).replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[#*`]/g, '').trim().split(/\s+/).filter(Boolean).length;
function audit(adapter) {
  const sourceFile = path.join(N8N,'workflows',`zvid-${adapter.slug}.json`), guideFile=path.join(N8N,'workflows',`${adapter.slug}.md`);
  const bytes=fs.readFileSync(sourceFile), workflow=JSON.parse(bytes), guideBytes=fs.readFileSync(guideFile), guide=guideBytes.toString('utf8');
  const byName=new Map(workflow.nodes.map(node=>[node.name,node])), notes=workflow.nodes.filter(node=>node.type===STICKY), functional=workflow.nodes.filter(node=>node.type!==STICKY);
  const overview=notes.find(node=>node.parameters.color===1), config=JSON.parse(byName.get('Config').parameters.jsonOutput);
  const groups=workflow.meta?.seriesTwo?.groups||[], counts=new Map();for(const group of groups)for(const name of group.nodes)counts.set(name,(counts.get(name)||0)+1);
  const edge=(from,to)=>Object.values(workflow.connections[from]||{}).some(outputs=>outputs.some(output=>output.some(item=>item.node===to)));
  const policy=functional.find(node=>node.type==='n8n-nodes-base.code'&&node.name.startsWith('Apply ')&&node.name.endsWith(' policy'));
  const native=(name,type,operation)=>byName.get(name)?.type===type&&(!operation||byName.get(name).parameters.operation===operation);
  const mentions=(...phrases)=>phrases.every(phrase=>guide.includes(phrase));
  const watch=byName.get('Watch video'), http=functional.filter(node=>node.type==='n8n-nodes-base.httpRequest');
  const checks={
    explicitNeedAudiencePolicyOutcome:[adapter.need,adapter.audience,adapter.policy,adapter.outcome,adapter.refreshPolicy].every(value=>typeof value==='string'&&value.trim())&&mentions(adapter.need,adapter.policy,adapter.outcome),
    scalarSourceSchemaDocumented:mentions(adapter.primaryHeaders.join(', '),adapter.detailHeaders.join(', '),'separate Sheets column','do not paste the JSON into one cell'),
    honestSourceProvenance:mentions('populate these scalar columns from that system','authorized','source_url','illustrative example URL is not a production source'),
    scopedInstallationBeforeCredentials:guide.indexOf('@zvid/n8n-nodes-zvid')<guide.indexOf('Create **Zvid API**')&&mentions('Settings → Community nodes','workspace owner/admin','https://app.zvid.io/api-keys','https://api.zvid.io','Google Sheets and Google Drive OAuth2'),
    installationVisibleOnCanvas:overview?.parameters.content.includes('@zvid/n8n-nodes-zvid')&&overview.parameters.content.includes('Settings → Community nodes')&&overview.parameters.content.includes('workspace owner/admin')&&overview.parameters.content.includes('https://app.zvid.io/api-keys'),
    oneFittingOverviewAndNeutralGroups:notes.filter(node=>node.parameters.color===1).length===1&&words(overview.parameters.content)>=100&&words(overview.parameters.content)<=300&&overview.parameters.content.includes('### How it works')&&overview.parameters.content.includes('### Setup')&&notes.filter(node=>node!==overview).every(node=>node.parameters.color===7&&/^## \d+\./.test(node.parameters.content)&&words(node.parameters.content)<50)&&groups.every(group=>group.nodes.length>=2)&&functional.every(node=>counts.get(node.name)===1),
    realNativeSourceAndDomainAdapter:native('Read source register','n8n-nodes-base.googleSheets','read')&&native('Read related records','n8n-nodes-base.googleSheets','read')&&policy?.parameters.jsCode.startsWith(serializeRuntime(adapter.day))&&policy.parameters.jsCode.includes(`sourceCandidates(${adapter.day},`),
    explicitNoWorkAndRevisionDedup:native('Fingerprint approved content','n8n-nodes-base.crypto')&&native('Eligible work found?','n8n-nodes-base.if')&&native('No work report','n8n-nodes-base.code')&&edge('Eligible work found?','No work report')&&mentions('fingerprint','unchanged','revision'),
    persistentFrozenRecoveryExplained:mentions('input, project, brief and full authoritative context','submitting','accepted','completed','uploaded','delivered','A lost paid response','reconciliation','Do not submit a replacement while acceptance is unknown','does not guarantee exactly-once execution under concurrency')&&native('Read saved requests','n8n-nodes-base.dataTable','get')&&native('Look up saved request','n8n-nodes-base.dataTable','get')&&native('Decide recovery','n8n-nodes-base.code'),
    paidSubmissionAndUploadDoNotBlindlyRetry:native('Submit render once',ZVID,'create')&&byName.get('Submit render once').retryOnFail!==true&&edge('Persist submission intent','Submit render once')&&edge('Capture accepted job','Persist accepted job')&&native('Upload private review video','n8n-nodes-base.googleDrive','upload')&&byName.get('Upload private review video').retryOnFail!==true&&mentions('Uploads have no blind retries','not form an atomic uniqueness lock'),
    freeQuoteCreditBudgetAndTrueDryRunExplained:config.dryRun===false&&config.maxRenderCredits>0&&native('Validate project (free)',ZVID,'validate')&&native('Check validation and credit cap','n8n-nodes-base.code')&&mentions('`dryRun: false` renders and spends credits','maxRenderCredits','`dryRun: true`','draft_unavailable','Saved request inspection'),
    privateNativeDeliveryAndMetadataReconciliation:native('Find existing delivery','n8n-nodes-base.googleDrive','search')&&native('Reconcile delivery file','n8n-nodes-base.code')&&mentions('private output folder','appProperties.zvid_request_hash','filename alone is insufficient evidence','workflow adds no public-sharing permissions'),
    sourceWritebackAndReceiptVerified:native('Recheck source revision','n8n-nodes-base.googleSheets','read')&&native('Recheck related content','n8n-nodes-base.googleSheets','read')&&native('Update business register','n8n-nodes-base.googleSheets','update')&&native('Read back delivery receipt','n8n-nodes-base.googleSheets','read')&&native('Read related receipt content','n8n-nodes-base.googleSheets','read')&&edge('Mark delivered','Persist delivered outcome')&&mentions('Both the primary and related records are reread','before writeback and after the receipt'),
    boundedGatedWatchAndOrdinaryMediaGets:edge('Completed video available?','Watch video')&&watch?.type==='n8n-nodes-base.httpRequest'&&watch.parameters.options.timeout===30000&&watch.retryOnFail===true&&watch.maxTries===3&&watch.waitBetweenTries===5000&&watch.onError==='continueRegularOutput'&&http.every(node=>['={{ $json.videoUrl }}','={{ $json.video_url }}'].includes(node.parameters.url))&&mentions('Watch video → Binary → data → View','ordinary media GET','All supported Zvid API operations use the published native Zvid node'),
    cleanCredentialFreeInactiveExport:workflow.active===false&&workflow.nodes.every(node=>!node.credentials)&&config.spreadsheetId===''&&config.driveFolderId===''&&!JSON.stringify(workflow).includes('CUSTOM.')&&functional.every(node=>node.type.startsWith('n8n-nodes-base.')||node.type===ZVID),
    honestSummaryAndPublicationScope:mentions('business owner reviews the asset before customer messaging or public publication','does not replace full procedures or source records','Full context remains in Sheets and the n8n ledger','## Publication submission draft','n8n decides acceptance','verified public link before submission','Support: https://zvid.io/contact'),
    submissionWalkthroughPlaceholder:mentions('Workflow walkthrough: {{YOUTUBE_VIDEO_URL}}'),
    explicitRevisionAndReportingPolicy:adapter.refreshPeriod==='day'?mentions('request key includes the UTC reporting date','Within that day, a delivered fingerprint is suppressed'):mentions('event workflow: one request is created per approved source revision and destination folder','An unchanged delivered revision is suppressed'),
    noInventedDetailRequirement:adapter.day!==38||mentions('qualify without related rows'),
  };
  return {day:adapter.day,slug:adapter.slug,title:adapter.title,audience:adapter.audience,need:adapter.need,policy:adapter.policy,outcome:adapter.outcome,refreshPeriod:adapter.refreshPeriod,
    functionalHash:functionalHash(workflow),artifactSha256:bytesHash(bytes),guideSha256:bytesHash(guideBytes),
    source:{path:`../../../workflows/zvid-${adapter.slug}.json`,guide:`../../../workflows/${adapter.slug}.md`,sourceTab:adapter.sourceTab,detailsTab:adapter.detailsTab,detailKinds:Object.keys(adapter.detailKinds)},
    functionalNodes:functional.length,overviewWords:words(overview.parameters.content),checks,localInstructionsComplete:Object.values(checks).every(Boolean),
    publicationPrerequisite:'The companion guide is local; publish and verify its public URL and replace the overview filename before actual submission.',
    actualSubmissionAssessed:false,liveDeliveryAssessed:false,findings:Object.entries(checks).filter(([,passed])=>!passed).map(([name])=>name)};
}
function build(){
  const workflows=Object.values(adapters).sort((a,b)=>a.day-b.day).map(audit);
  const report={schemaVersion:1,auditedAt:new Date().toISOString(),method:'Independent current canonical JSON, guide and adapter review; no workflow or tracking changes',
    total:workflows.length,completeLocalInstructions:workflows.filter(row=>row.localInstructionsComplete).length,
    publicCompanionLinksPending:30,actualSubmissionPerformed:false,workflowStateChanged:false,flowluChanged:false,
    distinctPolicies:new Set(workflows.map(row=>row.policy)).size,distinctBusinessNeeds:new Set(workflows.map(row=>row.need)).size,
    workflows};
  fs.writeFileSync(path.join(ROOT,'instructions-use-case-audit.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({total:report.total,completeLocalInstructions:report.completeLocalInstructions,distinctPolicies:report.distinctPolicies,distinctBusinessNeeds:report.distinctBusinessNeeds,findings:workflows.filter(row=>row.findings.length).map(({day,findings})=>({day,findings}))}));
  return report;
}
if(require.main===module)build();
module.exports={audit,build};
