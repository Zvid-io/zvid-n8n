'use strict';
// Run inside Docker and redirect stdout straight to a local evidence file.
// No credentials or workflow configuration are selected or emitted.
const sqlite3=require('/usr/local/lib/node_modules/n8n/node_modules/sqlite3');
const flatted=require('/usr/local/lib/node_modules/n8n/node_modules/flatted');
const columns=['request_key','workflow_slug','source_id','revision','request_period','input_hash','input_json','project_json','brief_json','context_json','delivery_filename','status','job_id','video_url','drive_file_id','drive_url','quoted_credits','execution_id','last_error','updated_at'];
const db=new sqlite3.Database('/home/node/.n8n/database.sqlite',sqlite3.OPEN_READONLY);
db.all('SELECT e.id,e.workflowId,e.mode,e.status,ed.data FROM execution_entity e JOIN execution_data ed ON ed.executionId=e.id WHERE e.workflowId IN (?,?,?) AND e.mode=? AND e.status=? ORDER BY e.id DESC LIMIT 80',['ZvidSeries2Day31','ZvidSeries2Day35','ZvidSeries2Day47','manual','success'],(error,rows)=>{
  if(error){process.stderr.write(error.message+'\n');process.exitCode=1;db.close();return;}
  const seeds={},provenance=[];
  for(const row of rows){
    const day=Number(row.workflowId.replace('ZvidSeries2Day',''));if(seeds[day])continue;
    const parsed=flatted.parse(row.data),runs=parsed.resultData?.runData?.['Persist delivered outcome'];
    if(!runs?.length)continue;
    const source=runs.at(-1).data?.main?.[0]?.[0]?.json;
    if(source?.status!=='delivered'||!source.job_id||!source.input_json||!source.project_json||!source.context_json)continue;
    seeds[day]=Object.fromEntries(columns.map(key=>[key,source[key]??(key==='quoted_credits'?0:'')]));
    provenance.push({day,executionId:row.id,mode:row.mode,status:row.status,node:'Persist delivered outcome'});
  }
  process.stdout.write(JSON.stringify({capturedAt:new Date().toISOString(),seeds,provenance},null,2)+'\n');db.close();
});
