'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { organizeWorkflow, entries, expressionBody, STICKY, GATE, WATCH_NOTE_ID } = require('../scripts/organize-workflow-series');

function overlaps(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
const rect = node => ({ x: node.position[0], y: node.position[1], width: node.parameters.width || 200, height: node.parameters.height || 160 });

for (const entry of entries) {
  test(`Day ${entry.day} ${entry.file}: watch output and instruction layout`, () => {
    const original = JSON.parse(fs.readFileSync(path.join(__dirname, '../workflows', entry.file), 'utf8'));
    const result = organizeWorkflow(original).workflow;
    assert.deepEqual(original, result, 'Published templates must include the watch step and organized instructions');
    assert.deepEqual(organizeWorkflow(result).workflow, result, 'Repeat updates must not move notes or duplicate nodes');
    const watch = result.nodes.filter(n => n.type !== STICKY && /watch video/i.test(n.name));
    assert.equal(watch.length, 1);
    assert.equal(watch[0].parameters.options.response.response.responseFormat, 'file');
    assert.equal(watch[0].parameters.options.response.response.outputPropertyName, 'data');
    assert.equal(watch[0].onError, 'continueRegularOutput');
    assert.equal(watch[0].maxTries, 3);
    const gate = result.nodes.find(n => n.name === GATE);
    assert.ok(gate);
    assert.deepEqual(result.connections[GATE].main, [[{ node: watch[0].name, type: 'main', index: 0 }], []]);
    // Evaluate the actual n8n expressions for single videos, batches and agent replies.
    const ready = new Function('$json', '$', 'return (' + expressionBody(gate.parameters.conditions.conditions[0].leftValue) + ');');
    for (const videoUrl of ['', null, undefined, 'not a URL']) {
      const item = { videoUrl, VideoUrl: videoUrl };
      assert.equal(ready(item, () => ({ first: () => ({ json: item }) })), false);
    }
    for (const videoUrl of ['https://cdn.zvid.io/videos/example/one.mp4', 'https://cdn.zvid.io/videos/example/two.mp4']) {
      const item = { videoUrl, VideoUrl: videoUrl };
      assert.equal(ready(item, () => ({ first: () => ({ json: item }) })), true);
      assert.equal(ready({ ...item, dryRun: true }, () => ({ first: () => ({ json: item }) })), false);
    }
    for (const node of original.nodes.filter(n => n.type !== STICKY && !/watch video/i.test(n.name))) {
      assert.deepEqual(result.nodes.find(n => n.id === node.id), node, 'Other functional nodes must be preserved');
    }
    const names = new Set(result.nodes.map(n => n.name));
    const ids = new Set(result.nodes.map(n => n.id));
    assert.equal(names.size, result.nodes.length);
    assert.equal(ids.size, result.nodes.length);
    for (const [source, types] of Object.entries(result.connections)) {
      assert.ok(names.has(source));
      for (const outputs of Object.values(types)) for (const output of outputs) for (const edge of output) assert.ok(names.has(edge.node));
    }
    const notes = result.nodes.filter(n => n.type === STICKY);
    assert.ok(notes.some(n => n.id === WATCH_NOTE_ID));
    const numbers = notes.map(n => Number(n.parameters.content.match(/^## (\d+)\./)?.[1])).sort((a, b) => a - b);
    assert.deepEqual(numbers, Array.from({ length: notes.length }, (_, i) => i + 1));
    for (const note of notes) for (const other of result.nodes) {
      if (note.id !== other.id) assert.equal(overlaps(rect(note), rect(other)), false, 'Instruction cards must not overlap: ' + note.name + ' / ' + other.name);
    }
  });
}
