import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const self = relative(root, fileURLToPath(import.meta.url)).replaceAll('\\', '/');
const extensions = new Set(['.js', '.mjs', '.ts', '.prisma']);
const excludedPrefixes = ['node_modules/', '.git/', 'server/prisma/migrations/'];
const forbidden = [
  [/model User \{/, 'Prisma model User'],
  [/\buserId\b/, 'userId'],
  [/prisma\.user\b/, 'prisma.user'],
  [/tx\.user\b/, 'tx.user'],
  [/getCurrentUser\b/, 'getCurrentUser'],
  [/membership\.user\b/, 'membership.user'],
  [/admin\.user\b/, 'admin.user'],
];

function ext(path) {
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
    if (!extensions.has(ext(rel)) || rel === self) return [];
    return [rel];
  });
}

const violations = [];
for (const path of walk(root)) {
  const lines = readFileSync(resolve(root, path), 'utf8').split('\n');
  lines.forEach((line, index) => {
    for (const [pattern, label] of forbidden) {
      if (pattern.test(line)) violations.push(`${path}:${index + 1} [${label}] ${line.trim()}`);
    }
  });
}

assert.deepEqual(
  violations,
  [],
  `Retired platform account terminology remains:\n${violations.join('\n')}`,
);

console.log('Platform account terminology tests: OK');
