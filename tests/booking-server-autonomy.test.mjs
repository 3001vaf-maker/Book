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
assert.match(service, /payment:\s*\{\s*state:\s*total <= 0\.009 \? 'paid' : 'unpaid', paid: 0, due: total \}/s, 'Zero-due booking starts settled without a money operation');
assert.match(business, /payment:\s*\{\s*state:\s*due <= 0\.009 \? 'paid' : paid > 0 \? 'partial' : 'unpaid', paid, due \}/s, 'Live zero-due snapshot remains settled');
console.log('booking server autonomy tests passed');
