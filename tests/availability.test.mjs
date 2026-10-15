import assert from 'node:assert/strict';
import { hydrateDaysFromServer } from '../core/day/index.js';
import { configureWorkplaceSource } from '../core/workplace-time.js';
import { configureTimeUsageSource } from '../core/time/index.js';
import { checkTimeAvailability, createTimeGrid, getTimeAvailabilityAt, listAvailableStartTimes } from '../core/time/index.js';
import { buildPersonRecordTimeRows } from '../core/people/record-time.js';

globalThis.window = { dispatchEvent() {} };

configureWorkplaceSource(() => [{ key: 'studio', name: 'Studio', from: '09:00', to: '18:00' }]);
configureTimeUsageSource(({ date, workplaceId } = {}) => {
  if (date !== '2026-09-16' || workplaceId !== 'studio') return [];
  return [
    { type: 'record', rigidity: 'hard', sourceId: 'record-1', from: '10:00', to: '11:00' },
    { type: 'break', rigidity: 'soft', sourceId: 'break-1', from: '12:00', to: '12:30' },
  ];
});

hydrateDaysFromServer([
  { date: '2026-09-16', workplaceId: 'studio', from: '09:00', to: '15:00' },
]);

assert.equal(checkTimeAvailability({ date: '2026-09-16', workplaceId: 'studio', from: '09:00', to: '10:00' }).ok, true);
assert.equal(checkTimeAvailability({ date: '2026-09-16', workplaceId: 'studio', from: '10:30', to: '11:30' }).reason, 'occupied');
assert.equal(checkTimeAvailability({ date: '2026-09-16', workplaceId: 'studio', from: '14:30', to: '15:30' }).reason, 'outside-working-time');
assert.equal(checkTimeAvailability({ date: '2026-09-17', workplaceId: 'studio', from: '10:00', to: '11:00' }).reason, 'day-not-working');
assert.equal(checkTimeAvailability({ date: '2026-09-16', workplaceId: 'studio', from: '10:00', to: '11:00', excludeId: 'record-1' }).ok, true);

assert.equal(getTimeAvailabilityAt({ date: '2026-09-16', workplaceId: 'studio', time: '10:15' }).rigidity, 'hard');
assert.equal(getTimeAvailabilityAt({ date: '2026-09-16', workplaceId: 'studio', time: '12:15' }).rigidity, 'soft');
assert.equal(getTimeAvailabilityAt({ date: '2026-09-16', workplaceId: 'studio', time: '13:15' }).state, 'free');

const starts = listAvailableStartTimes({ date: '2026-09-16', workplaceId: 'studio', duration: 30, step: 15, from: '09:00', to: '13:00' });
assert.equal(starts.includes('09:30'), true);
assert.equal(starts.includes('10:00'), false);
assert.equal(starts.includes('11:00'), true);
assert.equal(starts.includes('12:00'), false);

const personGrid = createTimeGrid({
  date: '2026-10-16',
  workplaceId: 'studio',
  plan: { from: '11:00', to: '15:00' },
  usages: [
    { type: 'record', rigidity: 'hard', sourceId: 'record-12', from: '12:00', to: '13:00' },
  ],
});
const personRows = new Map(buildPersonRecordTimeRows(personGrid, 60).map((row) => [row.value, row]));
assert.equal(personRows.get('11:00')?.available, true, '11:00 must stay selectable when a one-hour procedure ends at 12:00');
assert.equal(personRows.get('11:05')?.occupied, true, 'duration overlap with the 12:00 record must be occupied');
assert.equal(personRows.get('11:05')?.disabled, true, 'duration overlap must be disabled');
assert.equal(personRows.get('12:00')?.occupied, true, '12:00 must stay visible as occupied');
assert.equal(personRows.get('12:00')?.disabled, true, 'occupied 12:00 must never be selectable');
assert.equal(personRows.get('13:00')?.available, true, '13:00 must be free after the existing record ends');

console.log('availability tests: OK');
