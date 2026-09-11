import assert from 'node:assert/strict';
import { createDay, getDays, getScheduleConflicts, hasScheduleConflict, removeDay, saveDays } from '../core/day.js';
import { configureTimeUsageSource, configureSoftTimeUsageReleaseSource, getWorkingTimeUsageConflicts } from '../core/time-usage.js';
import { createRecord, moveRecord, cancelRecord, deleteRecord } from '../journal/record-service.js';
import { getRecords } from '../journal/record-read.js';
import { createJournalBreak, moveJournalBreak } from '../journal/break-service.js';
import { getJournalBreaks, getJournalBreaksForDay } from '../journal/break-read.js';
import { getJournalTimeUsages, releaseJournalSoftTimeUsages } from '../journal/time-usage-source.js';

const store = new Map();
globalThis.localStorage = {
  getItem: (key) => store.has(key) ? store.get(key) : null,
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
};
globalThis.window = { dispatchEvent() {} };

configureTimeUsageSource(getJournalTimeUsages);
configureSoftTimeUsageReleaseSource(releaseJournalSoftTimeUsages);

const days = [createDay({ date: '2026-09-15', workplaceId: 'romashka', from: '12:00', to: '16:00' })];
store.set('book:timetable-state', JSON.stringify({ workingDays: days }));

assert.equal(hasScheduleConflict(days, { workplaceId: 'charodeyka', date: '2026-09-15', from: '16:00', to: '20:00' }), false);
assert.equal(hasScheduleConflict(days, { workplaceId: 'charodeyka', date: '2026-09-15', from: '15:00', to: '18:00' }), true);
const conflicts = getScheduleConflicts(days, { workplaceId: 'charodeyka', date: '2026-09-15', from: '15:00', to: '18:00' });
assert.equal(conflicts.length, 1);
assert.equal(conflicts[0].workplaceId, 'romashka');
assert.equal(conflicts[0].from, '12:00');
assert.equal(conflicts[0].to, '16:00');

const record = createRecord({ date: '2026-09-15', workplaceId: 'romashka', from: '12:00', to: '13:00', client: { name: 'Тест' } });
assert.ok(record);
assert.equal(createRecord({ date: '2026-09-15', workplaceId: 'romashka', from: '12:30', to: '13:30' }), null);
assert.equal(createRecord({ date: '2026-09-15', workplaceId: 'romashka', from: '15:55', to: '16:05' }), null);
assert.equal(createJournalBreak({ workplaceId: 'romashka', date: '2026-09-15', from: '12:30', to: '13:30' }), null);

const moved = moveRecord(record.id, { date: '2026-09-15', workplaceId: 'romashka', from: '13:00', to: '14:00' });
assert.equal(moved.from, '13:00');
assert.equal(moved.to, '14:00');

const breakItem = createJournalBreak({ workplaceId: 'romashka', date: '2026-09-15', from: '14:30', to: '15:00' });
assert.ok(breakItem);
const movedBreak = moveJournalBreak(breakItem.id, { from: '14:45', to: '15:15' });
assert.equal(movedBreak?.from, '14:45');
assert.equal(movedBreak?.to, '15:15');
const restoredBreak = moveJournalBreak(breakItem.id, { from: '14:30', to: '15:00' });
assert.equal(restoredBreak?.from, '14:30');
assert.equal(restoredBreak?.to, '15:00');

const shrinkConflicts = getWorkingTimeUsageConflicts({ date: '2026-09-15', workplaceId: 'romashka', from: '12:00', to: '14:00' });
assert.equal(shrinkConflicts.some((item) => item.type === 'break' && item.rigidity === 'soft' && item.from === '14:30' && item.to === '15:00'), true);
assert.equal(shrinkConflicts.some((item) => item.type === 'record'), false);

const removalConflictsWithRecord = getWorkingTimeUsageConflicts({ operation: 'remove', date: '2026-09-15', workplaceId: 'romashka' });
assert.equal(removalConflictsWithRecord.length, 1);
assert.equal(removalConflictsWithRecord[0].type, 'record');
assert.equal(removalConflictsWithRecord[0].rigidity, 'hard');

const guardedDays = getDays();
assert.equal(removeDay(guardedDays, 'romashka', '2026-09-15'), false);
assert.equal(guardedDays.length, 1);

const bypassedDays = getDays();
bypassedDays.splice(0, 1);
const blockedSave = saveDays(bypassedDays);
assert.equal(blockedSave.ok, false);
assert.equal(blockedSave.reason, 'usage-conflict');
assert.equal(bypassedDays.length, 1);
assert.equal(getDays().length, 1);

assert.ok(cancelRecord(record.id));
assert.equal(createRecord({ date: '2026-09-15', workplaceId: 'romashka', from: '13:00', to: '14:00' })?.id !== undefined, true);
const active = getRecords().filter((item) => item.status !== 'cancelled');
assert.equal(active.length, 1);
assert.equal(deleteRecord(active[0].id), true);
assert.equal(getRecords().filter((item) => item.status !== 'cancelled').length, 0);

const removalConflictsWithBreakOnly = getWorkingTimeUsageConflicts({ operation: 'remove', date: '2026-09-15', workplaceId: 'romashka' });
assert.equal(removalConflictsWithBreakOnly.length, 0);
assert.equal(getJournalBreaksForDay(getJournalBreaks(), 'romashka', '2026-09-15').length, 1);

const removableDays = getDays();
assert.equal(removeDay(removableDays, 'romashka', '2026-09-15'), true);
assert.equal(saveDays(removableDays).ok, true);
assert.equal(getDays().length, 0);
assert.equal(getJournalBreaksForDay(getJournalBreaks(), 'romashka', '2026-09-15').length, 0);

console.log('day-record tests: OK');
