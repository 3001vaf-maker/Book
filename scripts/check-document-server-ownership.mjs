import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const failures = [];
const core = read('core.js');
const runtime = read('core/runtime/tenant-document-archive.js');
const documents = read('settings/documents/data.js');
const consents = read('settings/documents/consents.js');
const history = read('settings/documents/history.js');
const moduleSource = read('server/src/tenant-document-archive/tenant-document-archive.module.ts');
const schema = read('server/prisma/schema.prisma');

if (!core.includes('loadTenantDocumentArchive')) failures.push('Core must load server-owned Documents before workspace render.');
if (!runtime.includes("apiRequest('/tenant-document-archive/initialize'")) failures.push('Documents startup must initialize the canonical server owner directly.');
if (/localStorage|readLegacy|\/migrate|bootstrap/.test(runtime)) failures.push('Documents runtime must not depend on transition paths.');
if (!documents.includes('hydrateDocumentsFromServer') || !documents.includes('configureDocumentPersistence')) failures.push('Document templates must be server-owned.');
if (!consents.includes('hydrateConsentsFromServer') || consents.includes('configureConsentPersistence') || consents.includes('recordConsent')) failures.push('Consent facts must be read-only in the browser and server-owned.');
if (!history.includes('hydrateDocumentHistoryFromServer') || !history.includes('configureDocumentHistoryPersistence')) failures.push('Document history must be server-owned.');
if (!moduleSource.includes("import { AuthModule } from '../auth/auth.module';") || !moduleSource.includes('AuthModule') || !moduleSource.includes('BusinessStateModule') || !moduleSource.includes('DocumentRegistryModule')) failures.push('TenantDocumentArchiveModule must import AuthModule, BusinessStateModule and DocumentRegistryModule for the server-owned document contour.');
if (!schema.includes('model TenantDocumentArchive')) failures.push('Server must own a dedicated Tenant Document Archive.');
const server = read('server/src/tenant-document-archive/tenant-document-archive.service.ts');
if (/migrationVerifiedAt|verifyMigration|\bmigrate\(|bootstrap|legacyFormat/.test(server)) failures.push('Document server owner must not contain runtime transition bridges.');

if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('document server ownership check: OK');
