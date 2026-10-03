import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const policy = read('server/src/tenant-document-archive/consent-policy.service.ts');
const registry = read('server/src/document-registry/document-registry.service.ts');
const guard = read('server/src/online-booking/booking-pdn-consent.guard.ts');
const booking = read('server/src/online-booking/online-booking.service.ts');
const notification = read('server/src/notification/notification.service.ts');
const telegram = read('server/src/communication/telegram-bot.service.ts');
const broadcast = read('server/src/communication/communication-broadcast.service.ts');

assert.match(registry, /user-document-pdn-consent'[\s\S]*?documentId: 'pdn-consent'[\s\S]*?personConsent: true[\s\S]*?required: true/, 'PDN consent must remain mandatory');
assert.match(registry, /user-document-messages-consent'[\s\S]*?documentId: 'messages-consent'[\s\S]*?personConsent: true[\s\S]*?required: false/, 'Marketing consent must remain optional');

assert.match(policy, /const PDN_CONSENT_DOCUMENT_ID = 'pdn-consent'/);
assert.match(policy, /const MARKETING_CONSENT_DOCUMENT_ID = 'messages-consent'/);
assert.match(policy, /async hasActivePdnConsent\(/);
assert.match(policy, /FROM "TenantConsentEvent"[\s\S]*"subjectType" = 'ACCOUNT'/);
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
