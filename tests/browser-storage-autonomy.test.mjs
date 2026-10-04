import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const guard = readFileSync(new URL('../scripts/check-browser-storage-ownership.mjs', import.meta.url), 'utf8');
const core = readFileSync(new URL('../core.js', import.meta.url), 'utf8');

assert.equal(existsSync(new URL('../core/legacy-browser-business.js', import.meta.url)), false);
assert.equal(existsSync(new URL('../core/workspace-sync.js', import.meta.url)), false);

for (const key of [
  'book.profile',
  'book.workplaces',
  'book.people',
  'book.uei',
  'book.records',
  'book.recordEvents',
  'book.procedures',
  'book.documents.consents.v1',
  'book.dds',
  'book.wallets',
  'book.products',
]) {
  assert.equal(core.includes(key), false, 'business browser key must not return to core runtime');
}

assert.match(guard, /browser storage is forbidden outside technical\/UI owners/);
assert.match(guard, /core\/auth\.js/);
assert.match(guard, /core\/account\/index\.js/);
assert.match(guard, /core\/workplace-context\.js/);
assert.match(guard, /core\/people\/view-state\.js/);
assert.doesNotMatch(core, /clearLegacyBusinessStorage|workspace-sync/);

console.log('browser storage autonomy tests: OK');
