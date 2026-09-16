import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const bootstrapOwners = [
  'settings/profile/migration.js',
  'business-migration.js',
  'operational-migration.js',
  'document-migration.js',
  'auxiliary-migration.js',
];

for (const file of bootstrapOwners) {
  const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
  assert.ok(!source.includes('account?.user?.workspaceUnlocked'), `${file} must not block empty server bootstrap because of legacy workspaceUnlocked state`);
  assert.ok(source.includes('server-bootstrap'), `${file} must support clean server bootstrap`);
}

const core = await readFile(new URL('../core.js', import.meta.url), 'utf8');
assert.ok(!core.includes('Сервер ожидает безопасный перенос данных из основного браузера'), 'Book must not show legacy browser-migration messaging');
assert.ok(core.includes('Данные из браузера не используются.'), 'Book must explicitly keep browser business data out of server bootstrap');

console.log('clean bootstrap tests: OK');
