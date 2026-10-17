import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const recordFlow = readFileSync(new URL('../core/records/records.js', import.meta.url), 'utf8');
const journalView = readFileSync(new URL('../journal/journal-view.js', import.meta.url), 'utf8');
const breakView = readFileSync(new URL('../journal/break-view.js', import.meta.url), 'utf8');
const journalDay = readFileSync(new URL('../journal/день.js', import.meta.url), 'utf8');
const timeline = readFileSync(new URL('../ui/time/journal-day.js', import.meta.url), 'utf8');
const timeUsage = readFileSync(new URL('../core/time/usage.js', import.meta.url), 'utf8');
const dayEditor = readFileSync(new URL('../timetable/day-editor.js', import.meta.url), 'utf8');

assert.match(recordFlow, /checkTimeAvailability/);
assert.match(recordFlow, /getTimeAvailabilityAt/);
assert.match(recordFlow, /listAvailableEndTimes/);
assert.match(recordFlow, /buildNaturalBookingTimeRows/);
assert.match(recordFlow, /recordCreationTimeRows\(rows/);
assert.match(recordFlow, /getWorkplaceWorkingDates/);
assert.doesNotMatch(recordFlow, /isTimeRangeAvailable|getTimeUsages|getJournalBreaks|getRecords\(|getDayTime|getDay\(/);
assert.doesNotMatch(recordFlow, /from ['"]\.\.\/day\.js['"]/);

// Journal View is display-only for now and must not own a second Record time/edit flow.
assert.doesNotMatch(journalView, /openRecordEditFlow|openTimePickerAction|checkTimeAvailability|listAvailableStartTimes|listAvailableEndTimes|getBookingSettings/);
assert.doesNotMatch(journalView, /from ['"]\.\.\/core\/day\.js['"]/);

assert.match(breakView, /listAvailableStartTimes/);
assert.match(breakView, /listAvailableEndTimes/);
assert.doesNotMatch(breakView, /isTimeRangeAvailable|getTimeUsages|getRecordsForDay|getJournalBreaks/);

assert.match(journalDay, /getTimeUsagesForScope/);
assert.match(journalDay, /getTimeAvailabilityAt/);
assert.doesNotMatch(journalDay, /getRecordsForDay|getJournalBreaks|getTimeUsages\(|rangesOverlap/);

assert.match(timeline, /onUsageClick/);
assert.doesNotMatch(timeline, /initJournalDayTimeline\([^)]*usages/);
assert.doesNotMatch(timeline, /const usage = .*\.find/);

assert.doesNotMatch(timeUsage, /export function isTimeRangeAvailable|export function getTimeUsages\b|export function getUsageAtTime\b/);
assert.match(dayEditor, /getDayDraftScheduleConflicts/);
assert.doesNotMatch(dayEditor, /rangesOverlap/);

console.log('time UI ownership tests: OK');
