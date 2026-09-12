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
if (!migration.includes("/document-state/migrate/verify")) failures.push('Documents migration must verify the server copy before switching source.');
if (!documents.includes('hydrateDocumentsFromServer') || !documents.includes('configureDocumentPersistence')) failures.push('Document templates must become server-owned after migration.');
if (!consents.includes('hydrateConsentsFromServer') || !consents.includes('configureConsentPersistence')) failures.push('Consent facts must become server-owned after migration.');
if (!history.includes('hydrateDocumentHistoryFromServer') || !history.includes('configureDocumentHistoryPersistence')) failures.push('Document history must become server-owned after migration.');
if (!moduleSource.includes("import { AuthModule } from '../auth/auth.module';") || !moduleSource.includes('imports: [AuthModule]')) failures.push('DocumentStateModule must import AuthModule for JwtAuthGuard/JwtService runtime wiring.');
if (!schema.includes('model BusinessDocumentState')) failures.push('Server must own a dedicated Documents state.');

if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('document server ownership check: OK');
