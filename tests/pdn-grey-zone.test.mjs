import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const consentPolicy = read('server/src/document-state/consent-policy.service.ts');
const bookingController = read('server/src/online-booking/online-booking.controller.ts');
const notification = read('server/src/notification/notification.service.ts');
const broadcast = read('server/src/communication/communication-broadcast.service.ts');
const telegram = read('server/src/communication/telegram-bot.service.ts');
const documents = read('docs/DOCUMENTS_ARCHITECTURE.md');

assert.match(consentPolicy, /PDN_CONSENT_DOCUMENT_ID = 'pdn-consent'/);
assert.match(consentPolicy, /async hasActivePdnConsent\(/);
assert.match(consentPolicy, /async hasActivePdnConsentForContact\(/);

assert.match(bookingController, /@UseGuards\(BookingAccountGuard\)\s+@Get\(':tenantId\/account\/requests'\)/);
assert.match(bookingController, /@UseGuards\(BookingAccountGuard\)\s+@Get\(':tenantId\/account\/notifications'\)/);
assert.match(bookingController, /@UseGuards\(BookingAccountGuard\)\s+@Post\(':tenantId\/account\/notifications\/:notificationId\/read'\)/);
assert.match(bookingController, /@UseGuards\(BookingAccountGuard, BookingRequiredConsentGuard\)\s+@Post\(':tenantId\/requests'\)/);

assert.match(notification, /purpose !== 'DIRECT' && !\(await this\.documents\.hasActivePdnConsent\(tenantId, identity\.accountId\)\)/);
assert.match(notification, /purpose !== 'DIRECT' && !\(await this\.documents\.hasActivePdnConsent\(tenantId, accountId\)\)/);
assert.match(notification, /purpose !== 'MARKETING'[\s\S]*canSendMarketing/);

assert.match(broadcast, /hasActivePdnConsentForContact\(tenantId, channel, destination\)[\s\S]*canSendMarketing\(tenantId, channel, destination\)/);
assert.match(broadcast, /reason: 'no-pdn-consent'/);
assert.match(broadcast, /reason: 'no-marketing-consent'/);

assert.match(telegram, /purpose !== 'DIRECT'[\s\S]*hasActivePdnConsentForContact/);
assert.match(telegram, /purpose === 'MARKETING'[\s\S]*canSendMarketing/);

assert.match(documents, /revocation does not delete/i);
assert.match(documents, /booking\/request history created before revocation remains readable/i);
assert.match(documents, /Data deletion\/anonymisation is a separate process/i);

console.log('PDN grey-zone tests: OK');
