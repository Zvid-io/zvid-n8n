'use strict';
const crypto=require('node:crypto');
function stable(value){if(Array.isArray(value))return value.map(stable);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));return value;}
function sha256(value){return crypto.createHash('sha256').update(typeof value==='string'?value:JSON.stringify(stable(value))).digest('hex');}
// Exact installed descriptor defaults observed in execution742. See
// infra-native-defaults-evidence.json. Missing values and those exact defaults
// are equivalent; explicit non-default values, code and operation remain strict.
const editorDefaults={
  'n8n-nodes-base.code@2':{language:'javaScript',mode:'runOnceForAllItems',notice:''},
  'n8n-nodes-base.manualTrigger@1':{notice:''},
  'n8n-nodes-base.scheduleTrigger@1.3':{notice:''},
  'n8n-nodes-base.set@3.4':{duplicateItem:false},
  'n8n-nodes-base.if@2.2':{looseTypeValidation:false},
  'n8n-nodes-base.crypto@1':{binaryData:false},
  'n8n-nodes-base.dataTable@1.1':{orderBy:false},
  'n8n-nodes-base.googleSheets@4.7':{combineFilters:'AND',filtersUI:{}},
  'n8n-nodes-base.httpRequest@2':{allowUnauthorizedCerts:false,authentication:'none',headerParametersUi:{},infoMessage:'',jsonParameters:false,queryParametersUi:{},requestMethod:'GET'},
  '@zvid/n8n-nodes-zvid.zvid@1':{requestOptions:{},validationVariables:'{}'},
};
function normalizeParameters(node){
  const parameters=structuredClone(node.parameters||{});
  for(const [name,value] of Object.entries(editorDefaults[node.type+'@'+node.typeVersion]||{})){
    if(!Object.hasOwn(parameters,name))parameters[name]=structuredClone(value);
  }
  return parameters;
}
function functionalSnapshot(workflow){
  const all=workflow.nodes||[],functional=all.filter(node=>node.type!=='n8n-nodes-base.stickyNote');
  const names=new Map(functional.map(node=>[node.name,node.id]));
  const fields=['id','type','typeVersion','disabled','alwaysOutputData','executeOnce','onError','retryOnFail','maxTries','waitBetweenTries','continueOnFail','parameters'];
  const nodes=functional.map(original=>{
    const node=Object.fromEntries(fields.filter(key=>original[key]!==undefined).map(key=>[key,structuredClone(original[key])]));
    node.parameters=normalizeParameters(original);
    if(original.name==='Config'&&node.parameters?.mode==='raw'&&typeof node.parameters.jsonOutput==='string'){
      const config=JSON.parse(node.parameters.jsonOutput);
      if(Object.hasOwn(config,'spreadsheetId'))config.spreadsheetId='';
      if(Object.hasOwn(config,'driveFolderId'))config.driveFolderId='';
      node.parameters.jsonOutput=stable(config);
    }
    return node;
  }).sort((a,b)=>String(a.id).localeCompare(String(b.id)));
  const connections=Object.fromEntries(Object.entries(workflow.connections||{}).filter(([name])=>names.has(name)).map(([name,kinds])=>[names.get(name),Object.fromEntries(Object.entries(kinds).map(([kind,branches])=>[kind,branches.map(branch=>branch.filter(link=>names.has(link.node)).map(link=>({...link,node:names.get(link.node)})))]))]));
  return stable({nodes,connections,settings:workflow.settings||{},pinData:workflow.pinData||{}});
}
function functionalHash(workflow){return sha256(functionalSnapshot(workflow));}
module.exports={stable,sha256,functionalSnapshot,functionalHash,normalizeParameters,editorDefaults};
