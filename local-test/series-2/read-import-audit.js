'use strict';
const fs=require('node:fs');const crypto=require('node:crypto');const{isDeepStrictEqual}=require('node:util');
const sqlite3=require('/usr/local/lib/node_modules/n8n/node_modules/sqlite3');
const expected=JSON.parse(fs.readFileSync('/tmp/series-two-import-audit-expected.json','utf8').replace(/^\uFEFF/,''));
const db=new sqlite3.Database('/home/node/.n8n/database.sqlite',sqlite3.OPEN_READONLY);
const parse=value=>typeof value==='string'?JSON.parse(value):value;
const sorted=value=>Array.isArray(value)?value.map(sorted):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,sorted(value[key])])):value;
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(sorted(value))).digest('hex');
const scan=(value,key='',problems=[])=>{
if(value&&typeof value==='object')for(const[k,v]of Object.entries(value))scan(v,k,problems);
else if(typeof value==='string'&&(/^(?:apiKey|accessToken|secret|password|authorization|privateKey)$/i.test(key)||/\bzvid_[A-Za-z0-9]{24,}\b|\bBearer\s+[A-Za-z0-9._-]{20,}/i.test(value)))problems.push(key||'string');
return problems;
};
db.all('SELECT id,name,nodes,connections,settings,active,isArchived FROM workflow_entity WHERE id IN ('+expected.map(()=>'?').join(',')+')',expected.map(w=>w.id),(error,rows)=>{
if(error){console.error(error.message);process.exitCode=1;db.close();return;}
const audits=expected.map(w=>{
const row=rows.find(r=>r.id===w.id);if(!row)return{id:w.id,matched:false,missing:true};
const actual={id:row.id,name:row.name,nodes:parse(row.nodes),connections:parse(row.connections),settings:parse(row.settings)||{},active:Boolean(row.active)};
const target={id:w.id,name:w.name,nodes:w.nodes,connections:w.connections,settings:w.settings,active:w.active};
const mismatchedFields=Object.keys(target).filter(key=>!isDeepStrictEqual(actual[key],target[key]));
const typesPublished=actual.nodes.every(n=>n.type.startsWith('n8n-nodes-base.')||n.type==='@zvid/n8n-nodes-zvid.zvid');
const invalidPrefixes=actual.nodes.filter(n=>n.type.startsWith('CUSTOM.')||n.type.startsWith('n8n-nodes-zvid')||n.type.includes('zvid')&&!n.type.startsWith('@zvid/n8n-nodes-zvid.')).map(n=>n.name);
const credentialReferencesValid=actual.nodes.every(n=>!n.credentials||n.type==='@zvid/n8n-nodes-zvid.zvid'&&Object.keys(n.credentials).length===1&&Object.keys(n.credentials.zvidApi||{}).sort().join(',')==='id,name'&&n.credentials.zvidApi.id==='e3b494f287402c80c13bf080'&&n.credentials.zvidApi.name==='Zvid workflow series');
const embeddedSecretFields=scan(actual);
return{id:w.id,name:w.name,matched:mismatchedFields.length===0&&!row.isArchived&&typesPublished&&invalidPrefixes.length===0&&credentialReferencesValid&&embeddedSecretFields.length===0,expectedSemanticHash:hash(target),actualSemanticHash:hash(actual),mismatchedFields,inactive:!row.active,isArchived:Boolean(row.isArchived),nodeCount:actual.nodes.length,typesPublished,invalidPrefixes,credentialReferencesValid,embeddedSecretFields,canonicalFile:w.canonicalFile,canonicalCredentialFree:w.canonicalCredentialFree,canonicalParametersMatched:w.canonicalParametersMatched};
});
console.log(JSON.stringify({auditedAtUtc:new Date().toISOString(),expectedCount:expected.length,actualCount:rows.length,matchedCount:audits.filter(w=>w.matched).length,inactiveCount:audits.filter(w=>w.inactive).length,unarchivedCount:audits.filter(w=>!w.isArchived&&!w.missing).length,publishedTypesCount:audits.filter(w=>w.typesPublished).length,credentialReferenceOnlyCount:audits.filter(w=>w.credentialReferencesValid).length,credentialFreeCanonicalCount:audits.filter(w=>w.canonicalCredentialFree).length,passed:audits.length===30&&audits.every(w=>w.matched),readOnly:true,records:audits}));
db.close();
});
