'use strict';
const fs=require('node:fs');const path=require('node:path');
const source=JSON.parse(fs.readFileSync(path.join(__dirname,'imports.json'),'utf8')).find(w=>w.id==='ZvidSeries2Day35');
const credential=source.nodes.find(n=>n.type==='@zvid/n8n-nodes-zvid.zvid').credentials;
const fixture={id:'Series2EdgeRecovery35',name:'TEST ONLY · Recover accepted Day35 URL without rendering',active:false,nodes:[
  {id:'edge-recovery-start',name:'Test manually',type:'n8n-nodes-base.manualTrigger',typeVersion:1,position:[0,0],parameters:{}},
  {id:'edge-recovery-list',name:'Read recent renders',type:'@zvid/n8n-nodes-zvid.zvid',typeVersion:1,position:[250,0],parameters:{resource:'render',operation:'getAll',limit:50,page:1,filterType:'video'},credentials:credential,alwaysOutputData:true},
  {id:'edge-recovery-match',name:'Find accepted Day35 job',type:'n8n-nodes-base.code',typeVersion:2,position:[500,0],parameters:{jsCode:'const target="7ea52ac6-a58e-4a9c-b2f5-cc58edc2c57d";const jobs=$input.all().flatMap(item=>Array.isArray(item.json.jobs)?item.json.jobs:[item.json]);const match=jobs.find(job=>String(job.id||job.jobId)===target);if(!match)return [{json:{found:false,target,checked:jobs.length}}];return [{json:{found:true,id:match.id||match.jobId,status:match.status||match.state,outputUrl:match.output_url||match.outputUrl||match.videoUrl||null,thumbnailUrl:match.thumbnail_url||match.thumbnailUrl||null,returnValue:match.return_value||match.result||null,fileName:match.name||match.file_name||null}}];'}}
],connections:{'Test manually':{main:[[{node:'Read recent renders',type:'main',index:0}]]},'Read recent renders':{main:[[{node:'Find accepted Day35 job',type:'main',index:0}]]}},pinData:{},settings:{executionOrder:'v1',executionTimeout:120},meta:{seriesTwoEdge:{testOnly:true,sourceDay:35,paidNodesRemoved:true}}};
fs.writeFileSync(path.join(__dirname,'edge-recovery-fixture.json'),JSON.stringify([fixture],null,2)+'\n');
const edge=path.join(__dirname,'edge-results.json');if(fs.existsSync(edge))fs.writeFileSync(edge,fs.readFileSync(edge,'utf8').replace(/^\uFEFF/,''));
console.log(JSON.stringify({id:fixture.id,paidNodes:0}));
