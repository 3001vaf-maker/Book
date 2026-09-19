import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getBookDocumentBases } from '../admin/document-registry/catalog.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const policy = read('server/src/document-archive/consent-policy.service.ts');
const guard = read('server/src/online-booking/booking-pdn-consent.guard.ts');
const booking = read('server/src/online-booking/online-booking.service.ts');
const notification = read('server/src/notification/notification.service.ts');
const telegram = read('server/src/communication/telegram-bot.service.ts');
const broadcast = read('server/src/communication/communication-broadcast.service.ts');

const bases = getBookDocumentBases();
const pdn = bases.find((item) => item.documentId === 'pdn-consent');
const marketing = bases.find((item) => item.documentId === 'messages-consent');

assert.ok(pdn, 'PDN consent base must exist');
assert.equal(pdn.clientConsent, true);
assert.equal(pdn.required, true, 'PDN consent must remain mandatory');

assert.ok(marketing, 'Marketing consent base must exist');
assert.equal(marketing.clientConsent, true);
assert.equal(marketing.required, false, 'Marketing consent must remain optional');

assert.match(policy, /const PDN_CONSENT_DOCUMENT_ID = 'pdn-consent'/);
assert.match(policy, /const MARKETING_CONSENT_DOCUMENT_ID = 'messages-consent'/);
assert.match(policy, /async hasActivePdnConsent\(/);
assert.match(policy, /FROM "ConsentEvent"[\s\S]*"subjectType" = 'BOOKING_ACCOUNT'/);
assert.match(policy, /async canSendMarketing\([\s\S]*MARKETING_CONSENT_DOCUMENT_ID/);

assert.match(policy, /async accountConsentState\(/);
assert.doesNotMatch(policy, /async requiredConsentState\(/);
assert.match(guard, /accountConsentState\(auth\.tenantId, auth\.accountId\)/);
assert.match(guard, /if \(!state\.pdnActive\)/);
assert.doesNotMatch(guard, /state\.allowed/);

assert.match(booking, /async createRequest[\s\S]*hasActivePdnConsent\(tenantId, accountId\)/);
assert.doesNotMatch(booking, /async createRequest[\s\S]*requiredConsentState\(tenantId, accountId\)/);

assert.match(notification, /hasActivePdnConsent\(tenantId, identity\.accountId\)/);
assert.match(notification, /purpose !== 'MARKETING'\) return true/);
assert.match(notification, /canSendMarketing\(tenantId, channel, recipient\)/);

assert.match(telegram, /hasActivePdnConsentForContact\(tenantId, 'TELEGRAM', identity\.externalUserId\)/);
assert.match(telegram, /purpose === 'MARKETING'[\s\S]*canSendMarketing/);

assert.match(broadcast, /hasActivePdnConsentForContact\(tenantId, channel, destination\)[\s\S]*canSendMarketing\(tenantId, channel, destination\)/);

console.log('Consent access contract tests: OK');
