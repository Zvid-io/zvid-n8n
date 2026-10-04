'use strict';
// Verify generated fixture structure in memory without importing, executing,
// writing cloud data, or overwriting the live root fixture file.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {createRequire}=require('node:module');
const filename=path.join(__dirname,'build-fixtures.js'),nativeRequire=createRequire(filename),written={};
const fakeFS={...fs,writeFileSync:(file,value)=>written[path.basename(file)]=String(value),mkdirSync:()=>{}};
const args=['node',filename,'--spreadsheet=BUILDER_MEMORY_ONLY_NEVER_IMPORT','--seeds='+path.join(__dirname,'upgraded-seeds.json')];
vm.runInNewContext(fs.readFileSync(filename,'utf8'),{require:name=>name==='node:fs'?fakeFS:nativeRequire(name),__dirname,process:{argv:args},console:{log:()=>{}},structuredClone},{timeout:5000});
const workflows=JSON.parse(written['fixtures.json']),manifest=JSON.parse(written['manifest.json']);
for(const workflow of workflows){
  const names=new Set(workflow.nodes.map(node=>node.name));assert.equal(names.size,workflow.nodes.length);
  assert.equal(workflow.active,false);assert.ok(!workflow.nodes.some(node=>node.type==='n8n-nodes-base.scheduleTrigger'));
  for(const [from,value] of Object.entries(workflow.connections)){assert.ok(names.has(from),from);for(const branch of value.main||[])for(const edge of branch)assert.ok(names.has(edge.node),`${workflow.id}: ${edge.node}`);}
  const submit=workflow.nodes.find(node=>node.name==='Submit render once');
  if(submit){assert.equal(submit.disabled,true);const incoming=Object.entries(workflow.connections).filter(([,value])=>value.main?.some(branch=>branch.some(edge=>edge.node===submit.name))).map(([from])=>from);assert.deepEqual(incoming,['Block new paid submissions']);assert.ok(workflow.nodes.find(node=>node.name==='Block new paid submissions').parameters.jsCode.includes('throw new Error'));}
}
const races=['SourceReadRace','DetailsReadRace'];for(const tag of races){const workflow=workflows.find(item=>item.id===`ZvidSeries2PubEdge${tag}`);assert.ok(workflow);const target=tag==='SourceReadRace'?'Recheck source revision':'Recheck related content';assert.deepEqual(workflow.connections[`Native ${target}`].main[0].map(edge=>edge.node),[target]);assert.ok(workflow.nodes.find(node=>node.name===target).parameters.jsCode.includes('simulated concurrent edit'));}
const lost=workflows.find(item=>item.id==='ZvidSeries2PubEdgeLostUploadResponse'),replay=workflows.find(item=>item.id==='ZvidSeries2PubEdgeLostUploadReplay');assert.ok(lost&&replay);assert.deepEqual(lost.connections['Upload private review video'].main[0].map(edge=>edge.node),['Deliberately lose upload response']);assert.equal(lost.nodes.find(node=>node.name==='Ensure publication ledger').parameters.tableName,replay.nodes.find(node=>node.name==='Ensure publication ledger').parameters.tableName);
const seedNode=name=>workflows.find(item=>item.id===`ZvidSeries2PubEdge${name}`).nodes.find(node=>node.name==='Edge prepare missing seeds').parameters.jsCode;
assert.equal(seedNode('LostUploadResponse'),seedNode('LostUploadReplay'));
console.log(JSON.stringify({status:'builder_structure_verified',fixtures:workflows.length,blockedWithoutSeeds:manifest.blocked.length,noWritesPerformed:true,paidNodesDisabledAndGuarded:true,raceFixturesLabelled:true,lostUploadLedgerShared:true}));
