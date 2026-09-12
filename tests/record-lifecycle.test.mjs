import assert from 'node:assert/strict';
import { hydrateDaysFromServer } from '../core/day/index.js';
import { configureTimeUsageSource } from '../core/time/index.js';
import {
  getRecordEvents,
  RECORD_EVENT_TYPES,
  getRecord,
  hydrateRecordStateFromServer,
  cancelRecord,
  createRecord,
  moveRecord,
  setRecordAttendance,
  setRecordConfirmed,
} from '../core/record/index.js';
import { getJournalTimeUsages } from '../journal/time-usage-source.js';

globalThis.window = { dispatchEvent() {} };
globalThis.CustomEvent = class CustomEvent { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } };

hydrateDaysFromServer([
  { date: '2026-09-20', workplaceId: 'studio', from: '09:00', to: '18:00' },
  { date: '2026-09-21', workplaceId: 'studio', from: '09:00', to: '18:00' },
]);
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

console.log('record lifecycle tests: OK');
