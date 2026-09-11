import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const recordFlow = readFileSync(new URL('../journal/record.js', import.meta.url), 'utf8');
const recordView = readFileSync(new URL('../journal/record-view.js', import.meta.url), 'utf8');
const journalDay = readFileSync(new URL('../journal/день.js', import.meta.url), 'utf8');
const timeline = readFileSync(new URL('../ui/time/journal-day.js', import.meta.url), 'utf8');

assert.match(recordFlow, /checkTimeAvailability/);
assert.match(recordFlow, /listAvailableStartTimes/);
assert.match(recordFlow, /listAvailableEndTimes/);
assert.doesNotMatch(recordFlow, /isTimeRangeAvailable|getTimeUsages|getJournalBreaks|getRecords\(|getDayTime|getDay\(/);

assert.match(recordView, /listAvailableStartTimes/);
assert.match(recordView, /timeSlots\(\{\s*values,\s*selected:/);
assert.match(recordView, /workingDatesForWorkplace/);
assert.match(recordView, /startWorkplaceEdit/);
assert.match(recordView, /startRecordDateEdit/);
assert.match(recordView, /chooseTimeForDraft\(datedDraft/);
assert.doesNotMatch(recordView, /timeSlots\(\{[^}]*\boccupied\b/);
assert.doesNotMatch(recordView, /openWorkplacePicker\(state,\s*\(workplaceId\)\s*=>\s*applyPatch/);
assert.doesNotMatch(recordView, /openDatePicker\(state,\s*\(date\)\s*=>\s*applyPatch/);

assert.match(journalDay, /getTimeUsagesForScope/);
assert.match(journalDay, /getTimeAvailabilityAt/);
assert.doesNotMatch(journalDay, /getRecordsForDay|getJournalBreaks|getTimeUsages\(|rangesOverlap/);

assert.match(timeline, /onUsageClick/);
assert.doesNotMatch(timeline, /initJournalDayTimeline\([^)]*usages/);
assert.doesNotMatch(timeline, /const usage = .*\.find/);

console.log('time UI ownership tests: OK');
