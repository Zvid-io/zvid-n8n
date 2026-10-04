'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { auditDom, normalized, pngStructure, representativeReadable } = require('./build-upgraded-canvas-audit');
function fixture() {
  const nodes = [], groups = [], rawNodes = [];
  const box = (x,y,width,height) => ({x,y,width,height});
  for (let i = 0; i < 10; i++) {
    const x = i * 1000, name = `${i+1}. Section ${i+1}`, id = `note-${i}`;
    const content = `## ${name}\nRead approved records and preserve their actual revision.`;
    nodes.push({ id, name, type:'n8n-nodes-base.stickyNote',parameters:{color:7,width:880,height:400,content} });
    rawNodes.push({id,name,type:'n8n-nodes-base.stickyNote',rect:box(x,0,880,400),sticky:{width:'880px',height:'400px',rect:box(x,0,880,400),text:`${name}\nRead approved records and preserve their actual revision.`,contentRect:box(x+15,15,850,100),clientWidth:850,scrollWidth:850,clientHeight:100,scrollHeight:100}});
    const names=[];
    for(let j=0;j<2;j++){
      const nodeName=`Step ${i}-${j}`,nodeId=`step-${i}-${j}`,nx=x+80+j*250;
      nodes.push({id:nodeId,name:nodeName,type:'n8n-nodes-base.code',parameters:{}});
      rawNodes.push({id:nodeId,name:nodeName,type:'n8n-nodes-base.code',rect:box(nx,180,96,96),labelRect:box(nx-25,284,146,30),labelText:nodeName});names.push(nodeName);
    }
    groups.push({note:name,nodes:names});
  }
  nodes.push({id:'overview',name:'Overview',type:'n8n-nodes-base.stickyNote',parameters:{color:1,width:660,height:1140,content:'## A complete business handoff\n### How it works\nRead an approved source.\n### Setup\nInstall the published node.'}});
  rawNodes.push({id:'overview',name:'Overview',type:'n8n-nodes-base.stickyNote',rect:box(-760,0,660,1140),sticky:{width:'660px',height:'1140px',rect:box(-760,0,660,1140),text:'A complete business handoff\nHow it works\nRead an approved source.\nSetup\nInstall the published node.',contentRect:box(-745,15,630,200),clientWidth:630,scrollWidth:630,clientHeight:200,scrollHeight:200}});
  return {workflow:{nodes,meta:{seriesTwo:{groups}}},raw:{day:31,workflowId:'ZvidSeries2Day31',url:'http://localhost:5678/workflow/ZvidSeries2Day31',capturedAt:'2026-10-01T12:00:00.000Z',nodes:rawNodes}};
}
test('actual current notes, icons and labels pass only when fully measured',()=>{const f=fixture(),r=auditDom(f.raw,f.workflow,31);assert.deepEqual(r.errors,[]);assert.equal(r.allTextFits,true);assert.equal(r.allFunctionalNodesCovered,true);assert.equal(r.overlaps.length,0);});
test('missing native label measurements remain incomplete',()=>{const f=fixture();f.raw.nodes.find(n=>n.type!=='n8n-nodes-base.stickyNote').labelRect=null;const r=auditDom(f.raw,f.workflow,31);assert.equal(r.allNodeIconsCovered,true);assert.equal(r.allFunctionalNodesCovered,false);assert.ok(r.errors.some(e=>e.includes('actual label bounds missing')));});
test('a section that exceeds its reserved header fails even inside a large enclosing card',()=>{const f=fixture();f.raw.nodes[0].sticky.contentRect.height=200;const r=auditDom(f.raw,f.workflow,31);assert.equal(r.allTextFits,false);assert.ok(r.errors.some(e=>e.includes('reserved header')));});
test('native scroll overflow is not hidden by large card dimensions',()=>{const f=fixture();f.raw.nodes[0].sticky.scrollWidth=900;assert.equal(auditDom(f.raw,f.workflow,31).allTextFits,false);});
test('stale note text and duplicate/unknown group membership cannot pass',()=>{const f=fixture();f.raw.nodes[0].sticky.text+=' Old text';f.workflow.meta.seriesTwo.groups[1].nodes.push('Step 0-0','Missing');const r=auditDom(f.raw,f.workflow,31);assert.equal(r.nativeContentMatches,false);assert.equal(r.allFunctionalNodesCovered,false);assert.ok(r.errors.some(e=>e.includes('unknown functional node')));});
test('labels outside their intended section and node collisions remain errors',()=>{const f=fixture();const n=f.raw.nodes.find(n=>n.name==='Step 0-0');n.labelRect.x=980;const r=auditDom(f.raw,f.workflow,31);assert.equal(r.allFunctionalNodesCovered,false);const other=f.raw.nodes.find(n=>n.name==='Step 0-1');other.rect={...n.rect};assert.ok(auditDom(f.raw,f.workflow,31).overlaps.length>0);});
test('heading/list presentation normalizes without accepting truncated note content',()=>{assert.equal(normalized('## 1. Read source\n**Approved** `revision`'),normalized('1. Read source\nApproved revision'));assert.notEqual(normalized('## Read source\nKeep full records.'),normalized('Read source'));});
test('JPEG headers and truncated PNG payloads do not count as genuine PNG evidence',()=>{assert.equal(pngStructure(Buffer.from([255,216,255,0])),null);assert.equal(pngStructure(Buffer.from('89504e470d0a1a0a','hex')),null);});
test('tall sections require inspected matching lower-row captures and current canonical provenance',()=>{
  const item={readable:true,captureSha256:'top',scale:1,bottomReadable:true,bottomCaptureSha256:'bottom'},png={originalSha256:'top'},bottom={originalSha256:'bottom'};
  assert.equal(representativeReadable(item,png,bottom,true,true,true),true);
  assert.equal(representativeReadable(item,png,null,true,true,true),false);
  assert.equal(representativeReadable({...item,bottomCaptureSha256:'old'},png,bottom,true,true,true),false);
  assert.equal(representativeReadable(item,png,bottom,true,true,false),false);
  assert.equal(representativeReadable(item,png,bottom,true,false,true),false);
});
