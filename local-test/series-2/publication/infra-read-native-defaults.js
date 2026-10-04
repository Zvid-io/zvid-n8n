'use strict';
// Read-only descriptor inspection. This never reads credential data or executes nodes.
const base='/usr/local/lib/node_modules/n8n/node_modules/n8n-nodes-base/dist/nodes/';
const cases=[
  ['n8n-nodes-base.code',2,'Code/Code.node.js',['language','mode','notice']],
  ['n8n-nodes-base.manualTrigger',1,'ManualTrigger/ManualTrigger.node.js',['notice']],
  ['n8n-nodes-base.scheduleTrigger',1.3,'Schedule/ScheduleTrigger.node.js',['notice']],
  ['n8n-nodes-base.set',3.4,'Set/Set.node.js',['duplicateItem']],
  ['n8n-nodes-base.if',2.2,'If/If.node.js',['looseTypeValidation']],
  ['n8n-nodes-base.crypto',1,'Crypto/Crypto.node.js',['binaryData']],
  ['n8n-nodes-base.dataTable',1.1,'DataTable/DataTable.node.js',['orderBy']],
  ['n8n-nodes-base.googleSheets',4.7,'Google/Sheet/GoogleSheets.node.js',['combineFilters','filtersUI']],
  ['n8n-nodes-base.httpRequest',2,'HttpRequest/HttpRequest.node.js',['allowUnauthorizedCerts','authentication','headerParametersUi','infoMessage','jsonParameters','queryParametersUi','requestMethod']],
  ['@zvid/n8n-nodes-zvid.zvid',1,'/home/node/.n8n/nodes/node_modules/@zvid/n8n-nodes-zvid/dist/nodes/Zvid/Zvid.node.js',['validationVariables']],
];
const results=cases.map(([type,version,path,names])=>{
  const modulePath=path.startsWith('/')?path:base+path;
  const exports=require(modulePath);
  const Constructor=Object.values(exports).find(value=>typeof value==='function');
  const parent=new Constructor();
  const node=parent.nodeVersions?.[String(version)]||parent;
  const properties=node.description.properties;
  const defaults={};
  const descriptors=[];
  for(const name of names){
    const found=properties.filter(property=>property.name===name).filter(property=>{
      const rules=property.displayOptions?.show?.['@version'];
      if(!rules)return true;
      return rules.some(rule=>{
        if(typeof rule==='number')return rule===version;
        const tests=rule._cnd||{};
        return Object.entries(tests).every(([operation,value])=>({lt:version<value,lte:version<=value,gt:version>value,gte:version>=value,eq:version===value})[operation]===true);
      });
    });
    if(!found.length)throw new Error('Missing descriptor '+type+' '+name);
    const encoded=found.map(property=>JSON.stringify(property.default));
    if(new Set(encoded).size!==1)throw new Error('Ambiguous defaults '+type+' '+name);
    defaults[name]=found[0].default;
    descriptors.push(...found.map(({name,type,default:defaultValue,displayOptions})=>({name,type,default:defaultValue,displayOptions})));
  }
  if(type==='@zvid/n8n-nodes-zvid.zvid'){
    if(node.execute)throw new Error('Expected declarative Zvid node.');
    const loader='/usr/local/lib/node_modules/n8n/node_modules/n8n-core/dist/nodes-loader/constants.js';
    const generated=require(loader).commonDeclarativeNodeOptionParameters;
    if(generated.name!=='requestOptions'||JSON.stringify(generated.default)!=='{}')throw new Error('Unexpected generated request-options default.');
    defaults.requestOptions=generated.default;
    descriptors.push({name:generated.name,type:generated.type,default:generated.default,provenance:loader,addedBy:'/usr/local/lib/node_modules/n8n/node_modules/n8n-core/dist/nodes-loader/directory-loader.js:DirectoryLoader.applyDeclarativeNodeOptionParameters'});
  }
  return {type,version,modulePath,defaults,descriptors};
});
process.stdout.write(JSON.stringify({capturedAt:new Date().toISOString(),n8nVersion:'2.29.10',scope:'Only editor-added defaults observed in manual execution 742; explicit non-default values remain significant.',results},null,2));
