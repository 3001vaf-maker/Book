import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { BOOK_CAPABILITIES } from '../core/capability-registry.js';

const serverCatalog = readFileSync(new URL('../server/src/master-invitation/master-invitation.service.ts', import.meta.url), 'utf8');
const accessRuntime = readFileSync(new URL('../core/access-runtime.js', import.meta.url), 'utf8');
const accessClient = readFileSync(new URL('../core/access.js', import.meta.url), 'utf8');
const bootstrap = readFileSync(new URL('../core/bootstrap.js', import.meta.url), 'utf8');
const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

const serverKeys = [...serverCatalog.matchAll(/\{\s*key:\s*'([^']+)'/g)].map((match) => match[1]).sort();
const registryKeys = Object.keys(BOOK_CAPABILITIES).sort();

assert.deepEqual(registryKeys, serverKeys, 'Capability catalog and frontend registry must contain the same keys');

for (const [key, meta] of Object.entries(BOOK_CAPABILITIES)) {
  assert.ok(meta.title, `${key}: title is required`);
  assert.ok(meta.description, `${key}: description is required for the master announcement`);
  assert.ok(meta.owner, `${key}: owner file is required`);
  const ownerUrl = new URL(`../${meta.owner}`, import.meta.url);
  assert.ok(existsSync(ownerUrl), `${key}: owner file does not exist: ${meta.owner}`);
  const ownerSource = readFileSync(ownerUrl, 'utf8');
  assert.match(ownerSource, new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${key}: owner does not enforce or expose capability`);
}

assert.match(index, /core\/bootstrap\.js/);
assert.match(bootstrap, /import '\.\/access-runtime\.js'/);
assert.match(bootstrap, /import\('\.\.\/core\.js'\)/);
assert.match(accessClient, /cache:\s*'no-store'/);
assert.match(accessClient, /book:access-updated/);
assert.match(accessRuntime, /visibilitychange/);
assert.match(accessRuntime, /window\.addEventListener\('focus'/);
assert.match(accessRuntime, /В Book появились новые возможности/);
assert.match(accessRuntime, /window\.location\.reload\(\)/);

console.log('capability contract tests: OK');
