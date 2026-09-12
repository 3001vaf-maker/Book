import assert from 'node:assert/strict';
import { createDay } from '../core/day/index.js';
import { configureTimeUsageSource } from '../core/time/index.js';
import {
  getRecordEvents,
  RECORD_EVENT_TYPES,
  getRecord,
  hydrateRecordStateFromServer,
  readLegacyRecordSnapshot,
  cancelRecord,
  createRecord,
  moveRecord,
  setRecordAttendance,
  setRecordConfirmed,
} from '../core/record/index.js';
import { getJournalTimeUsages } from '../journal/time-usage-source.js';

const store = new Map();
globalThis.localStorage = {
  getItem: (key) => store.has(key) ? store.get(key) : null,
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
};
globalThis.window = { dispatchEvent() {} };

store.set('book:timetable-state', JSON.stringify({
  workingDays: [
    createDay({ date: '2026-09-20', workplaceId: 'studio', from: '09:00', to: '18:00' }),
    createDay({ date: '2026-09-21', workplaceId: 'studio', from: '09:00', to: '18:00' }),
  ],
}));

// Legacy rows remain readable for migration, but runtime writes must not go back to browser storage.
store.set('book.records', JSON.stringify([
  {
    id: 'legacy-record',
    status: 'cancelled',
    confirmed: true,
    attendance: 'no-show',
    cancelledAt: '2026-09-19T12:00:00.000Z',
    date: '2026-09-20',
    workplaceId: 'studio',
    from: '15:00',
    to: '16:00',
    procedures: [],
    products: [],
    createdAt: '2026-09-18T12:00:00.000Z',
    updatedAt: '2026-09-19T12:00:00.000Z',
  },
]));
const legacy = getRecord('legacy-record');
assert.equal(legacy.status, 'cancelled');
assert.equal(legacy.confirmed, true);
assert.equal(legacy.attendance, 'no-show');
assert.equal(getRecordEvents('legacy-record').length, 0);
assert.equal(readLegacyRecordSnapshot().records[0]?.id, 'legacy-record');

hydrateRecordStateFromServer({ records: [], recordEvents: [] });
configureTimeUsageSource(getJournalTimeUsages);

const record = createRecord({
  date: '2026-09-20',
  workplaceId: 'studio',
  from: '10:00',
  to: '11:00',
  client: { name: 'Тест' },
});
assert.ok(record);
assert.equal(getRecordEvents(record.id)[0]?.type, RECORD_EVENT_TYPES.CREATED);
assert.equal(getRecord(record.id)?.status, 'active');
assert.equal(getRecord(record.id)?.confirmed, false);
assert.equal(getRecord(record.id)?.attendance, '');
assert.equal(readLegacyRecordSnapshot().records.some((item) => item?.id === record.id), false);

const confirmed = setRecordConfirmed(record.id, true);
assert.equal(confirmed.confirmed, true);
assert.equal(getRecordEvents(record.id).at(-1)?.type, RECORD_EVENT_TYPES.CONFIRMED);

const unconfirmed = setRecordConfirmed(record.id, false);
assert.equal(unconfirmed.confirmed, false);
assert.equal(getRecordEvents(record.id).at(-1)?.type, RECORD_EVENT_TYPES.UNCONFIRMED);

const noShow = setRecordAttendance(record.id, 'no-show');
assert.equal(noShow.attendance, 'no-show');
assert.equal(getRecordEvents(record.id).at(-1)?.type, RECORD_EVENT_TYPES.NO_SHOW);

const moved = moveRecord(record.id, {
  date: '2026-09-21',
  workplaceId: 'studio',
  from: '12:00',
  to: '13:00',
});
assert.ok(moved);
assert.equal(moved.attendance, 'no-show');

const cleared = setRecordAttendance(record.id, '');
assert.equal(cleared.attendance, '');
assert.equal(getRecordEvents(record.id).at(-1)?.type, RECORD_EVENT_TYPES.ATTENDANCE_CLEARED);

const arrived = setRecordAttendance(record.id, 'arrived');
assert.equal(arrived.attendance, 'arrived');
assert.equal(getRecordEvents(record.id).at(-1)?.type, RECORD_EVENT_TYPES.ARRIVED);

const cancelled = cancelRecord(record.id);
assert.equal(cancelled.status, 'cancelled');
assert.equal(getRecordEvents(record.id).at(-1)?.type, RECORD_EVENT_TYPES.CANCELLED);
assert.equal(getJournalTimeUsages({ date: '2026-09-21', workplaceId: 'studio' }).some((usage) => usage.sourceId === record.id), false);
assert.equal(readLegacyRecordSnapshot().records.some((item) => item?.id === record.id), false);

console.log('record lifecycle tests: OK');
