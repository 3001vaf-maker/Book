import fs from 'node:fs';

function text(path) { return fs.readFileSync(path, 'utf8'); }
function assert(condition, message) { if (!condition) throw new Error(message); }

const core = text('core.js');
const service = text('server/src/online-booking/online-booking.service.ts');
const controller = text('server/src/online-booking/online-booking.controller.ts');
const telegramAuth = text('server/src/online-booking/telegram-booking-auth.service.ts');
const business = text('server/src/business-state/business-state.service.ts');
const consentPolicy = text('server/src/document-state/consent-policy.service.ts');
const sync = text('online-booking/server-sync.js');

assert(!core.includes('owner-bridge'), 'core.js must not start the legacy owner booking bridge');
assert(core.includes('startServerBookingSync'), 'Book must use server-owned live refresh');
const contextBlock = service.slice(service.indexOf('async getContext('), service.indexOf('async prepareAccount('));
assert(!contextBlock.includes('this.publication('), 'public booking context must not depend on BookingPublication');
const requestBlock = service.slice(service.indexOf('async createRequest('), service.indexOf('async getMyRequests('));
assert(requestBlock.includes('createOnlineBookingRecord'), 'online booking must create canonical Record on the server');
assert(requestBlock.includes('BookingRequestStatus.IMPORTED'), 'server-created booking request must be finalized without browser import');
assert(service.includes('acceptAccountConsents'), 'online account legal consent facts must be written to canonical Documents events');
assert(!service.includes('messages-consent') && !telegramAuth.includes('messages-consent'), 'new client registration must not create retired messages-consent facts');
assert(!service.includes('acceptContactPointConsent') && !telegramAuth.includes('acceptContactPointConsent'), 'client registration must not create transport consent as a side effect');
assert(controller.includes('CommunicationHistoryService') && controller.includes('preferredChannels') && controller.includes("'TELEGRAM'"), 'Telegram channel enablement must be a technical communication preference');
assert(consentPolicy.includes('INSERT INTO "ConsentEvent"'), 'Documents must own append-only consent events');
assert(business.includes('publicBookingOccupancy'), 'availability must consume canonical server Records');
assert(business.includes('upsertBookingPersonFromAccount'), 'online Account must create/update canonical Person on the server');
assert(!sync.includes('/online-booking/owner/publication'), 'browser sync must not publish booking context');
assert(!sync.includes('/online-booking/owner/requests'), 'browser sync must not import booking requests');
console.log('booking server autonomy check: OK');
