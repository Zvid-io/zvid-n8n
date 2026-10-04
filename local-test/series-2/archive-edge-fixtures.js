'use strict';
const fs=require('node:fs');
const sqlite3=require('/usr/local/lib/node_modules/n8n/node_modules/sqlite3');
const ids=process.argv.slice(2);
if(!ids.length||ids.some(id=>!/^Series2Edge(?:CreditCap31|ZeroWork47|MissingProduct31|DryRun31|Recovery35|Webhook31|JobStates)$/.test(id)&&id!=='ZvidSeries2Preflight'))throw new Error('Only explicit isolated series-two fixture IDs may be archived.');
const db=new sqlite3.Database('/home/node/.n8n/database.sqlite');
db.configure('busyTimeout',5000);
const query=(sql,args=[])=>new Promise((resolve,reject)=>db.all(sql,args,(err,rows)=>err?reject(err):resolve(rows)));
const write=(sql,args=[])=>new Promise((resolve,reject)=>db.run(sql,args,function(err){err?reject(err):resolve(this.changes);}));
(async()=>{
  const fields=await query('PRAGMA table_info(workflow_entity)');
  if(!fields.some(field=>field.name==='isArchived'))throw new Error('Archive column is unavailable.');
  const records=await query('SELECT * FROM workflow_entity WHERE id IN ('+ids.map(()=>'?').join(',')+')',ids);
  if(records.length!==ids.length||records.some(row=>row.active||!(row.name.startsWith('TEST ONLY · ')||row.id==='ZvidSeries2Preflight'&&row.name==='Series 2 credit preflight')))throw new Error('Fixture identity or inactive state verification failed.');
  for(const row of records){
    const nodes=JSON.parse(row.nodes);
    if(nodes.some(node=>node.type==='@zvid/n8n-nodes-zvid.zvid'&&node.parameters.resource==='render'&&['create','createBulk'].includes(node.parameters.operation)))throw new Error('A paid render node is present in a fixture selected for cleanup.');
    if(row.id==='ZvidSeries2Preflight'&&(nodes.length!==2||!nodes.some(node=>node.type==='@zvid/n8n-nodes-zvid.zvid'&&node.parameters.resource==='credit'&&node.parameters.operation==='getBalance')))throw new Error('Preflight must be the authorized credit-only read fixture.');
  }
  fs.writeFileSync('/tmp/series-two-edge-archive-backup-'+Date.now()+'.json',JSON.stringify(records,null,2)+'\n');
  await write('BEGIN IMMEDIATE');
  for(const id of ids)await write('UPDATE workflow_entity SET isArchived=1 WHERE id=? AND active=0',[id]);
  await write('COMMIT');
  const states=await query('SELECT id,name,active,isArchived FROM workflow_entity WHERE id IN ('+ids.map(()=>'?').join(',')+')',ids);
  console.log(JSON.stringify({archived:states,executionHistoryPreserved:true}));
})().catch(async error=>{try{await write('ROLLBACK');}catch{}console.error(error.message);process.exitCode=1;}).finally(()=>db.close());
