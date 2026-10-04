'use strict';
// Host-side, read-only Docker queries. Save complete JSON atomically so other
// review tools cannot observe a half-written execution or import evidence file.
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {functionalHash}=require('./infra-functional-fingerprint');
const reference=JSON.parse(fs.readFileSync(path.join(__dirname,'infra-import-reference.json'),'utf8'));
for(const workflow of reference.workflows){
  const source=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../',workflow.canonicalPath),'utf8'));
  if(functionalHash(source)!==workflow.functionalHash)throw new Error('Regenerate and copy canonical references before refreshing evidence: '+workflow.workflowId);
}
function refresh(script,filename,args=[]){
  const result=spawnSync('docker',['exec','n8n','node',script,...args],{encoding:'utf8',timeout:30000,maxBuffer:32*1024*1024,windowsHide:true});
  if(result.status!==0)throw new Error('Read-only Docker query failed: '+script);
  const value=JSON.parse(result.stdout);
  const destination=path.join(__dirname,filename),temporary=destination+'.tmp';
  fs.writeFileSync(temporary,JSON.stringify(value,null,2)+'\n');
  fs.renameSync(temporary,destination);
  return value;
}
const execution=refresh('/tmp/zvid-publication-read-executions.js','upgraded-executions.json');
const summary={capturedAt:execution.capturedAt,manualDeliveredDays:execution.manualDeliveredDays,attemptCount:execution.attempts.length};
if(process.argv.includes('--audit')){
  const audit=refresh('/tmp/zvid-publication-audit-imports.js','infra-import-audit.json');
  summary.importsPassed=audit.totalPassed;
  summary.expectedImports=audit.totalExpected;
}
process.stdout.write(JSON.stringify(summary)+'\n');
