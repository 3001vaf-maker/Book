import assert from 'node:assert/strict';
import { isRecordCompletedSide, recordActivityTime, recordAppointmentTime, recordVisualState } from '../core/record/index.js';

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

console.log('record state tests: OK');
