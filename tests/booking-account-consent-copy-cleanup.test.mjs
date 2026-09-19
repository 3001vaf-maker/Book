import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const schema = read('server/prisma/schema.prisma');
const service = read('server/src/online-booking/online-booking.service.ts');
const guard = read('server/src/online-booking/booking-pdn-consent.guard.ts');
const booking = read('online-booking/booking.js');
const migration = read('server/prisma/migrations/20260919131500_remove_booking_account_consents/migration.sql');
const policy = read('server/src/document-state/consent-policy.service.ts');

const bookingAccountStart = schema.indexOf('model BookingAccount');
const bookingRequestStart = schema.indexOf('model BookingRequest');
const bookingAccountModel = schema.slice(bookingAccountStart, bookingRequestStart);

assert.doesNotMatch(bookingAccountModel, /\bconsents\s+Json\b/);
assert.match(migration, /ALTER TABLE "BookingAccount" DROP COLUMN "consents"/);

assert.doesNotMatch(service, /consents:\s*arrayValue\(account\.consents\)/);
assert.doesNotMatch(service, /consents:\s*consents as Prisma\.InputJsonValue/);
assert.match(service, /registerAccount[\s\S]*normalizeConsents\(body\.consents\)/);
assert.match(service, /registerAccount[\s\S]*acceptAccountConsents\(tenantId, account\.id, consents/);

assert.doesNotMatch(guard, /bookingAccount\.updateMany/);
assert.doesNotMatch(guard, /derivedConsents/);
assert.match(guard, /hasActivePdnConsent\(auth\.tenantId, auth\.accountId\)/);

assert.doesNotMatch(booking, /account\.consents/);
assert.doesNotMatch(booking, /updateBookingAccount\(state\.tenantId, \{ consents \}\)/);
assert.match(booking, /refreshAccountConsentState\(state\)/);
assert.match(booking, /submitBookingConsents\(state\.tenantId, consents\)/);

const migrationFn = policy.slice(
  policy.indexOf('async ensureCanonicalConsentEvents'),
  policy.indexOf('private async state'),
);
assert.doesNotMatch(migrationFn, /account\.consents/);
assert.match(migrationFn, /select:\s*\{ id: true, phone: true, email: true \}/);

console.log('BookingAccount consent copy cleanup tests: OK');
