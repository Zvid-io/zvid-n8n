'use strict';
// Configure local QA copies only. Never modify credential-free canonical JSON.
const fs = require('node:fs');
const path = require('node:path');
const inputArg=process.argv.find(value=>value.startsWith('--input='));
const inputPath=inputArg?path.resolve(inputArg.slice(8)):path.resolve(__dirname,'../imports.json');
const evidence=JSON.parse(fs.readFileSync(path.join(__dirname,'infra-scaffold-evidence.json'),'utf8'));
const workbook=evidence.results.find(row=>row.workflowId==='ZvidSeries2PublicationCreateWorkbook'&&row.status==='success')?.evidence;
const folder=evidence.results.find(row=>row.workflowId==='ZvidSeries2PublicationCreateFolder'&&row.status==='success')?.evidence;
if(!workbook?.spreadsheetId||!folder?.folderId)throw new Error('Successful native private QA workbook/folder evidence is required.');
if(folder.shared===true)throw new Error('Expected the dedicated QA folder to remain private.');
const imports=JSON.parse(fs.readFileSync(inputPath,'utf8'));
if(!Array.isArray(imports)||imports.length!==30)throw new Error('Expected exactly the 30 Days31–60 workflows.');
const ids=new Set();
for(const workflow of imports){
  const match=/^ZvidSeries2Day(\d{2})$/.exec(workflow.id||'');
  const day=Number(match?.[1]);
  if(!match||day<31||day>60||ids.has(workflow.id))throw new Error('Unexpected or duplicate local workflow identity.');
  ids.add(workflow.id);workflow.active=false;
  const config=workflow.nodes.find(node=>node.name==='Config');
  if(!config||config.type!=='n8n-nodes-base.set'||config.parameters?.mode!=='raw')throw new Error(`D${day} has no raw publication Config node.`);
  const value=JSON.parse(config.parameters.jsonOutput);
  if(!Object.hasOwn(value,'spreadsheetId')||!Object.hasOwn(value,'driveFolderId'))throw new Error(`D${day} is still the former simple renderer; generate publication workflows first.`);
  Object.assign(value,{spreadsheetId:workbook.spreadsheetId,driveFolderId:folder.folderId,sourceSheet:`D${day}Source`,detailsSheet:`D${day}Details`});
  config.parameters.jsonOutput=JSON.stringify(value,null,2);
  for(const node of workflow.nodes){
    if(node.type==='@zvid/n8n-nodes-zvid.zvid')node.credentials={zvidApi:{id:'e3b494f287402c80c13bf080',name:'Zvid workflow series'}};
    if(node.type==='n8n-nodes-base.googleSheets')node.credentials={googleSheetsOAuth2Api:{id:'4brcFt0P3EihgxJb',name:'Google Sheets account'}};
    if(node.type==='n8n-nodes-base.googleDrive')node.credentials={googleDriveOAuth2Api:{id:'UH2cKTIIc4ymModq',name:'Google Drive account'}};
  }
}
const output=path.join(__dirname,'infra-configured-imports.json');
fs.writeFileSync(output,JSON.stringify(imports,null,2)+'\n');
const manifest={generatedAt:new Date().toISOString(),sourceFile:path.relative(path.resolve(__dirname,'../../..'),inputPath),outputFile:path.relative(path.resolve(__dirname,'../../..'),output),workflowCount:imports.length,workflowIds:[...ids],spreadsheetId:workbook.spreadsheetId,driveFolderId:folder.folderId,allInactive:imports.every(w=>!w.active),canonicalFilesModified:false,requiresBackupBeforeImport:true};
fs.writeFileSync(path.join(__dirname,'infra-configured-imports-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({workflowCount:imports.length,output:manifest.outputFile,allInactive:manifest.allInactive,canonicalFilesModified:false}));
