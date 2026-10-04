'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {functionalHash}=require('./infra-functional-fingerprint');
const specs=require('../../../scripts/series-two-specs');
const reference=specs.map(spec=>{
  const filename=`zvid-${spec.slug}.json`,sourcePath=path.resolve(__dirname,'../../../workflows',filename),workflow=JSON.parse(fs.readFileSync(sourcePath,'utf8'));
  if(workflow.nodes.some(node=>node.credentials&&Object.keys(node.credentials).length))throw new Error(`Canonical workflow ${filename} contains credential bindings.`);
  return {day:spec.day,workflowId:`ZvidSeries2Day${spec.day}`,canonicalPath:`workflows/${filename}`,functionalHash:functionalHash(workflow),functionalNodeCount:workflow.nodes.filter(node=>node.type!=='n8n-nodes-base.stickyNote').length,nodeCount:workflow.nodes.length,canonicalCredentialFree:true};
});
fs.writeFileSync(path.join(__dirname,'infra-import-reference.json'),JSON.stringify({generatedAt:new Date().toISOString(),normalization:'Ignore sticky notes, node positions, credential bindings and display names; resolve connection names to node IDs; normalize QA workbook/folder Config IDs to blanks. Normalize omitted editor-added values to exactly the verified installed native defaults in infra-native-defaults-evidence.json. Retain explicit non-default parameters, code, execution settings, connections and pinData.',workflows:reference},null,2)+'\n');
console.log(JSON.stringify({canonicalReferences:reference.length,allCredentialFree:true,functionalNodes:reference[0].functionalNodeCount}));
