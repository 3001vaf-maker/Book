import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const clientData = read('main/clients/data.js');
const clientUi = read('main/clients/clients.js');
const browserConsents = read('settings/documents/consents.js');
const businessState = read('server/src/business-state/business-state.service.ts');
const migration = read('document-migration.js');
const policy = read('server/src/document-state/consent-policy.service.ts');
const cleanupMigration = read('server/prisma/migrations/20260919124500_remove_legacy_business_person_agreements/migration.sql');

assert.doesNotMatch(clientData, /migrateLegacyConsents/);
assert.doesNotMatch(clientData, /getLatestClientConsent/);
assert.doesNotMatch(clientData, /agreements\s*:/);
assert.doesNotMatch(clientData, /person\.agreements/);
assert.doesNotMatch(clientUi, /getLatestClientConsent/);
assert.doesNotMatch(clientUi, /p\.agreements/);
assert.match(clientUi, /getConsents/);
assert.match(clientUi, /BOOKING_ACCOUNT/);
assert.match(clientUi, /CONTACT_POINT/);

assert.match(browserConsents, /hydrateConsentsFromServer/);
assert.match(browserConsents, /subjectType/);
assert.match(browserConsents, /subjectKey/);
assert.match(browserConsents, /contactType/);
assert.match(browserConsents, /contactValue/);
assert.doesNotMatch(browserConsents, /clientId/);
assert.doesNotMatch(browserConsents, /migrateLegacyConsents/);
assert.doesNotMatch(browserConsents, /getClientConsents/);
assert.doesNotMatch(browserConsents, /getLatestClientConsent/);
assert.doesNotMatch(browserConsents, /recordConsent/);
assert.doesNotMatch(browserConsents, /configureConsentPersistence/);
assert.doesNotMatch(browserConsents, /persistConsents/);

assert.doesNotMatch(businessState, /agreements:\s*objectValue\(previous\.agreements\)/);
assert.doesNotMatch(migration, /configureConsentPersistence/);
assert.match(cleanupMigration, /UPDATE \"BusinessPerson\"/);
assert.match(cleanupMigration, /\"data\" = \"data\" - 'agreements'/);

assert.doesNotMatch(policy, /legacy\?\.clientId/);
assert.doesNotMatch(policy, /ensureCanonicalConsentEvents/);
assert.doesNotMatch(policy, /legacy-consent-migration/);

console.log('Legacy client consent cleanup tests: OK');
