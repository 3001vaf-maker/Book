import assert from 'node:assert/strict';
import {
  isRecordCompletedSide,
  projectRecordStatuses,
  recordActivityTime,
  recordAppointmentTime,
  recordVisualState,
} from '../core/record/index.js';

const record = {
  id: 'record-1',
  status: 'active',
  attendance: '',
  date: '2026-09-10',
  from: '10:00',
  to: '11:00',
  createdAt: '2026-09-01T12:00:00.000Z',
  updatedAt: '2026-09-09T20:00:00.000Z',
};

assert.equal(recordVisualState(record), 'active');
assert.equal(recordVisualState({ ...record, attendance: 'no-show' }), 'no-show');
assert.equal(recordVisualState({ ...record, attendance: 'no-show' }, { paid: true }), 'paid');
assert.equal(recordVisualState({ ...record, status: 'cancelled', attendance: 'no-show' }, { paid: true }), 'cancelled');

const end = recordAppointmentTime(record, 'to');
assert.equal(isRecordCompletedSide(record, { now: end - 1 }), false);
assert.equal(isRecordCompletedSide(record, { now: end }), true);
assert.equal(recordActivityTime(record, null, { completed: true }), end);
assert.equal(recordActivityTime(record), Date.parse(record.updatedAt));

const noShow = { ...record, attendance: 'no-show', updatedAt: '2026-09-10T09:30:00.000Z' };
assert.equal(recordActivityTime(noShow, null, { completed: true }), Date.parse(noShow.updatedAt));

const cancelled = { ...record, status: 'cancelled', cancelledAt: '2026-09-10T09:40:00.000Z' };
assert.equal(recordActivityTime(cancelled, null, { completed: true }), Date.parse(cancelled.cancelledAt));

const payment = { paidAt: '2026-09-10T09:50:00.000Z' };
assert.equal(recordActivityTime(record, payment, { completed: true }), Date.parse(payment.paidAt));

const createdEvent = { type: 'created', at: '2026-09-01T12:00:00.000Z' };
const movedEvent = { type: 'rescheduled', at: '2026-09-05T12:00:00.000Z' };
const cancelledEvent = { type: 'cancelled', at: '2026-09-06T12:00:00.000Z' };

assert.deepEqual(
  projectRecordStatuses(record, [createdEvent], { due: 5000, paid: 0 }),
  { action: 'booked', visit: 'expected', payment: 'due' },
);
assert.deepEqual(
  projectRecordStatuses(record, [createdEvent, movedEvent], { due: 5000, paid: 0 }),
  { action: 'rescheduled', visit: 'expected', payment: 'due' },
);
assert.deepEqual(
  projectRecordStatuses({ ...record, attendance: 'arrived' }, [createdEvent], { due: 5000, paid: 0 }),
  { action: 'booked', visit: 'arrived', payment: 'debt' },
);
assert.deepEqual(
  projectRecordStatuses({ ...record, attendance: 'arrived' }, [createdEvent], { due: 0, paid: 5000 }),
  { action: 'booked', visit: 'arrived', payment: 'paid' },
);
assert.deepEqual(
  projectRecordStatuses({ ...record, attendance: 'no-show' }, [createdEvent], { due: 5000, paid: 0 }),
  { action: 'booked', visit: 'no-show', payment: '' },
);
assert.deepEqual(
  projectRecordStatuses(record, [createdEvent, { type: 'no-show', at: '2026-09-10T10:05:00.000Z' }], { due: 5000, paid: 0 }),
  { action: 'booked', visit: 'no-show', payment: '' },
);
assert.deepEqual(
  projectRecordStatuses(record, [createdEvent, cancelledEvent], { due: 5000, paid: 0 }),
  { action: 'cancelled', visit: '', payment: '' },
);

console.log('record state tests: OK');
