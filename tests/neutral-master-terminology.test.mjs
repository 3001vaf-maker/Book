import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const self = relative(root, fileURLToPath(import.meta.url)).replaceAll('\\', '/');
const extensions = new Set(['.js', '.mjs', '.ts', '.prisma', '.html', '.json']);
const excludedPrefixes = [
  'server/prisma/migrations/',
  'node_modules/',
  '.git/',
  'docs/',
];

function extension(path) {
  const index = path.lastIndexOf('.');
  return index < 0 ? '' : path.slice(index);
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = resolve(dir, name);
    const rel = relative(root, full).replaceAll('\\', '/');
    if (excludedPrefixes.some((prefix) => rel === prefix.slice(0, -1) || rel.startsWith(prefix))) return [];
    const stat = statSync(full);
    if (stat.isDirectory()) return walk(full);
    if (!extensions.has(extension(rel)) || rel === self) return [];
    return [rel];
  });
}

const violations = [];
for (const path of walk(root)) {
  const lines = readFileSync(resolve(root, path), 'utf8').split('\n');
  lines.forEach((line, index) => {
    if (!/master|мастер/i.test(line)) return;

    violations.push(`${path}:${index + 1}: ${line.trim()}`);
  });
}

assert.deepEqual(
  violations,
  [],
  `System master terminology remains outside Profile.profession values:\n${violations.join('\n')}`,
);

console.log('Neutral master terminology tests: OK');
