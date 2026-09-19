import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const state = read('server/src/document-archive/document-archive.service.ts');
const policy = read('server/src/document-archive/consent-policy.service.ts');
const controller = read('server/src/document-archive/document-archive.controller.ts');
const booking = read('server/src/online-booking/online-booking.service.ts');
const bookingConsent = read('server/src/online-booking/booking-consent.controller.ts');
const bookingPdnGuard = read('server/src/online-booking/booking-pdn-consent.guard.ts');
const migration = read('document-migration.js');
const schema = read('server/prisma/schema.prisma');
const consentMigration = read('server/prisma/migrations/20260915130000_canonical_consent_subjects/migration.sql');
const retirementMigration = read('server/prisma/migrations/20260919143000_retire_legacy_consent_migration/migration.sql');
const namingMigration = read('server/prisma/migrations/20260919161000_rename_consent_events/migration.sql');

assert.match(schema, /model TenantDocumentArchive/);
assert.doesNotMatch(schema, /consentMigratedAt/);
assert.match(consentMigration, /CREATE TABLE "ConsentEvent"/);
assert.match(retirementMigration, /"data" = "data" - 'consents'/);
assert.match(retirementMigration, /DROP COLUMN IF EXISTS "consentMigratedAt"/);
assert.match(retirementMigration, /DROP COLUMN IF EXISTS "migratedFromEventId"/);

assert.match(state, /MUTABLE_DATASETS = new Set\(\['documents', 'history'\]\)/);
assert.doesNotMatch(state, /recordAcceptedConsents/);
assert.doesNotMatch(state, /'documents', 'consents', 'history'/);
assert.match(state, /FROM "TenantConsentEvent"/);

assert.doesNotMatch(policy, /ensureCanonicalConsentEvents/);
assert.match(policy, /INSERT INTO "TenantConsentEvent"/);
assert.match(namingMigration, /ALTER TABLE "ConsentEvent" RENAME TO "TenantConsentEvent"/);
assert.doesNotMatch(policy, /consentMigratedAt/);
assert.doesNotMatch(policy, /migratedFromEventId/);
assert.match(policy, /ON CONFLICT \("id"\) DO NOTHING/);
assert.doesNotMatch(policy, /updateDataset\(tenantId, 'consents'/);

assert.doesNotMatch(controller, /ensureCanonicalConsentEvents/);
assert.match(controller, /consents\/account\/:accountId/);
assert.doesNotMatch(controller, /consents\/client\/:clientId/);

assert.doesNotMatch(booking, /recordAcceptedConsents/);
assert.match(booking, /acceptAccountConsents/);
assert.match(booking, /hasActivePdnConsent\(tenantId, accountId\)/);
assert.doesNotMatch(booking, /requiredConsentState\(tenantId, accountId\)/);
assert.match(bookingConsent, /acceptAccountConsents\(auth\.tenantId, auth\.accountId/);
assert.match(bookingPdnGuard, /accountConsentState\(auth\.tenantId, auth\.accountId\)/);
assert.match(bookingPdnGuard, /if \(!state\.pdnActive\)/);
assert.doesNotMatch(bookingPdnGuard, /requiredConsentState/);

assert.doesNotMatch(migration, /configureConsentPersistence/);
assert.doesNotMatch(migration, /queueDocumentDataset\('consents'/);

console.log('Document Archive single consent store tests: OK');
