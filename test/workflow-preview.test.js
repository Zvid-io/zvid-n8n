'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { organizeWorkflow, entries, expressionBody, STICKY, GATE, WATCH_NOTE_ID } = require('../scripts/organize-workflow-series');
const { publicationKind, OVERVIEW_PREFIX } = require('../scripts/publication-sticky-notes');

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
    const response = watch[0].typeVersion === 2
      ? { responseFormat: watch[0].parameters.responseFormat, outputPropertyName: watch[0].parameters.dataPropertyName }
      : watch[0].parameters.options.response.response;
    assert.equal(response.responseFormat, 'file');
    assert.equal(response.outputPropertyName, 'data');
    assert.equal(watch[0].onError, 'continueRegularOutput');
    assert.equal(watch[0].maxTries, 3);
    const gate = result.nodes.find(n => n.id === 'zvid-watch-ready');
    assert.ok(gate);
    assert.deepEqual(result.connections[gate.name].main, [[{ node: watch[0].name, type: 'main', index: 0 }], []]);
    // Evaluate the actual n8n expressions for single videos, batches and agent replies.
    const ready = new Function('$json', '$', 'return (' + expressionBody(gate.parameters.conditions.conditions[0].leftValue) + ');');
    for (const videoUrl of ['', null, undefined, 'not a URL']) {
      const item = { videoUrl, VideoUrl: videoUrl, status: 'completed' };
      assert.equal(ready(item, () => ({ first: () => ({ json: item }) })), false);
    }
    for (const videoUrl of ['https://cdn.zvid.io/videos/example/one.mp4', 'https://cdn.zvid.io/videos/example/two.mp4']) {
      const item = { videoUrl, VideoUrl: videoUrl, status: 'completed' };
      assert.equal(ready(item, () => ({ first: () => ({ json: item }) })), true);
      assert.equal(ready({ ...item, dryRun: true }, () => ({ first: () => ({ json: item }) })), false);
      if (result.meta?.lateSeriesReview) assert.equal(ready({ ...item, status: 'failed' }), false);
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
    assert.ok(publicationKind(result), 'Every series template must use the publication note standard');
    {
      const overview = notes.find(n => n.id.startsWith(OVERVIEW_PREFIX));
      assert.equal(notes.filter(n => n.parameters.color === 1).length, 1, 'Exactly one yellow overview');
      const words = overview.parameters.content.split(/\s+/).length;
      assert.ok(words >= 100 && words <= 300, 'Overview must contain 100–300 words');
      assert.match(overview.parameters.content, /^### How it works$/m);
      assert.match(overview.parameters.content, /^### Setup$/m);
      const sections = notes.filter(n => n !== overview);
      const functional = result.nodes.filter(n => n.type !== STICKY);
      const enclosed = new Map(functional.map(n => [n.id, 0]));
      for (const section of sections) {
        assert.equal(section.parameters.color, 7, 'Section notes use neutral white/grey');
        assert.ok(section.parameters.content.split(/\s+/).length < 50);
        assert.match(section.parameters.content, /^## \d+\./);
        assert.ok(overview.position[0] < section.position[0] && overview.position[1] <= section.position[1], 'Overview sits at top left');
        const box = rect(section);
        const members = functional.filter(n => n.position[0] >= box.x + 30 && n.position[0] + 160 <= box.x + box.width - 20 && n.position[1] >= box.y + 150 && n.position[1] + 120 <= box.y + box.height - 20);
        assert.ok(members.length >= 2, 'Section must surround multiple nodes: ' + section.name);
        for (const node of members) enclosed.set(node.id, enclosed.get(node.id) + 1);
      }
      for (const count of enclosed.values()) assert.equal(count, 1, 'Every node belongs to exactly one section');
      for (const note of notes) for (const other of notes) if (note.id !== other.id) assert.equal(overlaps(rect(note), rect(other)), false, 'Section notes must not collide');
      for (const node of functional) for (const other of functional) if (node.id !== other.id) assert.equal(overlaps(rect(node), rect(other)), false, 'Functional nodes must not collide');
      return;
    }
  });
}
