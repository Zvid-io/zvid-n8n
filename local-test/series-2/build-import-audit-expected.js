'use strict';
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');const read=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const imports=read(path.join(__dirname,'imports.json'));const catalog=read(path.join(__dirname,'catalog.json'));
assert.equal(imports.length,30);assert.equal(new Set(imports.map(w=>w.id)).size,30);
const results=imports.map(workflow=>{
const entry=catalog.find(item=>item.workflowId===workflow.id);assert.ok(entry);const canonical=read(path.join(root,'workflows',entry.filename));
const clean=structuredClone(workflow);for(const node of clean.nodes)delete node.credentials;
assert.deepEqual(clean.nodes,canonical.nodes,'Configured nodes must match the credential-free canonical workflow');
assert.deepEqual(clean.connections,canonical.connections);assert.deepEqual(clean.settings,canonical.settings);
assert.equal(canonical.active,false);assert.ok(canonical.nodes.every(n=>!n.credentials));
return {id:workflow.id,name:workflow.name,nodes:workflow.nodes,connections:workflow.connections,settings:workflow.settings,active:false,canonicalFile:entry.filename,canonicalCredentialFree:true,canonicalParametersMatched:true};
});
fs.writeFileSync(path.join(__dirname,'import-audit-expected.json'),JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify({expected:results.length,canonicalsMatched:results.length,credentialFreeCanonicals:true}));
