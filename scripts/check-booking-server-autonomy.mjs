import fs from 'node:fs';

function text(path) { return fs.readFileSync(path, 'utf8'); }
function assert(condition, message) { if (!condition) throw new Error(message); }

const core = text('core.js');
const service = text('server/src/online-booking/online-booking.service.ts');
const business = text('server/src/business-state/business-state.service.ts');
const sync = text('online-booking/server-sync.js');

assert(!core.includes('owner-bridge'), 'core.js must not start the legacy owner booking bridge');
assert(core.includes('startServerBookingSync'), 'Book must use server-owned live refresh');
const contextBlock = service.slice(service.indexOf('async getContext('), service.indexOf('async prepareAccount('));
assert(!contextBlock.includes('this.publication('), 'public booking context must not depend on BookingPublication');
const requestBlock = service.slice(service.indexOf('async createRequest('), service.indexOf('async getMyRequests('));
assert(requestBlock.includes('createOnlineBookingRecord'), 'online booking must create canonical Record on the server');
assert(requestBlock.includes('BookingRequestStatus.IMPORTED'), 'server-created booking request must be finalized without browser import');
assert(service.includes('recordAcceptedConsents'), 'online consent facts must be written to canonical Documents state');
assert(business.includes('publicBookingOccupancy'), 'availability must consume canonical server Records');
assert(business.includes('upsertBookingPersonFromAccount'), 'online Account must create/update canonical Person on the server');
assert(!sync.includes('/online-booking/owner/publication'), 'browser sync must not publish booking context');
assert(!sync.includes('/online-booking/owner/requests'), 'browser sync must not import booking requests');
console.log('booking server autonomy check: OK');
