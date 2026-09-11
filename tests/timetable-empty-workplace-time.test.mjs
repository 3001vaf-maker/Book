import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveWorkplaceTime } from '../core/workplace-time.js';

assert.deepEqual(resolveWorkplaceTime([
  { key: 'salon-a', from: '12:00', to: '18:00' },
], 'salon-a'), { from: '12:00', to: '18:00' });

assert.equal(resolveWorkplaceTime([
  { key: 'salon-b', from: '', to: '' },
], 'salon-b'), null);

assert.equal(resolveWorkplaceTime([
  { key: 'salon-c', from: '00:00', to: '00:00' },
], 'salon-c'), null);

assert.equal(resolveWorkplaceTime([
  { key: 'salon-d', from: '18:00', to: '12:00' },
], 'salon-d'), null);

const source = readFileSync(new URL('../timetable/timetable.js', import.meta.url), 'utf8');
assert.match(source, /from ['"]\.\.\/core\/time\/index\.js['"]/);
assert.match(source, /if \(!base\) \{\s*openWorkingTimePicker\(dates\);\s*return;/s);
assert.match(source, /timePicker\(\{ name: 'timetableWorkingFrom'/);
assert.match(source, /timePicker\(\{ name: 'timetableWorkingTo'/);
assert.match(source, /if \(!isValidRange\(from, to\)\)/);
assert.match(source, /applyWorkingDays\(dates, \{ from, to \}\)/);
assert.match(source, /Постоянное расписание рабочего места не изменится/);
assert.doesNotMatch(source, /workplace\.(?:from|to)\s*=/);

console.log('timetable empty workplace time tests: OK');
