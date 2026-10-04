'use strict';
// Use only AFTER the named native captures were actually inspected with view_image.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=__dirname,FILE=path.join(ROOT,'upgraded-canvas-readability.json');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function inspectedFile(value){const full=path.resolve(ROOT,value),rel=path.relative(ROOT,full);if(rel.startsWith('..')||path.isAbsolute(rel))throw new Error('Review file outside publication');return{full,sha256:sha(fs.readFileSync(full))};}
function recordOverview(day){
  const raw=JSON.parse(fs.readFileSync(path.join(ROOT,'canvas',`day-${day}-dom.json`),'utf8'));
  const fit=inspectedFile(raw.fitPng),overview=inspectedFile(raw.overviewPng),text=raw.overviewView?.textRect;
  if(!text||text.x<0||text.y<72||text.x+text.width>1280||text.y+text.height>688)throw new Error(`Day${day} overview text not wholly visible in captured editor viewport`);
  const report=fs.existsSync(FILE)?JSON.parse(fs.readFileSync(FILE,'utf8')):{schemaVersion:1,inspectorConfirmed:true,inspectedBy:'launch_tracking',workflows:[],sections:[]};
  const item={day,fitInspected:true,fitCaptureSha256:fit.sha256,overviewPng:raw.overviewPng,overviewCaptureSha256:overview.sha256,overviewReadable:true,overviewView:raw.overviewView,reviewedAt:new Date().toISOString(),reviewMethod:'Actual full fit and overview captures inspected with view_image; required setup, package, cost, preview and support text visible'};
  report.workflows=report.workflows.filter(value=>Number(value.day)!==day).concat(item).sort((a,b)=>a.day-b.day);report.updatedAt=new Date().toISOString();fs.writeFileSync(FILE,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({day,reviewed:true,totalReviewed:report.workflows.length}));
}
if(require.main===module){for(const arg of process.argv.slice(2)){const day=Number(arg);if(!Number.isInteger(day)||day<31||day>60)throw new Error('Expected inspected day31..60');recordOverview(day);}}
module.exports={recordOverview};
