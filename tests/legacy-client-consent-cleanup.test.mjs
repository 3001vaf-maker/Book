import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const peopleData = read('main/people/data.js');
const peopleUi = read('main/people/people.js');
const browserConsents = read('settings/documents/consents.js');
const businessState = read('server/src/business-state/business-state.service.ts');
const migration = read('tenant-document-archive.js');
const policy = read('server/src/tenant-document-archive/consent-policy.service.ts');
const cleanupMigration = read('server/prisma/migrations/20260919124500_remove_legacy_business_person_agreements/migration.sql');

assert.doesNotMatch(peopleData, /migrateLegacyConsents/);
assert.doesNotMatch(peopleData, /getLatestClientConsent/);
assert.doesNotMatch(peopleData, /agreements\s*:/);
assert.doesNotMatch(peopleData, /person\.agreements/);
assert.doesNotMatch(peopleUi, /getLatestClientConsent/);
assert.doesNotMatch(peopleUi, /p\.agreements/);
assert.match(peopleUi, /getConsents/);
assert.match(peopleUi, /BOOKING_ACCOUNT/);
assert.match(peopleUi, /CONTACT_POINT/);

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
