'use strict';
const fs = require('node:fs');
const path = require('node:path');
const output = __dirname;
const start = { id: 'manual', name: 'Create QA scaffold manually', type: 'n8n-nodes-base.manualTrigger', typeVersion: 1, position: [0, 240], parameters: {} };
const note = content => ({ id: 'note', name: 'QA setup instructions', type: 'n8n-nodes-base.stickyNote', typeVersion: 1, position: [-50, -60], parameters: { content, height: 250, width: 850, color: 5 } });
const connect = names => Object.fromEntries(names.slice(0, -1).map((name, i) => [name, { main: [[{ node: names[i + 1], type: 'main', index: 0 }]] }]));
const base = (id, name, nodes) => ({ id, name, active: false, nodes, connections: connect(nodes.filter(n => n.type !== 'n8n-nodes-base.stickyNote').map(n => n.name)), settings: { executionOrder: 'v1', timezone: 'Africa/Cairo' } });
const sheetValues = Array.from({ length: 30 }, (_, i) => i + 31).flatMap(day => [{ title: `D${day}Source`, hidden: false }, { title: `D${day}Details`, hidden: false }]);
const workbook = base('ZvidSeries2PublicationCreateWorkbook', 'QA create publication workbook (Days 31–60)', [
  note('### Private publication QA workbook\n\nRun this fixture once. It creates one Google Sheets spreadsheet with 60 tabs, D31Source/D31Details through D60Source/D60Details. It does not send emails, publish videos, or modify production sheets.\n\nAfter a successful run, save the spreadsheet ID and use the separate seed fixture. A second run would create a second workbook. Do not rerun to recover a later failure; keep the accepted ID from the execution.'),
  start,
  { id: 'create-workbook', name: 'Create private QA workbook', type: 'n8n-nodes-base.googleSheets', typeVersion: 4.7, position: [270, 240], credentials: { googleSheetsOAuth2Api: { id: '4brcFt0P3EihgxJb', name: 'Google Sheets account' } }, parameters: { authentication: 'oAuth2', resource: 'spreadsheet', operation: 'create', title: 'Zvid n8n Days 31-60 publication QA 2026-10-01', sheetsUi: { sheetValues }, options: { locale: 'en_US', autoRecalc: 'ON_CHANGE' } } },
  { id: 'workbook-evidence', name: 'Workbook evidence', type: 'n8n-nodes-base.code', typeVersion: 2, position: [560, 240], parameters: { mode: 'runOnceForAllItems', jsCode: "const x=$input.first().json; if(!x.spreadsheetId||!Array.isArray(x.sheets)||x.sheets.length!==60)throw new Error('QA workbook creation did not return the expected 60 tabs.'); return [{json:{resource:'private_qa_workbook',spreadsheetId:x.spreadsheetId,spreadsheetUrl:x.spreadsheetUrl,title:x.properties?.title,sheets:x.sheets.map(s=>({title:s.properties.title,sheetId:s.properties.sheetId})),tabCount:x.sheets.length}}];" } }
]);
const folder = base('ZvidSeries2PublicationCreateFolder', 'QA create private publication video folder', [
  note('### Private video delivery QA folder\n\nRun this fixture once. It creates one folder in My Drive for the 30 publication workflow tests. No sharing node or notification is configured.\n\nSave the returned folder ID. Do not rerun after success; folder creation is not idempotent. The publication tests will upload videos only to this dedicated folder.'),
  start,
  { id: 'create-folder', name: 'Create private QA video folder', type: 'n8n-nodes-base.googleDrive', typeVersion: 3, position: [270, 240], credentials: { googleDriveOAuth2Api: { id: 'UH2cKTIIc4ymModq', name: 'Google Drive account' } }, parameters: { authentication: 'oAuth2', resource: 'folder', operation: 'create', name: 'Zvid n8n Days 31-60 publication QA - private', driveId: { __rl: true, mode: 'list', value: 'My Drive' }, folderId: { __rl: true, mode: 'list', value: 'root' }, options: { simplifyOutput: false } } },
  { id: 'folder-evidence', name: 'Folder evidence', type: 'n8n-nodes-base.code', typeVersion: 2, position: [560, 240], parameters: { mode: 'runOnceForAllItems', jsCode: "const x=$input.first().json; if(!x.id||x.mimeType!=='application/vnd.google-apps.folder')throw new Error('QA folder creation did not return a folder ID.'); return [{json:{resource:'private_qa_folder',folderId:x.id,name:x.name,folderUrl:x.webViewLink||('https://drive.google.com/drive/folders/'+x.id),shared:x.shared===true,mimeType:x.mimeType}}];" } }
]);
const workflows = [workbook, folder];
fs.writeFileSync(path.join(output, 'infra-scaffold-workflows.json'), JSON.stringify(workflows, null, 2) + '\n');
console.log(JSON.stringify(workflows.map(w => ({ id: w.id, name: w.name, nodeCount: w.nodes.length, localUrl: `http://localhost:5678/workflow/${w.id}` }))));
