'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ZVID_TYPE, zvidRoute, migrateWorkflow } = require('../scripts/zvid-native-workflows');
const entries = require('../scripts/workflow-series.json');
const { Zvid } = require('../dist/nodes/Zvid/Zvid.node');
const description = new Zvid().description;

test('Day 2: every daily background fits the verified 1920-pixel input limit', () => {
  const workflow = JSON.parse(fs.readFileSync(path.join(__dirname, '../workflows/zvid-daily-quote-reels.json'), 'utf8'));
  const code = workflow.nodes.find(node => node.name === 'Build project JSON').parameters.jsCode;
  const build = new Function(code.split('// === n8n glue ===')[0] + '\nreturn buildProject;')();
  // Actual ffprobe results from all six remote assets, not the visual display size.
  const manifest = require('./fixtures/daily-quote-media.json');
  const media = new Map(manifest.assets.map(asset => [asset.src, asset]));
  const used = new Set();
  for (let poolIndexOverride = 0; poolIndexOverride < 5; poolIndexOverride++) {
    const { payload } = build({ poolIndexOverride }, {
      quote: 'A small step each day makes a difference.', author: 'Example', date: '2026-09-15',
    });
    assert.equal(payload.resolution, 'instagram-reel');
    for (const scene of payload.scenes) {
      for (const visual of scene.visuals.filter(item => item.src)) {
        const asset = media.get(visual.src);
        assert.ok(asset, 'New media must be probed before adding it to the daily rotation');
        assert.equal(asset.type, visual.type);
        assert.ok(asset.width > 0 && asset.width <= 1920);
        assert.ok(asset.height > 0 && asset.height <= 1920);
        assert.equal(visual.width, 1080);
        assert.equal(visual.height, 1920);
        if (visual.type === 'VIDEO') assert.ok(asset.duration >= scene.duration);
        used.add(visual.src);
      }
    }
  }
  assert.equal(used.size, 6, 'Cover every daily video and the shared end-card image');
});

test('Database imports preserve node groups as arrays for the n8n editor', () => {
  const groups = [{ id: 'group-1', name: 'Render', nodeIds: ['render'], position: [100, 200] }];
  for (const originalGroups of [[], groups]) {
    let encoded = originalGroups;
    for (let depth = 0; depth <= 3; depth++) {
      const original = { nodes: [], connections: {}, nodeGroups: encoded };
      const migrated = migrateWorkflow(original).workflow;
      const roundTrip = JSON.parse(JSON.stringify(migrated));
      assert.deepEqual(roundTrip.nodeGroups.map(group => group.id), originalGroups.map(group => group.id));
      assert.deepEqual(roundTrip.nodeGroups, originalGroups);
      assert.deepEqual(original.nodeGroups, encoded, 'Do not mutate the original record');
      encoded = JSON.stringify(encoded);
    }
  }
});

test('Database imports reject invalid node groups without discarding them', () => {
  for (const value of [{}, '{}', 'invalid JSON', 42]) {
    assert.throws(() => migrateWorkflow({ nodes: [], connections: {}, nodeGroups: value }));
  }
  assert.equal(migrateWorkflow({ nodes: [], nodeGroups: null }).workflow.nodeGroups, null);
  assert.ok(!('nodeGroups' in migrateWorkflow({ nodes: [] }).workflow));
});

for (const entry of entries) {
  const w = JSON.parse(fs.readFileSync(path.join(__dirname, '../workflows', entry.file), 'utf8'));
  test(`Day ${entry.day}${entry.variant ? ' catalog variant' : ''}: supported Zvid routes use native nodes`, () => {
    const ids = w.nodes.map(n => n.id), names = w.nodes.map(n => n.name);
    assert.equal(new Set(ids).size, ids.length);
    assert.equal(new Set(names).size, names.length);
    for (const [name, types] of Object.entries(w.connections)) {
      assert.ok(names.includes(name), `Missing source ${name}`);
      for (const outputs of Object.values(types)) for (const output of outputs) for (const link of output) assert.ok(names.includes(link.node), `Missing target ${link.node}`);
    }
    for (const n of w.nodes) {
      assert.equal(n.credentials, undefined, `Published credentials in ${n.name}`);
      if (n.type.includes('n8n-nodes-zvid')) assert.ok([ZVID_TYPE, '@zvid/n8n-nodes-zvid.zvidTrigger'].includes(n.type));
      const route = zvidRoute(n);
      if (route) {
        assert.equal(route, '/api/uploads', `Supported route still uses HTTP: ${n.name}`);
        assert.match(n.notes, /published Zvid node does not expose multipart uploads/);
        assert.equal(n.parameters.nodeCredentialType, 'zvidApi');
        assert.equal(n.parameters.genericAuthType, undefined);
      }
      if (n.type === ZVID_TYPE) {
        const operation = description.properties.find(p => p.name === 'operation' && p.displayOptions?.show?.resource?.includes(n.parameters.resource));
        assert.ok(operation?.options.some(o => o.value === n.parameters.operation), `Invalid operation in ${n.name}`);
        for (const key of Object.keys(n.parameters)) assert.ok(description.properties.some(p => p.name === key), `Unknown parameter ${key}`);
      }
      if (n.type === 'n8n-nodes-base.code') assert.doesNotThrow(() => new Function(n.parameters.jsCode));
    }
    const notes = w.nodes.filter(n => n.type === 'n8n-nodes-base.stickyNote').map(n => n.parameters.content).join('\n');
    const docs = fs.readFileSync(path.join(__dirname, '../workflows', entry.file.replace(/^zvid-/, '').replace(/\.json$/, '.md')), 'utf8');
    if (entry.day !== 30) {
      assert.ok(w.nodes.some(n => n.type === ZVID_TYPE));
      for (const content of [notes, docs]) {
        assert.match(content, /@zvid\/n8n-nodes-zvid/);
        assert.match(content, /Settings → Community nodes/);
        assert.match(content, /owner\/admin/);
      }
    } else {
      assert.ok(w.nodes.some(n => n.type === '@n8n/n8n-nodes-langchain.mcpClientTool'));
      assert.match(notes, /AI-agent exception/);
      assert.match(docs, /AI-agent exception/);
    }
    assert.deepEqual(migrateWorkflow(w).workflow, w, 'Migration should be repeatable');
  });

  const guard = w.nodes.find(n => n.type === 'n8n-nodes-base.code' && n.name === 'Check validation');
  if (!guard) continue;
  test(`Day ${entry.day}${entry.variant ? ' catalog variant' : ''}: validation preserves quotes and blocks failures`, () => {
    const builds = [0, 1].map(i => ({ json: {
      payload: { name: 'Test ' + i }, items: [{ variables: { name: 'Ada' } }, { variables: { name: 'Sam' } }],
      meta: { products: [{ product: 'Coffee' }], leads: [{ company: 'Acme' }], clipIndex: i, hook: 'Hook', index: i, clipCount: 2, label: 'Video', kindLabel: 'Event', eventName: 'Meetup', contactName: 'Ada' }, kind: 'video',
    }}));
    const run = (jsons) => new Function('$input', '$', guard.parameters.jsCode)(
      { first: () => ({ json: jsons[0] }), all: () => jsons.map(json => ({ json })) },
      () => ({ first: () => builds[0], all: () => builds, item: builds[0] }),
    );
    const success = { valid: true, creditsRequired: 12, warnings: ['Review music'], schemaVersion: '1.0.0', payload: { name: 'Resolved' } };
    const result = run([success, { ...success, creditsRequired: 18 }]);
    const json = Array.isArray(result) ? result[0].json : result.json;
    assert.equal(json.creditsRequired ?? json.creditsPerVideo, 12);
    if ('totalCredits' in json) assert.equal(json.totalCredits, 24);
    if (Array.isArray(result) && result.length === 2) {
      assert.equal(result[1].json.creditsRequired, 18);
      assert.deepEqual(result[1].pairedItem, { item: 1 });
    }
    for (const error of [{ valid: false, message: 'Invalid payload', errors: [{ field: 'width', message: 'Must be positive' }] }, { valid: false, error: 'Unauthorized' }]) assert.throws(() => run([error, error]));
  });
}
