import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const self = relative(root, fileURLToPath(import.meta.url)).replaceAll('\\', '/');
const extensions = new Set(['.js', '.mjs', '.ts', '.prisma', '.sql', '.html', '.md', '.json', '.yml', '.yaml']);
const excludedPrefixes = ['node_modules/', '.git/'];
const forbiddenLatin = ['ma', 'ster'].join('');
const forbiddenRussian = ['ма', 'стер'].join('');
const forbidden = new RegExp(`${forbiddenLatin}|${forbiddenRussian}`, 'i');

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
    if (forbidden.test(line)) violations.push(`${path}:${index + 1}: ${line.trim()}`);
  });
}

assert.deepEqual(
  violations,
  [],
  `Professional-role terminology remains in repository:\n${violations.join('\n')}`,
);

console.log('Neutral profile terminology tests: OK');
