'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { normalizeNodeGroups } = require('./zvid-native-workflows');

const STICKY = 'n8n-nodes-base.stickyNote';
const WATCH = '▶ Watch video';
const GATE = 'Video ready to watch?';
const WATCH_NOTE_ID = 'zvid-watch-instructions';
const entries = [...require('./workflow-series.json'), { day: 10, variant: true, file: 'zvid-shopify-abandoned-checkout-recovery.json' }];

function expressionBody(value) {
  assert.equal(typeof value, 'string', 'Watch step must have a URL');
  return value.startsWith('={{') ? value.slice(3, -2).trim() : JSON.stringify(value);
}

function titleOf(note) {
  return String(note.parameters.content || '').split('\n')[0].replace(/^#+\s*/, '').replace(/^\d+\s*[.—:-]\s*/, '').trim();
}

function noteBody(note) {
  return note.parameters.content.replace(/^#+[^\n]*\n*/, '').trim();
}

// Estimate the rendered Markdown height, allowing room for headings, lists and code.
function noteHeight(content, width = 800) {
  const characters = Math.floor((width - 80) / 8.2);
  const blocks = content.replace(/\r/g, '').split(/\n\s*\n/);
  let height = 80;
  for (const block of blocks) {
    const lines = block.split('\n');
    if (block.startsWith('```')) height += (lines.length + 1) * 25;
    else if (/^#+ /.test(block)) height += 44 + Math.max(0, Math.ceil(block.length / (characters * 0.7)) - 1) * 32;
    else if (/^\s*(?:[-*]|\d+\.)\s/m.test(block)) {
      const items = block.split(/\n(?=\s*(?:[-*]|\d+\.)\s)/);
      height += items.reduce((sum, item) => sum + Math.ceil(item.replace(/\n/g, ' ').length / (characters - 6)) * 25 + 10, 0);
    } else height += Math.ceil(block.replace(/\n/g, ' ').length / characters) * 25;
    height += 16;
  }
  return Math.max(280, Math.ceil(height / 40) * 40);
}

function noteCategory(note, overviewId) {
  const title = titleOf(note).toLowerCase();
  if (note.id === overviewId) return 0;
  if (/install|connect|setup|credential|token|needs the built-in/.test(title)) return 1;
  if (/sheet|input|feed|source|catalog|checkout|entry point|where.*(?:from|come)|webhook|product data/.test(title)) return 2;
  if (/dry run|preview|credit|render|validate|quote|charge|run mode/.test(title)) return 4;
  if (note.id === WATCH_NOTE_ID || /watch video|watch it/.test(title)) return 5;
  if (/publish|post|deliver|send|email|telegram|chat|youtube|instagram|follow-up/.test(title)) return 6;
  return 3;
}

function organizeWorkflow(original) {
  const workflow = structuredClone(original);
  if ('nodeGroups' in workflow) workflow.nodeGroups = normalizeNodeGroups(workflow.nodeGroups);
  const existingWatch = workflow.nodes.filter(n => n.type !== STICKY && /watch video/i.test(n.name));
  assert.ok(existingWatch.length <= 1, 'Multiple watch steps require a workflow-specific review');
  let watch = existingWatch[0];
  let addedWatch = false;
  if (!watch) {
    const summary = workflow.nodes.find(n => n.name === 'Run summary' && n.type === 'n8n-nodes-base.code');
    assert.ok(summary && /videoUrl\s*:/.test(summary.parameters.jsCode), 'Missing completed-video summary');
    watch = {
      id: 'zvid-watch-video', name: WATCH, type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2,
      position: [summary.position[0] + 260, summary.position[1]],
      parameters: { url: '={{ $json.videoUrl }}', options: { response: { response: { responseFormat: 'file', outputPropertyName: 'data' } } } },
      onError: 'continueRegularOutput', alwaysOutputData: true, retryOnFail: true, maxTries: 3, waitBetweenTries: 5000,
    };
    workflow.nodes.push(watch);
    workflow.connections[summary.name] ??= { main: [[]] };
    workflow.connections[summary.name].main[0].push({ node: watch.name, type: 'main', index: 0 });
    addedWatch = true;
  }
  // Keep the existing name and expressions, including an agent's URL allow-list.
  const gateId = 'zvid-watch-ready';
  let gate = workflow.nodes.find(n => n.id === gateId);
  if (!gate) {
    assert.ok(!workflow.nodes.some(n => n.name === GATE), 'Conflicting preview gate name');
    const incoming = [];
    for (const [source, types] of Object.entries(workflow.connections)) {
      for (const outputs of Object.values(types)) for (const output of outputs) for (const edge of output) {
        if (edge.node === watch.name) { edge.node = GATE; incoming.push(source); }
      }
    }
    assert.ok(incoming.length, 'Watch step must be connected');
    // Use a separate bottom branch when the preview also sits alongside delivery.
    const functional = workflow.nodes.filter(n => n.type !== STICKY && n.id !== watch.id);
    const source = workflow.nodes.find(n => n.name === incoming[0]);
    const hasSibling = incoming.some(name => Object.values(workflow.connections[name]).some(outputs => outputs.some(output => output.length > 1)));
    const gateX = hasSibling ? source.position[0] + 240 : Math.max(...functional.map(n => n.position[0])) + 260;
    const gateY = hasSibling ? Math.max(...functional.map(n => n.position[1])) + 300 : watch.position[1];
    gate = {
      id: gateId, name: GATE, type: 'n8n-nodes-base.if', typeVersion: 2.2, position: [gateX, gateY],
      parameters: { conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [{ id: 'zvid-watch-ready-condition', leftValue: `={{ !$json.dryRun && /^https?:\\/\\//i.test(String((${expressionBody(watch.parameters.url)}) || '')) }}`, rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } }],
        combinator: 'and',
      }, options: {} },
    };
    workflow.nodes.push(gate);
    workflow.connections[GATE] = { main: [[{ node: watch.name, type: 'main', index: 0 }], []] };
    watch.position = [gateX + 260, gateY];
  }

  const notes = workflow.nodes.filter(n => n.type === STICKY);
  // Preserve any unique instructions when consolidating the old setup cards.
  const generatedSetup = notes.find(n => n.id === 'zvid-native-setup');
  const setupBody = generatedSetup && noteBody(generatedSetup).replace(/\s+/g, ' ');
  const removedIds = new Set(notes.filter(n => n !== generatedSetup && setupBody && noteBody(n).replace(/\s+/g, ' ') === setupBody).map(n => n.id));
  const watchNotes = notes.filter(n => /^(?:[▶>]\s*)?watch (?:video|it)/i.test(titleOf(n)) && n.id !== WATCH_NOTE_ID);
  for (const note of watchNotes) removedIds.add(note.id);
  const watchExtra = watchNotes.map(noteBody).filter(text => text && /official Zvid|Zvid node setup/i.test(text));
  let watchNote = notes.find(n => n.id === WATCH_NOTE_ID);
  if (!watchNote) {
    watchNote = { id: WATCH_NOTE_ID, name: 'Watch the finished video', type: STICKY, typeVersion: 1, position: [0, 0], parameters: {
      content: `## Watch the finished video\n\nAfter a render finishes, open **${watch.name}**. In its output, choose **Binary → data → View** to play the video or download the file. For a batch, select an output item to watch each result. Image outputs open as images.\n\n**Video ready to watch?** skips previews when there is no finished media URL, including quote-only and dry-run results. The watch step downloads the finished file and does not start another render.\n\nIf the file is not available yet, the download retries up to three times. A preview download failure does not undo a completed render. The preceding result node still provides the media URL.${watchExtra.length ? '\n\n' + watchExtra.join('\n\n') : ''}`,
    } };
    workflow.nodes.push(watchNote);
  }
  workflow.nodes = workflow.nodes.filter(n => !removedIds.has(n.id));
  if (Array.isArray(workflow.nodeGroups)) for (const group of workflow.nodeGroups) {
    if (Array.isArray(group.nodeIds)) group.nodeIds = group.nodeIds.filter(id => !removedIds.has(id));
  }
  const instructionNotes = workflow.nodes.filter(n => n.type === STICKY);
  const overview = instructionNotes.find(n => /overview/i.test(n.name)) || instructionNotes.find(n => /### Setup|## Setup|## Telegram chat/.test(n.parameters.content)) || instructionNotes.find(n => !/watch|install|zvid node setup/i.test(titleOf(n)));
  const originalOrder = new Map(instructionNotes.map((note, index) => [note.id, index]));
  // Keep prerequisite sequences such as create app → get token → connect n8n.
  // Local imports assign random IDs, which must not determine reading order.
  instructionNotes.sort((a, b) => noteCategory(a, overview?.id) - noteCategory(b, overview?.id)
    || (a.id === 'zvid-native-setup' ? -1 : b.id === 'zvid-native-setup' ? 1 : originalOrder.get(a.id) - originalOrder.get(b.id)));
  const functional = workflow.nodes.filter(n => n.type !== STICKY);
  const left = Math.min(...functional.map(n => n.position[0])) - 80;
  const right = Math.max(...functional.map(n => n.position[0])) + 260;
  const columns = Math.max(3, Math.min(8, Math.floor((right - left + 80) / 880)));
  const rows = [];
  instructionNotes.forEach((note, index) => {
    const title = titleOf(note);
    note.parameters.content = note.parameters.content.replace(/^#+[^\n]*/, `## ${String(index + 1).padStart(2, '0')}. ${title}`);
    note.parameters.width = 800;
    note.parameters.height = noteHeight(note.parameters.content);
    const category = noteCategory(note, overview?.id);
    note.parameters.color = ({ 0: 6, 1: 6, 2: 2, 3: 7, 4: 3, 5: 4, 6: 5 })[category];
    const rowIndex = Math.floor(index / columns);
    (rows[rowIndex] ??= []).push(note);
  });
  const rowHeights = rows.map(row => Math.max(...row.map(n => n.parameters.height)));
  let y = Math.min(...functional.map(n => n.position[1])) - 240 - rowHeights.reduce((a, b) => a + b, 0) - (rows.length - 1) * 80;
  rows.forEach((row, rowIndex) => {
    row.forEach((note, column) => { note.position = [left + column * 880, y]; });
    y += rowHeights[rowIndex] + 80;
  });
  return { workflow, addedWatch, removedDuplicateNotes: removedIds.size - watchNotes.length, noteCount: instructionNotes.length };
}

function main() {
  const results = [];
  for (const entry of entries) {
    const file = path.join(__dirname, '../workflows', entry.file);
    const result = organizeWorkflow(JSON.parse(fs.readFileSync(file, 'utf8')));
    if (process.argv.includes('--write')) fs.writeFileSync(file, JSON.stringify(result.workflow, null, 2) + '\n');
    results.push({ ...entry, addedWatch: result.addedWatch, notes: result.noteCount, removedDuplicateNotes: result.removedDuplicateNotes });
  }
  console.log(JSON.stringify(results));
}
if (require.main === module) main();
module.exports = { organizeWorkflow, entries, expressionBody, noteHeight, STICKY, GATE, WATCH_NOTE_ID };
