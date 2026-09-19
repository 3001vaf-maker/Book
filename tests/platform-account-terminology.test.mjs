import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const self = relative(root, fileURLToPath(import.meta.url)).replaceAll('\\', '/');
const extensions = new Set(['.js', '.mjs', '.ts', '.prisma']);
const excludedPrefixes = ['node_modules/', '.git/', 'server/prisma/migrations/'];
const retiredModel = new RegExp(['model ', 'User', ' \\{'].join(''));
const retiredId = new RegExp(['\\buser', 'Id\\b'].join(''));
const retiredPrisma = new RegExp(['prisma\\.', 'user\\b'].join(''));
const retiredTx = new RegExp(['tx\\.', 'user\\b'].join(''));
const retiredCurrentHelper = new RegExp(['getCurrent', 'User\\b'].join(''));
const retiredMembershipRelation = new RegExp(['membership\\.', 'user\\b'].join(''));
const retiredAdminRelation = new RegExp(['admin\\.', 'user\\b'].join(''));

const forbidden = [
  [retiredModel, 'retired platform account model'],
  [retiredId, 'retired platform account id'],
  [retiredPrisma, 'retired prisma account delegate'],
  [retiredTx, 'retired transactional account delegate'],
  [retiredCurrentHelper, 'retired account helper'],
  [retiredMembershipRelation, 'retired membership account relation'],
  [retiredAdminRelation, 'retired admin account relation'],
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
