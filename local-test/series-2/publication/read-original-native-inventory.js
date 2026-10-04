'use strict';
// Run through Docker node stdin; never load credentials or change n8n state.
const sqlite = require('/usr/local/lib/node_modules/n8n/node_modules/sqlite3');
const db = new sqlite.Database('/home/node/.n8n/database.sqlite', sqlite.OPEN_READONLY);
db.all('SELECT id,name,active,nodes FROM workflow_entity ORDER BY name,id', [], (error, rows) => {
  if (error) { process.stderr.write(error.message); process.exitCode = 1; db.close(); return; }
  const workflows = rows.map(row => {
    const nodes = JSON.parse(row.nodes || '[]');
    return { id: row.id, name: row.name, active: !!row.active, nodeCount: nodes.length,
      nodeIds: nodes.map(node => node.id).sort(), nodeTypes: [...new Set(nodes.map(node => node.type))].sort() };
  });
  console.log(JSON.stringify({ capturedAt: new Date().toISOString(),
    method: 'Docker n8n SQLite OPEN_READONLY; workflow IDs/names and node identifiers/types only',
    container: 'n8n', workflowCount: workflows.length, workflows }, null, 2));
  db.close();
});
