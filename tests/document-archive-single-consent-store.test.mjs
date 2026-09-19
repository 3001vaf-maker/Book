import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const state = read('server/src/document-state/document-state.service.ts');
const policy = read('server/src/document-state/consent-policy.service.ts');
const controller = read('server/src/document-state/document-state.controller.ts');
const booking = read('server/src/online-booking/online-booking.service.ts');
const bookingConsent = read('server/src/online-booking/booking-consent.controller.ts');
const bookingPdnGuard = read('server/src/online-booking/booking-pdn-consent.guard.ts');
const migration = read('document-migration.js');
const schema = read('server/prisma/schema.prisma');
const consentMigration = read('server/prisma/migrations/20260915130000_canonical_consent_subjects/migration.sql');

assert.match(schema, /model BusinessDocumentState/);
assert.match(schema, /consentMigratedAt\s+DateTime\?/);
assert.match(consentMigration, /CREATE TABLE "ConsentEvent"/);

assert.match(state, /MUTABLE_DATASETS = new Set\(\['documents', 'history'\]\)/);
assert.doesNotMatch(state, /recordAcceptedConsents/);
assert.doesNotMatch(state, /'documents', 'consents', 'history'/);
assert.match(state, /FROM "ConsentEvent"/);

assert.match(policy, /ensureCanonicalConsentEvents/);
assert.match(policy, /INSERT INTO "ConsentEvent"/);
assert.match(policy, /consentMigratedAt/);
assert.match(policy, /ON CONFLICT \("id"\) DO NOTHING/);
assert.doesNotMatch(policy, /updateDataset\(tenantId, 'consents'/);

assert.match(controller, /await this\.consentPolicy\.ensureCanonicalConsentEvents/);
assert.match(controller, /consents\/account\/:accountId/);
assert.doesNotMatch(controller, /consents\/client\/:clientId/);

assert.doesNotMatch(booking, /recordAcceptedConsents/);
assert.match(booking, /acceptAccountConsents/);
assert.match(booking, /requiredConsentState\(tenantId, accountId\)/);
assert.match(bookingConsent, /acceptAccountConsents\(auth\.tenantId, auth\.accountId/);
assert.match(bookingPdnGuard, /requiredConsentState\(auth\.tenantId, auth\.accountId\)/);
assert.match(bookingPdnGuard, /hasActivePdnConsent\(auth\.tenantId, auth\.accountId\)/);

assert.match(migration, /configureConsentPersistence\(null\)/);
assert.doesNotMatch(migration, /queueDocumentDataset\('consents'/);

console.log('Document Archive single consent store tests: OK');
