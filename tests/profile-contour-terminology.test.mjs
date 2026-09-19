import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const self = relative(root, fileURLToPath(import.meta.url)).replaceAll('\\', '/');
const extensions = new Set(['.js', '.mjs', '.ts', '.prisma', '.html', '.json']);
const excludedPrefixes = [
  'node_modules/',
  '.git/',
  'server/prisma/migrations/',
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

const forbidden = [
  [/[Mm]aster|мастер/iu, 'profession-specific master terminology'],
  [/model\s+User\s*\{/u, 'retired platform account model'],
  [/\buserId\b/u, 'retired platform account id'],
  [/prisma\.user\b/u, 'retired prisma user delegate'],
  [/tx\.user\b/u, 'retired transactional user delegate'],
  [/getCurrentUser\b/u, 'retired account helper'],
];

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
  `PROFILE contour contains retired terminology:\n${violations.join('\n')}`,
);

console.log('Profile contour terminology audit: OK');
