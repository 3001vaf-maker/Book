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
const archiveService = readFileSync(new URL('../server/src/document-archive/document-archive.service.ts', import.meta.url), 'utf8');
const consentPolicy = readFileSync(new URL('../server/src/document-archive/consent-policy.service.ts', import.meta.url), 'utf8');
const registry = readFileSync(new URL('../server/src/document-registry/document-registry.service.ts', import.meta.url), 'utf8');

assert.match(schema, /model TenantDocumentArchive/);
assert.match(archiveService, /tenantDocumentArchive/);
assert.match(archiveService, /FROM "TenantConsentEvent"/);
assert.match(consentPolicy, /INSERT INTO "TenantConsentEvent"/);
assert.match(registry, /FROM "PlatformConsentEvent"/);

console.log('Document Archive naming tests: OK');
