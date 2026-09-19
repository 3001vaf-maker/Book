import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const buildPages = read('scripts/build-pages.mjs');
const catalog = read('admin/document-registry/catalog.js');
const legalStatus = read('docs/BOOK_OPERATOR_LEGAL_STATUS.md');

assert.match(buildPages, /['"]archive['"]/);
assert.equal(existsSync(new URL('../archive/documents-20260918', import.meta.url)), false, 'obsolete document snapshot must stay removed');

for (const key of [
  'privacy-policy',
  'saas-agreement',
  'platform-processor-consent',
  'marketing-consent',
  'public-profile-consent',
  'dpa',
  'user-document-pdn-policy',
  'user-document-pdn-consent',
  'user-document-messages-consent',
]) {
  assert.match(catalog, new RegExp(`key:\\s*["']${key}["']`), `canonical document missing: ${key}`);
}

assert.match(legalStatus, /140141\/77/);
assert.match(legalStatus, /100427372/);
assert.match(legalStatus, /admin\/document-registry\/catalog\.js/);

console.log('Technical document archive cleanup tests: OK');
