import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const failures = [];
const core = read('core.js');
const migration = read('document-migration.js');
const documents = read('settings/documents/data.js');
const consents = read('settings/documents/consents.js');
const history = read('settings/documents/history.js');
const moduleSource = read('server/src/document-state/document-state.module.ts');
const schema = read('server/prisma/schema.prisma');

if (!core.includes('initializeDocumentState')) failures.push('Core must initialize server-owned Documents before workspace render.');
if (!migration.includes("apiRequest('/document-state')") || !migration.includes("apiRequest('/document-state/bootstrap'")) failures.push('Documents startup must read/bootstrap the server owner directly.');
if (/localStorage|readLegacy|\/document-state\/migrate/.test(migration)) failures.push('Documents startup must not depend on browser migration paths.');
if (!documents.includes('hydrateDocumentsFromServer') || !documents.includes('configureDocumentPersistence')) failures.push('Document templates must be server-owned.');
if (!consents.includes('hydrateConsentsFromServer') || !consents.includes('configureConsentPersistence')) failures.push('Consent facts must be server-owned.');
if (!history.includes('hydrateDocumentHistoryFromServer') || !history.includes('configureDocumentHistoryPersistence')) failures.push('Document history must be server-owned.');
if (!moduleSource.includes("import { AuthModule } from '../auth/auth.module';") || !moduleSource.includes('imports: [AuthModule]')) failures.push('DocumentStateModule must import AuthModule for JwtAuthGuard/JwtService runtime wiring.');
if (!schema.includes('model BusinessDocumentState')) failures.push('Server must own a dedicated Documents state.');

if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('document server ownership check: OK');
