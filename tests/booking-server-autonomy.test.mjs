import assert from 'node:assert/strict';
import fs from 'node:fs';

const service = fs.readFileSync('server/src/online-booking/online-booking.service.ts', 'utf8');
const business = fs.readFileSync('server/src/business-state/business-state.service.ts', 'utf8');
const documentState = fs.readFileSync('server/src/document-state/document-state.service.ts', 'utf8');

const request = service.slice(service.indexOf('async createRequest('), service.indexOf('async getMyRequests('));
assert.match(request, /createOnlineBookingRecord/);
assert.match(request, /status: BookingRequestStatus\.IMPORTED/);
assert.match(request, /publicBookingOccupancy/);
assert.match(business, /source: 'online-booking'/);
assert.match(business, /type: 'created'/);
assert.match(documentState, /source: 'online-booking-account'/);
console.log('booking server autonomy tests passed');
