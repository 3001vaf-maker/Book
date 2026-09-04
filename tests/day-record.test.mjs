import assert from 'node:assert/strict';
import { createDay, hasScheduleConflict } from '../core/day.js';
import { createRecord, moveRecord, cancelRecord, deleteRecord, getRecords } from '../journal/record-data.js';

const store = new Map();
globalThis.localStorage = {
  getItem: (key) => store.has(key) ? store.get(key) : null,
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
};
globalThis.window = { dispatchEvent() {} };

const days = [createDay({ date: '2026-09-15', workplaceId: 'romashka', from: '12:00', to: '16:00' })];
store.set('book:timetable-state', JSON.stringify({ workingDays: days }));

assert.equal(hasScheduleConflict(days, { workplaceId: 'charodeyka', date: '2026-09-15', from: '16:00', to: '20:00' }), false);
assert.equal(hasScheduleConflict(days, { workplaceId: 'charodeyka', date: '2026-09-15', from: '15:00', to: '18:00' }), true);

const record = createRecord({ date: '2026-09-15', workplaceId: 'romashka', from: '12:00', to: '13:00', client: { name: 'Тест' } });
assert.ok(record);
assert.equal(createRecord({ date: '2026-09-15', workplaceId: 'romashka', from: '12:30', to: '13:30' }), null);
assert.equal(createRecord({ date: '2026-09-15', workplaceId: 'romashka', from: '15:55', to: '16:05' }), null);

const moved = moveRecord(record.id, { date: '2026-09-15', workplaceId: 'romashka', from: '13:00', to: '14:00' });
assert.equal(moved.from, '13:00');
assert.equal(moved.to, '14:00');

assert.ok(cancelRecord(record.id));
assert.equal(createRecord({ date: '2026-09-15', workplaceId: 'romashka', from: '13:00', to: '14:00' })?.id !== undefined, true);
const active = getRecords().filter((item) => item.status !== 'cancelled');
assert.equal(active.length, 1);
assert.equal(deleteRecord(active[0].id), true);
assert.equal(getRecords().filter((item) => item.status !== 'cancelled').length, 0);

console.log('day-record tests: OK');
