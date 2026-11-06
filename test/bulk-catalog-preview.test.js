'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const workflow=JSON.parse(fs.readFileSync(path.join(__dirname,'../workflows/zvid-bulk-catalog-videos.json'),'utf8'));
test('bulk dry-run draft receives the validated resolved project',()=>{
  const payload={name:'Aurora',scenes:[{duration:3,visuals:[]}]};
  const check=workflow.nodes.find(n=>n.name==='Check validation').parameters.jsCode;
  const build={payload:{variables:{product:'default'}},items:[{variables:{product:'Aurora'}}],meta:{products:[{product:'Aurora'}]}};
  const result=new Function('$input','$',check)({first:()=>({json:{valid:true,payload,creditsRequired:12}})},()=>({first:()=>({json:build})}))[0].json;
  assert.deepEqual(result.resolvedFirst,payload);
  const expression=workflow.nodes.find(n=>n.name==='Save draft to editor').parameters.projectJson.replace(/^=\{\{\s*/, '').replace(/\s*\}\}$/,'');
  const draft=JSON.parse(new Function('$json',`return (${expression});`)(result));
  assert.deepEqual(draft,payload);assert.equal(result.totalCredits,12);
});
