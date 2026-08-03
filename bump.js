#!/usr/bin/env node
/* Bump the version everywhere it is written down, in one command.
 *
 *   node bump.js 0.3.0     explicit version
 *   node bump.js minor     0.2.1 -> 0.3.0
 *   node bump.js patch     0.2.1 -> 0.2.2
 *
 * Keeping these in step is what stops a phone serving a stale build:
 * the query strings give every release a fresh asset URL, and version.json
 * is what the running game polls to notice it is out of date. */

const fs = require('fs');
const path = require('path');

const root = __dirname;
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const write = (f, s) => fs.writeFileSync(path.join(root, f), s);

const current = read('game.js').match(/const VERSION = '([\d.]+)'/)[1];

function nextVersion(arg) {
  if (!arg) throw new Error('usage: node bump.js <version|major|minor|patch>');
  if (/^\d+\.\d+\.\d+$/.test(arg)) return arg;
  const [ma, mi, pa] = current.split('.').map(Number);
  if (arg === 'major') return `${ma + 1}.0.0`;
  if (arg === 'minor') return `${ma}.${mi + 1}.0`;
  if (arg === 'patch') return `${ma}.${mi}.${pa + 1}`;
  throw new Error(`not a version or major/minor/patch: ${arg}`);
}

const next = nextVersion(process.argv[2]);

// The single source of truth the game reports at runtime.
write('game.js', read('game.js').replace(
  /const VERSION = '[\d.]+'/, `const VERSION = '${next}'`));

// Fresh asset URLs, so a cached index.html can never pull stale css or js.
write('index.html', read('index.html').replace(
  /(styles\.css|animals\.js|game\.js)\?v=[\d.]+/g, `$1?v=${next}`));

// What a running copy polls to discover it is behind.
write('version.json', `{ "version": "${next}" }\n`);

write('README.md', read('README.md').replace(
  /\*\*Current version: v[\d.]+\*\*/, `**Current version: v${next}**`));

console.log(`${current} -> ${next}`);
console.log('Updated game.js, index.html, version.json, README.md.');
console.log('Now add a CHANGELOG.md entry and commit.');
