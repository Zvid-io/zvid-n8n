'use strict';
// Inactive, private-QA-only seeder. It uses native Google Sheets nodes.
const fs = require('node:fs');
const path = require('node:path');
const { adapters, fixtureFor } = require('../../../scripts/series-two-source-adapters');
const definitions = Object.values(adapters).sort((a,b)=>a.day-b.day);
const requested = process.argv.find(arg=>arg.startsWith('--days='));
const days = requested ? requested.slice(7).split(',').map(Number) : definitions.map(a=>a.day);
if (days.some(day=>!definitions.some(a=>a.day===day))) throw new Error('Unknown QA seed day.');
const requestedTabsArgument=process.argv.find(arg=>arg.startsWith('--tabs='));
const requestedTabs=requestedTabsArgument?requestedTabsArgument.slice(7).split(','):null;
const recovery=requestedTabs!==null;
const paceArgument=process.argv.find(arg=>arg.startsWith('--pace-seconds='));
const paceSeconds=paceArgument?Number(paceArgument.slice(15)):(recovery?6:2);
if(!Number.isFinite(paceSeconds)||paceSeconds<2||paceSeconds>60)throw new Error('QA write pacing must be 2–60 seconds.');
const workbookArgument = process.argv.find(arg=>arg.startsWith('--spreadsheet='));
let spreadsheetId = workbookArgument ? workbookArgument.slice(14) : '';
const evidencePath = path.join(__dirname,'infra-scaffold-evidence.json');
if (!spreadsheetId && fs.existsSync(evidencePath)) {
  const evidence=JSON.parse(fs.readFileSync(evidencePath,'utf8'));
  spreadsheetId=evidence.results.find(result=>result.workflowId==='ZvidSeries2PublicationCreateWorkbook'&&result.status==='success')?.evidence?.spreadsheetId||'';
}
const anchorISO='2026-10-01T12:00:00.000Z';
const snapshotArgument=process.argv.find(value=>value.startsWith('--snapshot='));
const savedSnapshot=snapshotArgument?JSON.parse(fs.readFileSync(path.resolve(snapshotArgument.slice(11)),'utf8')):null;
const tabs={};
for (const definition of definitions.filter(a=>days.includes(a.day))) {
  const fixture=fixtureFor(definition.day,anchorISO);
  const clean=(row,headers)=>Object.fromEntries(headers.map(name=>[name,row[name]??'']));
  tabs[definition.sourceTab]={day:definition.day,kind:'source',headers:definition.primaryHeaders,rows:[clean(fixture.primary,definition.primaryHeaders)]};
  tabs[definition.detailsTab]={day:definition.day,kind:'details',headers:definition.detailHeaders,rows:fixture.details.map(row=>clean(row,definition.detailHeaders))};
}
if(savedSnapshot){for(const name of Object.keys(tabs)){if(!savedSnapshot.tabs?.[name])throw new Error('The baseline snapshot does not contain '+name);tabs[name]=savedSnapshot.tabs[name];}}
if(requestedTabs){
  if(new Set(requestedTabs).size!==requestedTabs.length||requestedTabs.some(name=>!Object.hasOwn(tabs,name)))throw new Error('Unknown or duplicate QA seed tab.');
  for(const name of Object.keys(tabs))if(!requestedTabs.includes(name))delete tabs[name];
}
const nodes=[],connections={};
function add(name,type,parameters,extra={}){const n={id:`infra-seed-${nodes.length+1}`,name,type:`n8n-nodes-base.${type}`,typeVersion:{manualTrigger:1,set:3.4,code:2,googleSheets:4.7,stickyNote:1,wait:1.1}[type],position:[nodes.length*230,250],parameters,...extra};nodes.push(n);return n;}
function code(name,jsCode){return add(name,'code',{mode:'runOnceForAllItems',jsCode});}
const credentials={googleSheetsOAuth2Api:{id:'4brcFt0P3EihgxJb',name:'Google Sheets account'}};
const locator={__rl:true,mode:'id',value:'={{ $("QA seed configuration").first().json.spreadsheetId }}'};
add('Seed private QA workbook manually','manualTrigger',{});
add('QA seed configuration','set',{mode:'raw',jsonOutput:JSON.stringify({spreadsheetId,expectedWorkbookTitle:'Zvid n8n Days 31-60 publication QA 2026-10-01'},null,2),includeOtherFields:false,options:{}});
code('Check QA destination',"const cfg=$input.first().json;if(typeof cfg.spreadsheetId!=='string'||!cfg.spreadsheetId.trim())throw new Error('Create the dedicated private QA workbook and set spreadsheetId before running the seeder.');return [{json:cfg}];");
if(recovery)add('Wait for Google quota window','wait',{resume:'timeInterval',amount:60,unit:'seconds'});
code('Prepare QA seed snapshot',savedSnapshot?`return [{json:{seededAt:${JSON.stringify(savedSnapshot.seededAt)},tabs:${JSON.stringify(tabs)},baselineSnapshotReused:true}}];`:`const tabs=${JSON.stringify(tabs)};const anchor=Date.parse(${JSON.stringify(anchorISO)}),now=new Date(),shift=now.getTime()-anchor;const day=86400000;function adjust(value){if(typeof value!=='string')return value;if(/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,3})?Z$/.test(value))return new Date(Date.parse(value)+shift).toISOString();if(/^\\d{4}-\\d{2}-\\d{2}$/.test(value))return new Date(Date.parse(value+'T00:00:00Z')+Math.floor(shift/day)*day).toISOString().slice(0,10);return value;}for(const tab of Object.values(tabs))for(const row of tab.rows)for(const key of Object.keys(row))row[key]=adjust(row[key]);return [{json:{seededAt:now.toISOString(),tabs}}];`);
for(const tabName of Object.keys(tabs)) {
  add(`Read ${tabName} before seeding`,'googleSheets',{authentication:'oAuth2',resource:'sheet',operation:'read',documentId:locator,sheetName:{__rl:true,mode:'name',value:tabName},options:{returnFirstMatch:false,outputFormatting:{values:{general:'UNFORMATTED_VALUE',date:'FORMATTED_STRING'}}}},{credentials,executeOnce:true,alwaysOutputData:true,retryOnFail:true,maxTries:3,waitBetweenTries:recovery?30000:1000});
  code(`Require empty ${tabName}`,`const occupied=$input.all().map(i=>i.json).filter(row=>Object.entries(row).some(([key,value])=>key!=='row_number'&&String(value??'').trim()));if(occupied.length)throw new Error(${JSON.stringify(tabName+' already contains data. The QA seeder will not overwrite delivery evidence. Regenerate with --days for only unseeded day pairs.')});return [{json:{tabName:${JSON.stringify(tabName)}}}];`);
  code(`Seed rows for ${tabName}`,`const tab=$("Prepare QA seed snapshot").first().json.tabs[${JSON.stringify(tabName)}];const rows=tab.rows.length?tab.rows:[Object.fromEntries(tab.headers.map(name=>[name,'']))];return rows.map(json=>({json}));`);
  add(`Append ${tabName} QA rows`,'googleSheets',{authentication:'oAuth2',resource:'sheet',operation:'append',documentId:locator,sheetName:{__rl:true,mode:'name',value:tabName},columns:{mappingMode:'autoMapInputData',value:{},schema:[]},options:{cellFormat:'RAW',handlingExtraData:'insertInNewColumn',useAppend:true}},{credentials});
  add(`Pace writes after ${tabName}`,'wait',{resume:'timeInterval',amount:paceSeconds,unit:'seconds'});
  code(`Continue after ${tabName}`,`return [{json:{seededTab:${JSON.stringify(tabName)}}}];`);
}
code('QA seed evidence',`const snapshot=$("Prepare QA seed snapshot").first().json;return [{json:{resource:'private_qa_workbook_seed',spreadsheetId:$("QA seed configuration").first().json.spreadsheetId,seededAt:snapshot.seededAt,baselineSnapshotReused:snapshot.baselineSnapshotReused===true,seededTabs:Object.entries(snapshot.tabs).map(([title,tab])=>({title,day:tab.day,kind:tab.kind,columnCount:tab.headers.length,records:tab.rows.length})),sourceDayCount:${new Set(Object.values(tabs).map(tab=>tab.day)).size},paidNodesExecuted:[],productionSourcesModified:false}}];`);
for(let i=0;i<nodes.length-1;i++)connections[nodes[i].name]={main:[[{node:nodes[i+1].name,type:'main',index:0}]]};
nodes.push({id:'infra-seeder-note',name:'QA seeder instructions',type:'n8n-nodes-base.stickyNote',typeVersion:1,position:[0,-120],parameters:{color:5,width:1050,height:310,content:'### Private QA source setup\n\nConfigure the dedicated QA spreadsheet ID created by the scaffold fixture. This seeder checks each tab is empty, then uses native Google Sheets append to write all documented headers and synthetic business records. Dates are shifted together at the start of the run so upcoming/expired-source rules can be tested against the current time.\n\nDo not point this at a production workbook. Do not rerun after the source workflows have written delivery evidence. If seeding stops partway through, generate a narrowed fixture for the unseeded days rather than clearing or overwriting existing tabs. No paid render, email, public sharing, or social publication is configured.'}});
const fixture={id:recovery?'ZvidSeries2PublicationSeedRemaining':'ZvidSeries2PublicationSeedSources',name:recovery?'QA seed only remaining publication source tabs':'QA seed publication business sources privately',active:false,nodes,connections,settings:{executionOrder:'v1',timezone:'Africa/Cairo'}};
const prefix=recovery?'infra-seeder-remaining':'infra-seeder';
fs.writeFileSync(path.join(__dirname,prefix+'-fixture.json'),JSON.stringify([fixture],null,2)+'\n');
fs.writeFileSync(path.join(__dirname,prefix+'-manifest.json'),JSON.stringify({generatedAt:new Date().toISOString(),spreadsheetConfigured:Boolean(spreadsheetId),days:[...new Set(Object.values(tabs).map(tab=>tab.day))],tabCount:Object.keys(tabs).length,paceSeconds,recovery,tabs:Object.entries(tabs).map(([title,tab])=>({title,columnCount:tab.headers.length,records:tab.rows.length})),fixtureId:fixture.id,localUrl:`http://localhost:5678/workflow/${fixture.id}`},null,2)+'\n');
console.log(JSON.stringify({fixtureId:fixture.id,localUrl:`http://localhost:5678/workflow/${fixture.id}`,tabCount:Object.keys(tabs).length,functionalNodes:nodes.length-1,spreadsheetConfigured:Boolean(spreadsheetId)}));
