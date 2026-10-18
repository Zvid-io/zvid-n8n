import { mkdirSync, readFileSync } from 'node:fs';
import { ZvidClient } from '@zvid/sdk';
import { loadQueue } from './src/queue.js';
import { loadProjectBuilder } from './src/project.js';
import { loadEnv, writeJson } from './src/util.js';

loadEnv();
const { pending } = loadQueue(process.argv[2] || 'data/quotes.csv');

if (!pending) {
  console.log('No pending quotes.');
} else {
  const config = JSON.parse(readFileSync('config.json', 'utf8'));
  const buildProject = loadProjectBuilder('n8n/workflow.json');
  const { payload } = buildProject(config, {
    quote: pending.record.Quote,
    author: pending.record.Author,
    authorNote: pending.record.AuthorNote,
    date: new Date(),
  });

  mkdirSync('out', { recursive: true });
  writeJson('out/project.json', payload);

  const client = new ZvidClient({
    apiKey: process.env.ZVID_API_KEY,
    baseUrl: process.env.ZVID_API_URL || undefined,
  });
  const validation = await client.authoring.validate({ payload });
  if (!validation.valid) throw new Error('Project validation failed.');

  console.log(JSON.stringify({
    valid: validation.valid,
    creditsRequired: validation.creditsRequired,
    projectFile: 'out/project.json',
  }, null, 2));
}
