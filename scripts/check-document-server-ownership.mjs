import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const failures = [];
const core = read('core.js');
const migration = read('document-migration.js');
const documents = read('settings/documents/data.js');
const consents = read('settings/documents/consents.js');
const history = read('settings/documents/history.js');
const moduleSource = read('server/src/document-state/document-state.module.ts');
const documentService = read('server/src/document-state/document-state.service.ts');
const consentPolicy = read('server/src/document-state/consent-policy.service.ts');

if (!core.includes('initializeDocumentState')) failures.push('Core must initialize server-owned Documents before workspace render.');
if (!migration.includes("apiRequest('/document-state')") || !migration.includes("apiRequest('/document-state/bootstrap'")) failures.push('Documents startup must read/bootstrap the server owner directly.');
if (/localStorage|readLegacy|\/document-state\/migrate/.test(migration)) failures.push('Documents startup must not depend on browser migration paths.');
if (!documents.includes('hydrateDocumentsFromServer') || !documents.includes('configureDocumentPersistence')) failures.push('Document templates must be server-owned.');
if (!consents.includes('hydrateConsentsFromServer') || !consents.includes('getLatestContactConsent') || !consents.includes('getLatestAccountConsent')) failures.push('Consent UI must hydrate canonical server projections.');
if (/configureConsentPersistence|recordConsent|migrateLegacyConsents|clientId/.test(consents)) failures.push('Browser consent state must not own or write consent facts and must not use clientId as a subject.');
if (/queueDocumentDataset\(['"]consents['"]/.test(migration)) failures.push('Browser persistence must never replace the consent event log.');
if (!history.includes('hydrateDocumentHistoryFromServer') || !history.includes('configureDocumentHistoryPersistence')) failures.push('Document history must be server-owned.');
if (!moduleSource.includes("import { AuthModule } from '../auth/auth.module';") || !moduleSource.includes('imports: [AuthModule]')) failures.push('DocumentStateModule must import AuthModule for JwtAuthGuard/JwtService runtime wiring.');
if (!documentService.includes('append-only событиями Documents') || !documentService.includes('FROM "ConsentEvent"')) failures.push('Documents must expose the append-only ConsentEvent store as the canonical consent history.');
if (!consentPolicy.includes("'BOOKING_ACCOUNT'") || !consentPolicy.includes("'CONTACT_POINT'")) failures.push('Consent policy must use stable booking-account/contact-point subjects.');
if (!consentPolicy.includes('ensureCanonicalConsentEvents')) failures.push('Consent policy must include the one-time historical consent migration.');

if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('document server ownership check: OK');
