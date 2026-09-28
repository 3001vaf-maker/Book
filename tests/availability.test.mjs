import assert from 'node:assert/strict';
import { hydrateDaysFromServer } from '../core/day/index.js';
import { configureWorkplaceSource } from '../core/workplace-time.js';
import { configureTimeUsageSource } from '../core/time/index.js';
import { checkTimeAvailability, getTimeAvailabilityAt, listAvailableStartTimes } from '../core/time/index.js';

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

const exactMinuteStarts = listAvailableStartTimes({
  date: '2026-09-16',
  workplaceId: 'studio',
  duration: 1,
  step: 1,
  from: '12:17',
  to: '12:30',
});
assert.equal(exactMinuteStarts.length, 0, 'occupied minutes must still be excluded even at minute resolution');

const freeExactMinuteStarts = listAvailableStartTimes({
  date: '2026-09-16',
  workplaceId: 'studio',
  duration: 1,
  step: 1,
  from: '13:17',
  to: '13:30',
});
assert.equal(freeExactMinuteStarts[0], '13:17', 'a free exact minute must remain selectable and must not be rounded to a display slot');

console.log('availability tests: OK');
