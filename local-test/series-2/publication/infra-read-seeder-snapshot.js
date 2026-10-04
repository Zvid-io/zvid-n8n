'use strict';
const sqlite=require('/usr/local/lib/node_modules/n8n/node_modules/sqlite3');
const {parse}=require('/usr/local/lib/node_modules/n8n/node_modules/flatted');
const db=new sqlite.Database('/home/node/.n8n/database.sqlite',sqlite.OPEN_READONLY);
db.get('SELECT e.id,e.workflowId,d.data FROM execution_entity e JOIN execution_data d ON e.id=d.executionId WHERE e.id=? AND e.workflowId=?',[738,'ZvidSeries2PublicationSeedSources'],(error,row)=>{
  if(error)throw error;if(!row)throw new Error('The original QA seed execution is missing.');
  const raw=parse(row.data||'[]')||{},result=raw.resultData||{},snapshot=result.runData?.['Prepare QA seed snapshot']?.[0]?.data?.main?.[0]?.[0]?.json;
  if(!snapshot?.tabs||!snapshot.seededAt)throw new Error('The original QA seed snapshot is missing.');
  for(const tab of Object.values(snapshot.tabs))for(const entry of tab.rows||[]){const id=entry.source_id||entry.parent_id;if(id&&!/^qa-d\d+-record-\d+$/.test(id))throw new Error('Refusing to export a nonsynthetic source snapshot.');}
  console.log(JSON.stringify({sourceExecutionId:row.id,sourceWorkflowId:row.workflowId,...snapshot},null,2));db.close();
});
