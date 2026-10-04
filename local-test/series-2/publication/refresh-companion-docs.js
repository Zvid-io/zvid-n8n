'use strict';
// Companion guides only: never writes a canonical JSON or local import.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const specs=require('../../../scripts/series-two-specs');
const {adapters}=require('../../../scripts/series-two-source-adapters');
const {buildPublicationDoc}=require('../../../scripts/series-two-publication-framework');
const root=path.resolve(__dirname,'../../..');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const before=new Map(specs.map(spec=>{const file=path.join(root,'workflows','zvid-'+spec.slug+'.json');return [spec.day,{file,bytes:fs.readFileSync(file)}];}));
for(const spec of specs){
  const workflow=JSON.parse(before.get(spec.day).bytes.toString('utf8'));
  const cfg=JSON.parse(workflow.nodes.find(node=>node.name==='Config').parameters.jsonOutput);
  const doc=buildPublicationDoc(spec,adapters[spec.day],cfg);
  assert.equal(doc.split('Workflow walkthrough: {{YOUTUBE_VIDEO_URL}}').length-1,1);
  assert.ok(doc.split('## Publication submission draft')[1].includes('Workflow walkthrough: {{YOUTUBE_VIDEO_URL}}'));
  fs.writeFileSync(path.join(root,'workflows',spec.slug+'.md'),doc+'\n');
}
const canonicals=specs.map(spec=>{
  const saved=before.get(spec.day),after=fs.readFileSync(saved.file);
  assert.ok(saved.bytes.equals(after),'Canonical JSON bytes changed for D'+spec.day);
  return {day:spec.day,file:path.relative(root,saved.file).replaceAll('\\','/'),beforeSha256:sha(saved.bytes),afterSha256:sha(after),byteIdentical:true};
});
const evidence={generatedAt:new Date().toISOString(),changedGuides:30,walkthroughPlaceholderRetained:true,canonicalJsonWrites:0,allCanonicalJsonByteIdentical:true,canonicals};
fs.writeFileSync(path.join(__dirname,'companion-walkthrough-placeholder-proof.json'),JSON.stringify(evidence,null,2)+'\n');
process.stdout.write(JSON.stringify({changedGuides:30,walkthroughPlaceholderRetained:true,allCanonicalJsonByteIdentical:true,canonicalJsonWrites:0})+'\n');
