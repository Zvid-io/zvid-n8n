'use strict';
// Copy into Docker and run with Node. Read-only database access, sanitized outputs.
const sqlite = require('/usr/local/lib/node_modules/n8n/node_modules/sqlite3');
const flatted = require('/usr/local/lib/node_modules/n8n/node_modules/flatted');
const db = new sqlite.Database('/home/node/.n8n/database.sqlite', sqlite.OPEN_READONLY);
const args=process.argv.slice(2),allAttempts=args.includes('--all');
const named=args.filter(value=>value!=='--all');
const names = named.length ? named : ['ZvidSeries2PublicationCreateWorkbook', 'ZvidSeries2PublicationCreateFolder'];
db.all('SELECT e.id,e.workflowId,e.status,e.mode,e.startedAt,e.stoppedAt,d.data FROM execution_entity e LEFT JOIN execution_data d ON e.id=d.executionId WHERE e.workflowId IN (' + names.map(() => '?').join(',') + ') ORDER BY e.id DESC', names, (error, rows) => {
  if (error) throw error;
  const latest = allAttempts?rows:names.map(workflowId => rows.find(x => x.workflowId === workflowId)).filter(Boolean);
  const result = latest.map(row => {
    const raw = row.data ? flatted.parse(row.data) : {};
    const data = raw?.resultData || raw || {};
    const runData = data.runData || {};
    const lastNode = data.lastNodeExecuted;
    const output = runData[lastNode]?.at(-1)?.data?.main?.[0]?.[0]?.json;
    return { workflowId: row.workflowId, executionId: row.id, status: row.status, mode: row.mode, startedAt: row.startedAt, stoppedAt: row.stoppedAt, lastNode, nodes: Object.fromEntries(Object.entries(runData).map(([name, runs]) => [name, runs.at(-1)?.error ? 'error' : 'success'])), evidence: row.status === 'success' ? output : null, error: data.error ? { message: data.error.message } : null };
  });
  console.log(JSON.stringify({ capturedAt: new Date().toISOString(), expectedFixtures: names, results: result }, null, 2));
  db.close();
});
