import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const bookingService = read('server/src/online-booking/online-booking.service.ts');
const pdnGuard = read('server/src/online-booking/booking-pdn-consent.guard.ts');
const bookingUi = read('online-booking/booking.js');
const peopleUi = read('main/people/people.js');
const consentCache = read('settings/documents/consents.js');
const documentMigration = read('tenant-document-archive.js');
const schema = read('server/prisma/schema.prisma');
const dropMigration = read('server/prisma/migrations/20260919132000_drop_booking_account_consents/migration.sql');

// BookingAccount consent JSON is no longer a runtime source or mirror.
assert.doesNotMatch(bookingService, /consents:\s*arrayValue\(account\.consents\)/);
assert.doesNotMatch(bookingService, /consents:\s*true/);
assert.doesNotMatch(pdnGuard, /derivedConsents/);
assert.doesNotMatch(pdnGuard, /bookingAccount\.updateMany/);
assert.doesNotMatch(pdnGuard, /PrismaService/);
assert.doesNotMatch(bookingUi, /account\.consents/);
assert.doesNotMatch(bookingUi, /state\.account\?\.consents/);
assert.doesNotMatch(bookingUi, /updateBookingAccount\(state\.tenantId, \{ consents \}\)/);

// Registration still writes canonical ConsentEvent facts.
assert.match(bookingService, /acceptAccountConsents\(tenantId, account\.id, consents, 'online-booking-registration'\)/);
assert.match(bookingService, /acceptContactPointConsent\(tenantId, 'PHONE'/);
assert.match(bookingService, /acceptContactPointConsent\(tenantId, 'EMAIL'/);

// The legacy DB column is physically removed; ConsentEvent is the only persisted consent store.
assert.doesNotMatch(schema, /consents\s+Json/);
assert.doesNotMatch(bookingService, /consents:\s*\[\]\s+as Prisma\.InputJsonValue/);
assert.match(dropMigration, /ALTER TABLE "BookingAccount" DROP COLUMN "consents"/);

// Profile-side Person consent markers must be projected from canonical server ConsentEvent data.
assert.match(documentMigration, /hydrateConsentsFromServer\(normalized\.consents\)/);
assert.match(consentCache, /export function getConsents\(\)/);
assert.match(peopleUi, /getConsents/);
assert.match(peopleUi, /fact\.subjectType==='BOOKING_ACCOUNT'/);
assert.match(peopleUi, /fact\.subjectType!=='CONTACT_POINT'/);
assert.doesNotMatch(peopleUi, /p\.agreements/);
assert.doesNotMatch(peopleUi, /account\.consents/);

console.log('BookingAccount consent snapshot cleanup tests: OK');
