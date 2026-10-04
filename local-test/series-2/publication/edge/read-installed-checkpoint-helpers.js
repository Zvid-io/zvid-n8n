'use strict';
// Read-only native helper/import audit. Never reads credential tables or emits
// credential values, workflow source code, raw projects, or media URLs.
const fs=require('node:fs');
const sqlite=require('/usr/local/lib/node_modules/n8n/node_modules/sqlite3');
const {functionalHash}=require('/tmp/zvid-publication-functional-fingerprint.js');
const reference=JSON.parse(fs.readFileSync('/tmp/zvid-publication-checkpoint-audit-reference.json','utf8'));
const decode=value=>typeof value==='string'?JSON.parse(value):value;
const db=new sqlite.Database('/home/node/.n8n/database.sqlite',sqlite.OPEN_READONLY);
const ids=[...reference.helpers.map(row=>row.workflowId),...reference.canonicals.map(row=>row.workflowId)];
db.all('SELECT id,name,active,nodes,connections,settings FROM workflow_entity WHERE id IN ('+ids.map(()=>'?').join(',')+')',ids,(error,rows)=>{
  if(error)throw error;
  const workflows=new Map(rows.map(row=>[row.id,{...row,nodes:decode(row.nodes),connections:decode(row.connections),settings:decode(row.settings)}]));
  const helpers=reference.helpers.map(wanted=>{
    const current=workflows.get(wanted.workflowId);if(!current)return {workflowId:wanted.workflowId,found:false,passed:false};
    const nodes=current.nodes,preflight=nodes.find(node=>node.name==='Verify all 30 delivered frozen requests');
    const match=preflight?.parameters?.jsCode?.match(/^const expected=(.*?);const columns=/);
    const expected=match?JSON.parse(match[1]):[];
    const readNodes=nodes.filter(node=>/^Read D\d+ synthetic ledger$/.test(node.name));
    const writes=nodes.filter(node=>node.type==='n8n-nodes-base.dataTable'&&node.parameters.operation==='update');
    const allowed=['n8n-nodes-base.manualTrigger','n8n-nodes-base.dataTable','n8n-nodes-base.code','n8n-nodes-base.stickyNote'];
    const revisions=Object.fromEntries(expected.map(item=>[item.day,item.revision]));
    const d50=readNodes.find(node=>node.name==='Read D50 synthetic ledger');
    const filters=d50?.parameters?.filters?.conditions||[];
    const details={workflowId:current.id,url:'http://localhost:5678/workflow/'+current.id,name:current.name,found:true,inactive:current.active===0||current.active===false,functionalSha256:functionalHash(current),expectedFunctionalSha256:wanted.functionalSha256,nativeOnly:nodes.every(node=>allowed.includes(node.type)&&!node.credentials),readCount:readNodes.length,writeCount:writes.length,syntheticRevisionByDay:revisions,dailyRequestPeriods:[...new Set(expected.filter(item=>item.requestPeriod).map(item=>item.requestPeriod))],qaFolderIds:[...new Set(expected.map(item=>item.driveFolderId))],d50ReadFilters:filters.map(filter=>({key:filter.keyName,value:filter.keyValue})),readExecuteOnce:readNodes.every(node=>node.executeOnce===true),targetStatus:wanted.targetStatus};
    details.passed=details.inactive&&details.nativeOnly&&details.functionalSha256===wanted.functionalSha256&&expected.length===30&&details.readCount===30&&details.writeCount===30&&details.readExecuteOnce&&Object.entries(revisions).every(([day,revision])=>revision===(Number(day)===50?'r2':'r1'))&&details.qaFolderIds.length===1&&details.qaFolderIds[0]===reference.qaFolderId&&details.dailyRequestPeriods.length===1&&details.dailyRequestPeriods[0]===reference.dailyRequestPeriod&&filters.some(filter=>filter.keyName==='revision'&&filter.keyValue==='r2')&&filters.some(filter=>filter.keyName==='request_key'&&filter.keyValue===reference.d50RequestKey);
    return details;
  });
  const canonicals=reference.canonicals.map(wanted=>{
    const current=workflows.get(wanted.workflowId);if(!current)return {day:wanted.day,workflowId:wanted.workflowId,found:false,passed:false};
    const config=JSON.parse(current.nodes.find(node=>node.name==='Config').parameters.jsonOutput);
    const parameters={spreadsheetId:config.spreadsheetId,driveFolderId:config.driveFolderId,sourceSheet:config.sourceSheet,detailsSheet:config.detailsSheet};
    const hash=functionalHash(current);
    return {day:wanted.day,workflowId:current.id,found:true,functionalSha256:hash,functionalMatch:hash===wanted.functionalSha256,parameters,passed:hash===wanted.functionalSha256&&parameters.spreadsheetId===reference.qaSpreadsheetId&&parameters.driveFolderId===reference.qaFolderId&&parameters.sourceSheet===wanted.sourceSheet&&parameters.detailsSheet===wanted.detailsSheet};
  });
  process.stdout.write(JSON.stringify({capturedAt:new Date().toISOString(),readOnly:true,noCredentialsRead:true,helperCount:helpers.length,canonicalCount:canonicals.length,passed:helpers.every(row=>row.passed)&&canonicals.every(row=>row.passed),helpers,canonicals},null,2)+'\n');
  db.close();
});
