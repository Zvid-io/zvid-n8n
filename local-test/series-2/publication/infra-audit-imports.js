'use strict';
// Run inside Docker. Read-only metadata audit; never read credential data.
const fs=require('node:fs');
const sqlite=require('/usr/local/lib/node_modules/n8n/node_modules/sqlite3');
const {functionalHash}=require('/tmp/zvid-publication-functional-fingerprint.js');
const reference=JSON.parse(fs.readFileSync('/tmp/zvid-publication-import-reference.json','utf8'));
const expectedCredentials={zvidApi:'e3b494f287402c80c13bf080',googleSheetsOAuth2Api:'4brcFt0P3EihgxJb',googleDriveOAuth2Api:'UH2cKTIIc4ymModq'};
const requiredCredentialTypes={'@zvid/n8n-nodes-zvid.zvid':'zvidApi','n8n-nodes-base.googleSheets':'googleSheetsOAuth2Api','n8n-nodes-base.googleDrive':'googleDriveOAuth2Api'};
const expectedWorkbook='1gBrk4JqcTFhu8foSfNFzKFjsJxB-V0Qj8wvt2xmZ1IY',expectedFolder='1h6oON2cyIPATUP78tgJt6LhaFr_RB3uh';
const db=new sqlite.Database('/home/node/.n8n/database.sqlite',sqlite.OPEN_READONLY);
const ids=reference.workflows.map(w=>w.workflowId);
db.all('SELECT id,name,active,nodes,connections,settings,pinData,versionId FROM workflow_entity WHERE id IN ('+ids.map(()=>'?').join(',')+')',ids,(error,rows)=>{
  if(error)throw error;
  const results=reference.workflows.map(expected=>{
    const row=rows.find(w=>w.id===expected.workflowId);if(!row)return {...expected,found:false,passed:false};
    const parse=(value,fallback)=>value?JSON.parse(value):fallback;
    const workflow={nodes:parse(row.nodes,[]),connections:parse(row.connections,{}),settings:parse(row.settings,{}),pinData:parse(row.pinData,{})};
    const hash=functionalHash(workflow),config=JSON.parse(workflow.nodes.find(n=>n.name==='Config')?.parameters?.jsonOutput||'{}');
    const bound=workflow.nodes.filter(n=>n.credentials&&Object.keys(n.credentials).length).map(n=>({node:n.name,nodeType:n.type,credentialTypes:Object.keys(n.credentials),matchesExpected:Object.entries(n.credentials).every(([type,value])=>expectedCredentials[type]===value.id)}));
    const requiredBindings=workflow.nodes.filter(n=>requiredCredentialTypes[n.type]).map(n=>{const credentialType=requiredCredentialTypes[n.type];return {node:n.name,nodeType:n.type,credentialType,present:!!n.credentials?.[credentialType],matchesExpected:n.credentials?.[credentialType]?.id===expectedCredentials[credentialType]};});
    const credentialBindingsValid=bound.every(n=>n.matchesExpected)&&requiredBindings.every(n=>n.matchesExpected);
    const configMatches=config.spreadsheetId===expectedWorkbook&&config.driveFolderId===expectedFolder&&config.sourceSheet===`D${expected.day}Source`&&config.detailsSheet===`D${expected.day}Details`;
    const zvidNodes=workflow.nodes.filter(n=>n.type==='@zvid/n8n-nodes-zvid.zvid').map(n=>({node:n.name,resource:n.parameters.resource,operation:n.parameters.operation}));
    return {day:expected.day,workflowId:row.id,name:row.name,versionId:row.versionId,found:true,inactive:!row.active,nodeCount:workflow.nodes.length,functionalNodeCount:workflow.nodes.filter(n=>n.type!=='n8n-nodes-base.stickyNote').length,canonicalPath:expected.canonicalPath,canonicalCredentialFree:expected.canonicalCredentialFree,canonicalFunctionalHash:expected.functionalHash,installedFunctionalHash:hash,functionalMatch:hash===expected.functionalHash,qaConfigMatches:configMatches,credentialBindingsValid,requiredBindings,credentialBoundNodes:bound,zvidNodes,passed:!row.active&&expected.canonicalCredentialFree&&hash===expected.functionalHash&&configMatches&&credentialBindingsValid};
  });
  console.log(JSON.stringify({capturedAt:new Date().toISOString(),method:'Read-only local workflow_entity metadata versus credential-free canonical functional hashes',totalExpected:ids.length,totalFound:rows.length,totalPassed:results.filter(r=>r.passed).length,allPassed:results.every(r=>r.passed),credentialsDecrypted:false,workflows:results},null,2));db.close();
});
