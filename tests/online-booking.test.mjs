import assert from 'node:assert/strict';
import {
  bookingDuration,
  getBookingProcedures,
  getBookingSlots,
  getBookingWorkingDates,
  hasRequiredBookingConsents,
} from '../online-booking/model.js';

const context = {
  workplaces: [
    { key: 'moscow', name: 'Москва', from: '10:00', to: '18:00' },
    { key: 'spb', name: 'Питер', from: '10:00', to: '18:00' },
  ],
  procedures: [
    { id: 'cut', name: 'Стрижка', duration: 60, workplaces: [{ workplaceId: 'spb' }] },
    { id: 'color', name: 'Окрашивание', duration: 120, workplaces: [{ workplaceId: 'spb' }] },
    { id: 'other', name: 'Другая', duration: 30, workplaces: [{ workplaceId: 'moscow' }] },
  ],
  days: [
    { workplaceId: 'spb', date: '2026-09-20', from: '10:00', to: '18:00' },
    { workplaceId: 'spb', date: '2026-09-21', from: '12:00', to: '18:00' },
    { workplaceId: 'moscow', date: '2026-09-20', from: '09:00', to: '15:00' },
  ],
  occupancy: [
    { id: 'r1', workplaceId: 'spb', date: '2026-09-20', from: '12:00', to: '13:00' },
    { id: 'r2', workplaceId: 'moscow', date: '2026-09-20', from: '10:00', to: '11:00' },
  ],
  documents: [
    { id: 'pdn-consent', version: 2, clientConsent: true, required: true },
    { id: 'messages-consent', version: 1, clientConsent: true, required: false },
  ],
};

assert.deepEqual(getBookingProcedures(context, 'spb').map((item) => item.id), ['cut', 'color']);
assert.equal(bookingDuration(context, 'spb', ['cut', 'color']), 180);
assert.deepEqual(getBookingWorkingDates(context, 'spb', { fromDate: '2026-09-21' }), ['2026-09-21']);

const slots = getBookingSlots(context, {
  workplaceKey: 'spb',
  date: '2026-09-20',
  procedureIds: ['cut', 'color'],
  step: 15,
});
assert.equal(slots.some((slot) => slot.from === '10:00'), false, 'three-hour selection must not overlap the 12:00 booking');
assert.equal(slots.some((slot) => slot.from === '13:00' && slot.to === '16:00'), true);

assert.equal(hasRequiredBookingConsents(context, []), false);
assert.equal(hasRequiredBookingConsents(context, [{ documentId: 'pdn-consent', documentVersion: 1, accepted: true }]), false);
assert.equal(hasRequiredBookingConsents(context, [{ documentId: 'pdn-consent', documentVersion: 2, accepted: true }]), true);

console.log('online booking tests passed');
