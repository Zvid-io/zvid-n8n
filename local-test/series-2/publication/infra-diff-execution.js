'use strict';
const sqlite=require('/usr/local/lib/node_modules/n8n/node_modules/sqlite3');
const {functionalSnapshot,functionalHash}=require('/tmp/zvid-publication-functional-fingerprint.js');
const id=Number(process.argv[2]||742);
if(!Number.isInteger(id)||id<=737)throw new Error('Expected a publication execution ID.');
const db=new sqlite.Database('/home/node/.n8n/database.sqlite',sqlite.OPEN_READONLY);
db.get('SELECT e.id,e.workflowId,e.mode,d.workflowData,w.nodes,w.connections,w.settings,w.pinData FROM execution_entity e JOIN execution_data d ON e.id=d.executionId JOIN workflow_entity w ON e.workflowId=w.id WHERE e.id=?',[id],(error,row)=>{
  if(error)throw error;if(!row||!/^ZvidSeries2Day(?:3[1-9]|[45][0-9]|60)$/.test(row.workflowId))throw new Error('Unexpected execution workflow.');
  const actual=JSON.parse(row.workflowData),installed={nodes:JSON.parse(row.nodes),connections:JSON.parse(row.connections),settings:JSON.parse(row.settings||'{}'),pinData:JSON.parse(row.pinData||'{}')};
  const diffs=[];
  function compare(left,right,path){if(JSON.stringify(left)===JSON.stringify(right))return;if(Array.isArray(left)&&Array.isArray(right)){if(left.length!==right.length)diffs.push({path:path+'.length',execution:left.length,installed:right.length});for(let i=0;i<Math.max(left.length,right.length);i++)compare(left[i],right[i],path+'['+i+']');return;}if(left&&right&&typeof left==='object'&&typeof right==='object'){for(const key of new Set([...Object.keys(left),...Object.keys(right)]))compare(left[key],right[key],path+'.'+key);return;}const compact=value=>typeof value==='string'&&value.length>500?{stringLength:value.length,sha256:require('node:crypto').createHash('sha256').update(value).digest('hex'),prefix:value.slice(0,150)}:value;diffs.push({path,execution:compact(left),installed:compact(right)});}
  const left=functionalSnapshot(actual),right=functionalSnapshot(installed);compare(left,right,'workflow');
  const nodeProof=diffs.filter(diff=>/nodes\[\d+\]\.disabled$/.test(diff.path)).map(diff=>{const index=Number(/nodes\[(\d+)\]/.exec(diff.path)[1]),node=left.nodes[index];return {...diff,nodeId:node.id,nodeType:node.type,nodeName:actual.nodes.find(n=>n.id===node.id)?.name};});
  console.log(JSON.stringify({executionId:row.id,workflowId:row.workflowId,mode:row.mode,executionHash:functionalHash(actual),installedHash:functionalHash(installed),differences:diffs,disabledNodeProof:nodeProof},null,2));db.close();
});
