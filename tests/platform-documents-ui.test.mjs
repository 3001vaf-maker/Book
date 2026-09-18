import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const catalog = readFileSync(new URL('../server/src/platform-documents/platform-document-catalog.ts', import.meta.url), 'utf8');
const controller = readFileSync(new URL('../server/src/platform-documents/platform-documents.controller.ts', import.meta.url), 'utf8');
const appModule = readFileSync(new URL('../server/src/app.module.ts', import.meta.url), 'utf8');
const admin = readFileSync(new URL('../admin/admin.js', import.meta.url), 'utf8');

const bookUserKeys = [
  'privacy-policy',
  'saas-agreement',
  'master-pd-consent',
  'marketing-consent',
  'public-profile-consent',
  'dpa',
];
const baseKeys = [
  'user-document-pdn-policy',
  'user-document-pdn-consent',
  'user-document-messages-consent',
];

for (const key of [...bookUserKeys, ...baseKeys]) assert.match(catalog, new RegExp(`key: ["']${key}["']`));

assert.match(controller, /@Controller\('platform-documents'\)/);
assert.match(controller, /@Get\(\)/);
assert.doesNotMatch(controller, /@Post|@Put|@Delete/);
assert.match(appModule, /PlatformDocumentsModule/);
assert.match(admin, /data-section="documents"/);
assert.match(admin, /Book ↔ пользователь/);
assert.match(admin, /Основы документов пользователя/);
assert.doesNotMatch(controller, /LEGAL_READY|DEMO|LIVE|readiness|assertPlatformLegalReady/);

console.log('platform documents inert UI tests: OK');
