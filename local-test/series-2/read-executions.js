'use strict';
const sqlite3 = require('/usr/local/lib/node_modules/n8n/node_modules/sqlite3');
const { parse } = require('/usr/local/lib/node_modules/n8n/node_modules/flatted');
const db = new sqlite3.Database('/home/node/.n8n/database.sqlite', sqlite3.OPEN_READONLY);
db.all("SELECT e.id,e.workflowId,e.status,e.mode,e.startedAt,e.stoppedAt,d.data FROM execution_entity e LEFT JOIN execution_data d ON d.executionId=e.id WHERE e.workflowId LIKE 'ZvidSeries2Day%' ORDER BY CAST(e.id AS INTEGER) DESC", (err, rows) => {
  if (err) { console.error(err.message); process.exitCode=1; db.close(); return; }
  const results = rows.map(row => {
    let value={};
    try { value=parse(row.data || '[]'); } catch { try { value=JSON.parse(row.data || '{}'); } catch {} }
    const result = value?.resultData || value?.data?.resultData || {};
    const runs = result.runData || {};
    const firstJson = name => runs[name]?.at(-1)?.data?.main?.[0]?.[0]?.json;
    const output = firstJson('Video result') || firstJson('Result') || firstJson('Dry-run result');
    const watch = runs['Watch video']?.at(-1);
    const binary = watch?.data?.main?.[0]?.[0]?.binary?.data;
    return { id: row.id, workflowId: row.workflowId, status: row.status, mode: row.mode, startedAt: row.startedAt, stoppedAt: row.stoppedAt, lastNode: result.lastNodeExecuted, error: result.error ? { message: result.error.message, node: result.error.node?.name } : null, nodes: Object.fromEntries(Object.entries(runs).map(([name,r])=>[name,r.at(-1)?.executionStatus])), output, preview: binary ? { mimeType: binary.mimeType, fileSize: binary.fileSize, fileName: binary.fileName, id: binary.id } : null };
  });
  console.log(JSON.stringify(results));
  db.close();
});
