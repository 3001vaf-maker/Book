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
assert.match(source, /getWorkingTimeUsageConflicts, isValidRange/);
assert.match(source, /if \(!base\) \{\s*openWorkingTimePicker\(dates\);\s*return;/s);
assert.match(source, /timePicker\(\{ name: 'timetableWorkingFrom'/);
assert.match(source, /timePicker\(\{ name: 'timetableWorkingTo'/);
assert.match(source, /if \(!isValidRange\(from, to\)\)/);
assert.match(source, /applyWorkingDays\(dates, \{ from, to \}\)/);
assert.match(source, /Постоянное расписание рабочего места не изменится/);
assert.doesNotMatch(source, /workplace\.(?:from|to)\s*=/);

assert.match(source, /function conflictParticipants\(entry, base\)/);
assert.match(source, /participant\.target \? 'Добавляем' : 'Уже в графике'/);
assert.match(source, /data-timetable-conflict-participant/);
assert.match(source, /timetableConflictFrom\$\{entryIndex\}_\$\{participantIndex\}/);
assert.match(source, /timetableConflictTo\$\{entryIndex\}_\$\{participantIndex\}/);
assert.match(source, /variant: 'list'/);
assert.match(source, /function draftScheduleConflicts\(date, participants\)/);
assert.match(source, /getWorkingTimeUsageConflicts\(\{/);
assert.match(source, /participants\.forEach\(\(participant\) => \{[\s\S]*?updateDayTime\(workingDays, participant\.workplaceId/s);
assert.match(source, /const remaining = \[\]/);
assert.match(source, /if \(applied\) \{\s*saveDays\(workingDays\);/s);
assert.match(source, /activeEntries = remaining;\s*renderRows\(\);/s);
assert.doesNotMatch(source, /if \(hasError\) return;/);

console.log('timetable empty workplace time tests: OK');
