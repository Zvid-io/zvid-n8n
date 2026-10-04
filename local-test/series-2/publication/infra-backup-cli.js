'use strict';
// Run inside local n8n Docker. Uses n8n's native export CLI for these 30 IDs only.
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const stamp=new Date().toISOString().replace(/[^0-9]/g,'');
const directory=`/tmp/zvid-series2-publication-backup-${stamp}`;
fs.mkdirSync(directory,{recursive:false});
const records=[];
for(let day=31;day<=60;day++){
  const id=`ZvidSeries2Day${day}`,file=path.join(directory,`${id}.json`);
  const run=spawnSync('n8n',['export:workflow',`--id=${id}`,`--output=${file}`,'--pretty'],{encoding:'utf8',timeout:60000,stdio:['ignore','pipe','pipe']});
  if(run.status!==0||!fs.existsSync(file))throw new Error(`Native workflow export failed for ${id}; no replacement is authorized by this helper.`);
  const saved=JSON.parse(fs.readFileSync(file,'utf8'));
  if(!Array.isArray(saved)||saved.length!==1||saved[0].id!==id)throw new Error(`Native export identity verification failed for ${id}.`);
  records.push({id,filename:path.basename(file),name:saved[0].name,versionId:saved[0].versionId,nodeCount:saved[0].nodes?.length||0,active:saved[0].active===true});
  if(records.length%5===0)console.log(`Native backup verified ${records.length}/30 workflows.`);
}
const manifest={capturedAt:new Date().toISOString(),directory,workflowCount:records.length,method:'n8n export:workflow --id=<day id> --output=<private temp file> --pretty',credentialsDecrypted:false,workflows:records};
fs.writeFileSync(path.join(directory,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({backupDirectory:directory,workflowCount:records.length,verified:true,credentialsDecrypted:false}));
