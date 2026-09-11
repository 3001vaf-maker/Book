import assert from 'node:assert/strict';
import {
  createTimeGrid,
  getTimeGridMinuteState,
  getTimeGridRangeState,
  listTimeGridAvailableEnds,
  listTimeGridAvailableStarts,
} from '../core/time-grid.js';

const grid = createTimeGrid({
  date: '2026-09-15',
  workplaceId: 'studio',
  plan: { from: '12:00', to: '18:00' },
  usages: [
    { type: 'record', rigidity: 'hard', sourceId: 'record-1', from: '13:00', to: '14:00' },
    { type: 'break', rigidity: 'soft', sourceId: 'break-1', from: '15:00', to: '15:30' },
  ],
});

assert.equal(getTimeGridMinuteState(grid, '11:59').state, 'outside-plan');
assert.equal(getTimeGridMinuteState(grid, '12:37').state, 'free');
assert.equal(getTimeGridMinuteState(grid, '13:17').rigidity, 'hard');
assert.equal(getTimeGridMinuteState(grid, '13:17').usage.sourceId, 'record-1');
assert.equal(getTimeGridMinuteState(grid, '14:00').state, 'free');
assert.equal(getTimeGridMinuteState(grid, '15:12').rigidity, 'soft');
assert.equal(getTimeGridMinuteState(grid, '18:00').state, 'outside-plan');

assert.equal(getTimeGridRangeState(grid, { from: '12:00', to: '13:00' }).ok, true);
assert.equal(getTimeGridRangeState(grid, { from: '12:30', to: '13:30' }).reason, 'occupied');
assert.equal(getTimeGridRangeState(grid, { from: '14:45', to: '15:15' }).conflicts[0].rigidity, 'soft');
assert.equal(getTimeGridRangeState(grid, { from: '13:00', to: '14:00', excludeId: 'record-1' }).ok, true);
assert.equal(getTimeGridRangeState(grid, { from: '17:30', to: '18:30' }).reason, 'outside-working-time');

const starts = listTimeGridAvailableStarts(grid, { duration: 30, step: 15, from: '12:00', to: '16:00' });
assert.equal(starts.includes('12:30'), true);
assert.equal(starts.includes('13:00'), false);
assert.equal(starts.includes('14:30'), true);
assert.equal(starts.includes('15:00'), false);

const ends = listTimeGridAvailableEnds(grid, { from: '14:00', step: 15, to: '16:00' });
assert.deepEqual(ends, ['14:15', '14:30', '14:45', '15:00']);

console.log('time grid tests: OK');
