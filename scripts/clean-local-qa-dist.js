'use strict';

// The n8n node CLI copies every PNG/SVG into dist, including private local QA
// screenshots. Remove only that generated copy; keep source QA and shipped assets.
const fs = require('node:fs');
const path = require('node:path');

const packageRoot = path.resolve(__dirname, '..');
const distRoot = path.join(packageRoot, 'dist');
const target = path.join(distRoot, 'local-test');
const comparable = value => process.platform === 'win32' ? value.toLowerCase() : value;

if (JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8')).name !== '@zvid/n8n-nodes-zvid') {
  throw new Error('QA cleanup must run in the Zvid n8n package.');
}
if (comparable(fs.realpathSync(packageRoot)) !== comparable(packageRoot)) {
  throw new Error('QA cleanup refuses a linked package directory.');
}
if (path.relative(packageRoot, target) !== path.join('dist', 'local-test')) {
  throw new Error('Unexpected QA cleanup target.');
}

function checkOrdinaryTree(directory) {
  const stat = fs.lstatSync(directory);
  if (stat.isSymbolicLink() || !stat.isDirectory() || comparable(fs.realpathSync(directory)) !== comparable(directory)) {
    throw new Error('QA cleanup refuses linked or non-directory targets.');
  }
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const child = path.join(directory, entry.name);
    if (fs.lstatSync(child).isSymbolicLink()) {
      throw new Error('QA cleanup refuses linked entries.');
    }
    if (entry.isDirectory()) checkOrdinaryTree(child);
  }
}

if (!fs.existsSync(distRoot)) {
  process.stdout.write('No generated local QA assets to remove.\n');
} else {
  const distStat = fs.lstatSync(distRoot);
  if (distStat.isSymbolicLink() || !distStat.isDirectory() || comparable(fs.realpathSync(distRoot)) !== comparable(distRoot)) {
    throw new Error('QA cleanup refuses a linked dist directory.');
  }
  if (fs.existsSync(target)) {
    checkOrdinaryTree(target);
    // All resolved directories above have been checked before recursive removal.
    fs.rmSync(target, { recursive: true });
    process.stdout.write('Removed generated dist/local-test QA assets; source local-test preserved.\n');
  } else {
    process.stdout.write('No generated local QA assets to remove.\n');
  }
}
