import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const catalogModule = await import('../admin/document-registry/catalog.js');
const bookDocs = catalogModule.getRegistryBookUserDocuments();
const userBases = catalogModule.getRegistryUserDocumentBases();

assert.equal(bookDocs.length, 6, 'Document Registry must contain exactly 6 Book ↔ user documents');
assert.equal(userBases.length, 4, 'Document Registry must contain exactly 4 user document bases including the RKN guide template');
assert.equal(new Set([...bookDocs, ...userBases].map((item) => item.key)).size, 10, 'Registry document keys must be unique');

for (const item of [...bookDocs, ...userBases]) {
  assert.ok(item.title?.trim(), `Missing title for ${item.key}`);
  assert.ok(item.content?.trim().length > 500, `Document content is unexpectedly short for ${item.key}`);
}

const admin = readFileSync(new URL('../admin/admin.js', import.meta.url), 'utf8');
const view = readFileSync(new URL('../admin/document-registry/view.js', import.meta.url), 'utf8');
const history = readFileSync(new URL('../admin/document-registry/history.js', import.meta.url), 'utf8');
const profileMigration = readFileSync(new URL('../tenant-document-archive.js', import.meta.url), 'utf8');
const controller = readFileSync(new URL('../server/src/saas-admin/saas-admin.controller.ts', import.meta.url), 'utf8');
const service = readFileSync(new URL('../server/src/document-registry/document-registry.service.ts', import.meta.url), 'utf8');
const namingMigration = readFileSync(new URL('../server/prisma/migrations/20260919161000_rename_consent_events/migration.sql', import.meta.url), 'utf8');
const platformArchiveMigration = readFileSync(new URL('../server/prisma/migrations/20260919162000_platform_document_archive/migration.sql', import.meta.url), 'utf8');
const appModule = readFileSync(new URL('../server/src/app.module.ts', import.meta.url), 'utf8');

assert.match(admin, /import \{ renderDocumentRegistry \} from '\.\/document-registry\/view\.js'/);
assert.match(admin, /data-section="document-registry">Реестр документов</);
assert.match(admin, /adminRequest\('\/document-registry\/history'\)/);
assert.doesNotMatch(admin, /renderAdminDocuments|data-section="documents">Документы</);

assert.match(view, /<h2>Реестр документов<\/h2>/);
assert.match(view, /Book ↔ пользователь/);
assert.match(view, /Основы документов пользователя/);
assert.match(view, /История Book ↔ пользователь/);
assert.match(view, /Подписанная версия/);
assert.match(history, /Admin\/Document Registry only/);

assert.match(profileMigration, /\.\/admin\/document-registry\/catalog\.js/);
assert.doesNotMatch(profileMigration, /\.\/admin\/documents\/catalog\.js/);

assert.match(controller, /@Get\('document-registry\/history'\)/);
assert.match(service, /FROM "PlatformConsentEvent"/);
assert.match(service, /FROM "AccountDocumentEvent"/);
assert.match(service, /'ACCOUNT'::text AS "subjectType"/);
assert.match(service, /UNION ALL/);
assert.match(service, /v\."contentSnapshot" AS "documentContent"/);
assert.match(service, /JOIN "PlatformDocumentVersion"/);
assert.match(service, /JOIN "PlatformDocument"/);
assert.doesNotMatch(service, /"scope"/);
assert.match(platformArchiveMigration, /PlatformDocument/);
assert.match(platformArchiveMigration, /PlatformDocumentVersion/);
assert.match(platformArchiveMigration, /DROP COLUMN "scope"/);
assert.match(platformArchiveMigration, /DROP COLUMN "tenantId"/);
assert.match(namingMigration, /PlatformConsentEvent_append_only/);

assert.equal(existsSync(new URL('../admin/documents/catalog.js', import.meta.url)), false, 'Old Admin/Documents catalog must be removed');
assert.equal(existsSync(new URL('../admin/documents/view.js', import.meta.url)), false, 'Old Admin/Documents view must be removed');
assert.equal(existsSync(new URL('../admin/documents/history.js', import.meta.url)), false, 'Old Admin/Documents history must be removed');

assert.doesNotMatch(view, /settings\/documents/);
assert.doesNotMatch(history, /settings\/documents/);
assert.doesNotMatch(appModule, /LegalRuntimeModule/);

console.log('Document Registry root and history tests: OK');
