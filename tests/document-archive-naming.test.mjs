import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('../', import.meta.url);
const rootPath = root.pathname;

const ignored = new Set([
  'server/prisma/migrations',
  '.git',
  'node_modules',
]);

const textExtensions = new Set(['.js', '.mjs', '.ts', '.md', '.json', '.prisma', '.sql']);
const oldPatterns = [
  ['BusinessDocumentState', /BusinessDocumentState/],
  ['businessDocumentState', /businessDocumentState/],
  ['document-state', /document-state/],
  ['DocumentState', /DocumentState/],
  ['LegalAcceptanceEvent', /LegalAcceptanceEvent/],
  ['LegalDocument', /LegalDocument/],
  ['generic-document-archive-route', /\/document-archive(?:\/|['"])/],
  ['generic-DocumentArchiveService', /\bDocumentArchiveService\b/],
  ['generic-DocumentArchiveModule', /\bDocumentArchiveModule\b/],
  ['old-document-migration-file', /document-migration\.js/],
  ['old-document-archive-source', /server\/src\/document-archive/],
];

function extension(path) {
  const match = path.match(/(\.[^.\/]+)$/);
  return match ? match[1] : '';
}

function walk(dir, output = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const rel = relative(rootPath, path).replaceAll('\\', '/');
    if ([...ignored].some((prefix) => rel === prefix || rel.startsWith(`${prefix}/`))) continue;
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path, output);
    else if (textExtensions.has(extension(path))) output.push({ path, rel });
  }
  return output;
}

const failures = [];
for (const item of walk(rootPath)) {
  if (item.rel === 'tests/document-archive-naming.test.mjs') continue;
  const source = readFileSync(item.path, 'utf8');
  for (const [label, pattern] of oldPatterns) {
    if (pattern.test(source)) failures.push(`${item.rel}: contains retired name ${label}`);
  }
}

assert.deepEqual(failures, [], failures.join('\n'));

const schema = readFileSync(new URL('../server/prisma/schema.prisma', import.meta.url), 'utf8');
const archiveService = readFileSync(new URL('../server/src/tenant-document-archive/tenant-document-archive.service.ts', import.meta.url), 'utf8');
const consentPolicy = readFileSync(new URL('../server/src/tenant-document-archive/consent-policy.service.ts', import.meta.url), 'utf8');
const registry = readFileSync(new URL('../server/src/document-registry/document-registry.service.ts', import.meta.url), 'utf8');
const architecture = readFileSync(new URL('../docs/DOCUMENTS_ARCHITECTURE.md', import.meta.url), 'utf8');
const platformMigration = readFileSync(new URL('../server/prisma/migrations/20260919162000_platform_document_archive/migration.sql', import.meta.url), 'utf8');

assert.equal((schema.match(/model TenantDocumentArchive/g) || []).length, 1);
assert.match(archiveService, /tenantDocumentArchive/);
assert.match(archiveService, /FROM "TenantConsentEvent"/);
assert.match(consentPolicy, /INSERT INTO "TenantConsentEvent"/);
assert.match(registry, /FROM "PlatformConsentEvent"/);
assert.match(registry, /JOIN "PlatformDocumentVersion"/);
assert.match(registry, /JOIN "PlatformDocument"/);
assert.doesNotMatch(registry, /"scope"/);
assert.match(architecture, /`PlatformDocumentArchive`/);
assert.match(architecture, /`TenantDocumentArchive`/);
assert.match(platformMigration, /WHERE "scope" <> 'PLATFORM' OR "tenantId" IS NOT NULL/);
assert.match(platformMigration, /DROP COLUMN "scope"/);
assert.match(platformMigration, /DROP COLUMN "tenantId"/);

console.log('Document Archive naming tests: OK');
