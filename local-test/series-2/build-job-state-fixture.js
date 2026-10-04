'use strict';
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const read=name=>JSON.parse(fs.readFileSync(path.join(__dirname,name),'utf8').replace(/^\uFEFF/,''));
const source=read('imports.json').find(w=>w.id==='ZvidSeries2Day31');
const ids=new Set(read('executions.json').map(e=>e.output?.jobId).filter(Boolean));
for(const incident of read('missing-upload-incidents.json'))if(incident.jobId||incident.acceptedJobId)ids.add(incident.jobId||incident.acceptedJobId);
assert.ok(ids.size>=18&&ids.size<=35,'Expected only known series-two job IDs');
const credentials=source.nodes.find(n=>n.type==='@zvid/n8n-nodes-zvid.zvid').credentials;
const code='const targets=new Set('+JSON.stringify([...ids])+');const jobs=$input.all().flatMap(item=>Array.isArray(item.json.jobs)?item.json.jobs:[item.json]);const matches=jobs.filter(job=>targets.has(String(job.id||job.jobId))).map(job=>({id:job.id||job.jobId,status:job.status||job.state||null,outputUrlPresent:Boolean(job.output_url||job.outputUrl||job.videoUrl),thumbnailUrlPresent:Boolean(job.thumbnail_url||job.thumbnailUrl),fileName:job.name||job.file_name||null}));const activeStatuses=new Set(["queued","waiting","processing","running","pending","rendering"]);return [{json:{requested:targets.size,found:matches.length,missing:[...targets].filter(id=>!matches.some(job=>job.id===id)),activeKnownJobs:matches.filter(job=>activeStatuses.has(String(job.status).toLowerCase())),jobs:matches}}];';
const fixture={id:'Series2EdgeJobStates',name:'TEST ONLY · Read accepted series-two job states',active:false,nodes:[
{id:'edge-states-start',name:'Test manually',type:'n8n-nodes-base.manualTrigger',typeVersion:1,position:[0,0],parameters:{}},
{id:'edge-states-list',name:'Read recent renders',type:'@zvid/n8n-nodes-zvid.zvid',typeVersion:1,position:[250,0],parameters:{resource:'render',operation:'getAll',limit:50,page:1,filterType:'video'},credentials,alwaysOutputData:true},
{id:'edge-states-match',name:'Known series job states',type:'n8n-nodes-base.code',typeVersion:2,position:[500,0],parameters:{jsCode:code}}
],connections:{'Test manually':{main:[[{node:'Read recent renders',type:'main',index:0}]]},'Read recent renders':{main:[[{node:'Known series job states',type:'main',index:0}]]}},pinData:{},settings:{executionOrder:'v1',executionTimeout:120},meta:{seriesTwoEdge:{testOnly:true,paidNodesRemoved:true,readOnly:true}}};
fs.writeFileSync(path.join(__dirname,'edge-job-states-fixture.json'),JSON.stringify([fixture],null,2)+'\n');
console.log(JSON.stringify({id:fixture.id,knownJobCount:ids.size,paidNodes:0}));
