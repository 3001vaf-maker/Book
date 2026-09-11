import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const errors = [];
const fail = (path, message) => errors.push(`${path}: ${message}`);

const recordFlow = read('journal/record.js');
const recordView = read('journal/record-view.js');
const journalDay = read('journal/день.js');
const timeline = read('ui/time/journal-day.js');

if (!/from ['"]\.\.\/core\/availability\.js['"]/.test(recordFlow)) fail('journal/record.js', 'Record creation must ask Core Availability');
if (!/checkTimeAvailability/.test(recordFlow) || !/listAvailableStartTimes/.test(recordFlow) || !/listAvailableEndTimes/.test(recordFlow)) fail('journal/record.js', 'Record creation must use canonical Availability queries');
if (/isTimeRangeAvailable|getTimeUsages|getJournalBreaks|getRecords\(|getDayTime|getDay\(/.test(recordFlow)) fail('journal/record.js', 'Record creation must not rebuild occupancy or WorkPlan availability');

if (!/listAvailableStartTimes/.test(recordView)) fail('journal/record-view.js', 'Record editor must ask Core Availability for time choices');
if (!/timeSlots\(\{\s*values,\s*selected:/.test(recordView)) fail('journal/record-view.js', 'Record editor must pass canonical values to shared timeSlots');
if (/timeSlots\(\{[^}]*\boccupied\b/.test(recordView) || /timeSlots\(\{[^}]*\bfrom:\s*workingTime/.test(recordView)) fail('journal/record-view.js', 'Record editor must not use the removed local timeSlots availability contract');
if (!/function workingDatesForWorkplace/.test(recordView) || !/workingDates,/.test(recordView)) fail('journal/record-view.js', 'Record date picker must be constrained by the selected workplace WorkPlan');
if (!/const startWorkplaceEdit/.test(recordView) || !/startDateEdit\(workplaceDraft/.test(recordView)) fail('journal/record-view.js', 'Workplace edit must require Date then Time');
if (!/const startRecordDateEdit/.test(recordView) || !/startDateEdit\(\{ \.\.\.state \}/.test(recordView)) fail('journal/record-view.js', 'Date edit must require Time before applying');
if (!/chooseTimeForDraft\(datedDraft/.test(recordView)) fail('journal/record-view.js', 'Date selection must chain into time selection');
if (/openWorkplacePicker\(state,\s*\(workplaceId\)\s*=>\s*applyPatch/.test(recordView)) fail('journal/record-view.js', 'Workplace selection must not apply a partial scheduling tuple');
if (/openDatePicker\(state,\s*\(date\)\s*=>\s*applyPatch/.test(recordView)) fail('journal/record-view.js', 'Date selection must not apply stale time');

if (!/getTimeUsagesForScope/.test(journalDay) || !/getTimeAvailabilityAt/.test(journalDay)) fail('journal/день.js', 'Journal Day must consume Core occupancy and minute state');
if (/getRecordsForDay|getJournalBreaks|getTimeUsages\(|rangesOverlap/.test(journalDay)) fail('journal/день.js', 'Journal Day must not assemble or calculate time ownership locally');

if (!/onUsageClick/.test(timeline)) fail('ui/time/journal-day.js', 'Timeline UI must emit generic usage clicks');
if (/initJournalDayTimeline\([^)]*usages/.test(timeline) || /const usage = .*\.find/.test(timeline)) fail('ui/time/journal-day.js', 'Timeline UI must not decide which business usage owns a clicked minute');
if (!/onSlotClick\(\{[\s\S]*?from:[\s\S]*?to:/.test(timeline)) fail('ui/time/journal-day.js', 'Timeline UI must emit coordinates only for empty-grid clicks');

if (errors.length) {
  console.error('time UI ownership check: FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('time UI ownership check: OK');
