import assert from 'node:assert/strict';
import fs from 'node:fs';

const service = fs.readFileSync('server/src/online-booking/online-booking.service.ts', 'utf8');
const controller = fs.readFileSync('server/src/online-booking/online-booking.controller.ts', 'utf8');
const bookingModule = fs.readFileSync('server/src/online-booking/online-booking.module.ts', 'utf8');
const publicationGuard = fs.readFileSync('server/src/online-booking/booking-publication.guard.ts', 'utf8');
const cleanReset = fs.readFileSync('server/prisma/migrations/20260916150000_clean_launch_reset/migration.sql', 'utf8');
const business = fs.readFileSync('server/src/business-state/business-state.service.ts', 'utf8');
const consentPolicy = fs.readFileSync('server/src/document-state/consent-policy.service.ts', 'utf8');

const request = service.slice(service.indexOf('async createRequest('), service.indexOf('async getMyRequests('));
assert.match(request, /createOnlineBookingRecord/);
assert.match(request, /status: BookingRequestStatus\.IMPORTED/);
assert.match(request, /publicBookingOccupancy/);
assert.match(business, /source: 'online-booking'/);
assert.match(business, /type: 'created'/);
assert.match(service, /acceptAccountConsents\(tenantId, account\.id, consents, 'online-booking-registration'\)/);
assert.match(consentPolicy, /CONTACT_POINT/);
assert.match(service, /payment:\s*\{\s*state:\s*total <= 0\.009 \? 'paid' : 'unpaid', paid: 0, due: total \}/s, 'Zero-due booking starts settled without a money operation');
assert.match(business, /payment:\s*\{\s*state:\s*due <= 0\.009 \? 'paid' : paid > 0 \? 'partial' : 'unpaid', paid, due \}/s, 'Live zero-due snapshot remains settled');

assert.match(publicationGuard, /bookingPublication\.findUnique/);
assert.match(publicationGuard, /Онлайн-запись ещё не опубликована/);
assert.match(bookingModule, /BookingPublicationGuard/);
assert.match(controller, /@UseGuards\(BookingPublicationGuard\)\s*@Get\(':tenantId\/context'\)/s);
assert.match(controller, /@UseGuards\(BookingPublicationGuard\)\s*@Post\(':tenantId\/account\/prepare'\)/s);
assert.match(controller, /@UseGuards\(BookingPublicationGuard\)\s*@Post\(':tenantId\/account\/register'\)/s);
assert.match(controller, /@UseGuards\(BookingPublicationGuard\)\s*@Post\(':tenantId\/account\/login'\)/s);
assert.match(controller, /@UseGuards\(BookingPublicationGuard, BookingAccountGuard, BookingRequiredConsentGuard\)\s*@Post\(':tenantId\/requests'\)/s);

assert.match(cleanReset, /DELETE FROM "MasterInvitation"/);
assert.match(cleanReset, /DELETE FROM "BookingPublication"/);
assert.match(cleanReset, /DELETE FROM "BookingAccount"/);
assert.match(cleanReset, /DELETE FROM "BookingRequest"/);
assert.match(cleanReset, /DELETE FROM "ConsentEvent"/);
assert.match(cleanReset, /DELETE FROM "CommunicationGroupMember"/);
assert.match(cleanReset, /DELETE FROM "WorkspaceState"/);
assert.match(cleanReset, /"isOwnerBook" = true/);
assert.match(cleanReset, /BOOK_CLEAN_RESET failed: BookingAccount/);
assert.match(cleanReset, /BOOK_CLEAN_RESET failed: pending external CommunicationMessage/);
assert.doesNotMatch(cleanReset, /DELETE FROM "Capability"/);
assert.doesNotMatch(cleanReset, /DELETE FROM "Plan"/);
assert.doesNotMatch(cleanReset, /DELETE FROM "PlanCapability"/);

console.log('booking server autonomy tests passed');
