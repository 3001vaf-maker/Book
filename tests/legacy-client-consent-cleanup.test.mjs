import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const clients = read('main/clients/data.js');
const browserConsents = read('settings/documents/consents.js');
const businessState = read('server/src/business-state/business-state.service.ts');
const migration = read('document-migration.js');
const policy = read('server/src/document-state/consent-policy.service.ts');

assert.doesNotMatch(clients, /migrateLegacyConsents/);
assert.doesNotMatch(clients, /getLatestClientConsent/);
assert.doesNotMatch(clients, /agreements\s*:/);
assert.doesNotMatch(clients, /person\.agreements/);

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

// Historical clientId remains legal only inside the one-time server migration until that migration is retired.
assert.match(policy, /const historicalPersonKey = text\(legacy\?\.clientId\)/);
assert.match(policy, /ensureCanonicalConsentEvents/);

console.log('Legacy client consent cleanup tests: OK');
