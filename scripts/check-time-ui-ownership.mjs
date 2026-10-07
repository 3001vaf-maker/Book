import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const errors = [];
const fail = (path, message) => errors.push(`${path}: ${message}`);

const recordFlow = read('journal/record.js');
const recordView = read('journal/record-view.js');
const breakView = read('journal/break-view.js');
const breakData = read('journal/break-data.js');
const breakRead = read('journal/break-read.js');
const breakService = read('journal/break-service.js');
const journalDay = read('journal/день.js');
const timeline = read('ui/time/journal-day.js');
const timeUsage = read('core/time/usage.js');
const timeGrid = read('core/time/grid.js');
const availability = read('core/time/availability.js');
const dayEditor = read('timetable/day-editor.js');
const sharedTime = read('ui/time/index.js');
const sharedTimeCss = read('ui/time/time.css');

if (!/from ['"]\.\.\/core\/time\/index\.js['"]/.test(recordFlow)) fail('journal/record.js', 'Record creation must ask Core Availability');
if (!/checkTimeAvailability/.test(recordFlow) || !/listAvailableStartTimes/.test(recordFlow) || !/listAvailableEndTimes/.test(recordFlow)) fail('journal/record.js', 'Record creation must use canonical Availability queries');
if (!/getWorkplaceWorkingDates/.test(recordFlow)) fail('journal/record.js', 'Record creation must use the canonical WorkPlan date query');
if (/from ['"]\.\.\/core\/day\.js['"]|isTimeRangeAvailable|getTimeUsages|getJournalBreaks|getRecords\(|getDayTime|getDay\(/.test(recordFlow)) fail('journal/record.js', 'Record creation must not rebuild occupancy or WorkPlan availability');
if (/from ['"]\.\/break-data\.js['"]/.test(recordFlow)) fail('journal/record.js', 'Record creation must command Break through break-service.js');

if (!/openRecordEditFlow/.test(recordView)
  || !/startAt,\s*date:\s*state\.date,\s*workplaceId:\s*state\.workplaceId,\s*from:\s*state\.from,\s*to:\s*state\.to/s.test(recordView)) {
  fail('journal/record-view.js', 'Created Record editor must delegate schedule/procedure editing to the shared Record edit flow');
}
if (/openTimePickerAction|startWorkplaceEdit|startRecordDateEdit|startRecordTimeEdit|openWorkplacePicker|openDatePicker/.test(recordView)) {
  fail('journal/record-view.js', 'Created Record editor must not keep a second direct schedule-edit implementation');
}
if (!/export function openRecordEditFlow/.test(recordFlow)
  || !/if \(startAt === 'workplace'\) openWorkplace\(\);\s*else if \(startAt === 'date'\) openDate\(\);\s*else if \(startAt === 'procedure'\) openProcedures\(\);\s*else openTime\(\);/s.test(recordFlow)) {
  fail('journal/record.js', 'Shared Record edit flow must own Workplace, Date, Time and Procedure entry points');
}
if (!/draft\.workplaceId\s*=\s*String\([^;]+;[\s\S]*?apply\(\);/.test(recordFlow)
  || !/draft\.date\s*=\s*nextDate;\s*apply\(\);/s.test(recordFlow)
  || !/draft\.from\s*=\s*nextFrom;\s*draft\.to\s*=\s*nextTo;\s*apply\(\);/s.test(recordFlow)
  || !/onDone:\s*\(\{ procedures: next, to: nextTo \}\)\s*=>\s*\{[\s\S]*?draft\.procedures\s*=\s*next;[\s\S]*?draft\.to\s*=\s*nextTo;[\s\S]*?apply\(\);/s.test(recordFlow)) {
  fail('journal/record.js', 'Shared Record edit flow must apply only the selected Workplace, Date, Time or Procedure correction and return without replaying the booking sequence');
}
if (!/listAvailableStartTimes/.test(recordFlow) || !/excludeId/.test(recordFlow)) {
  fail('journal/record.js', 'Shared Record edit flow must ask canonical Availability and exclude the edited Record');
}

if (!/from ['"]\.\.\/core\/time\/index\.js['"]/.test(breakView)) fail('journal/break-view.js', 'Break view must ask Core Availability');
if (!/listAvailableStartTimes/.test(breakView) || !/listAvailableEndTimes/.test(breakView)) fail('journal/break-view.js', 'Break view must use canonical Availability choices');
if (/from ['"]\.\.\/core\/(?:day|time)\/(?!index\.js)[^'"]+['"]|from ['"]\.\/break-data\.js['"]|getRecordsForDay|getJournalBreaks|isTimeRangeAvailable|getTimeUsages/.test(breakView)) fail('journal/break-view.js', 'Break view must not calculate occupancy or use persistence directly');

if (/^import /m.test(breakData) || /notifyTimeUsageChanged|checkTimeAvailability|isValidRange|normalizeTime/.test(breakData)) fail('journal/break-data.js', 'Break data must remain persistence-only');
if (!/from ['"]\.\/break-data\.js['"]/.test(breakRead) || /checkTimeAvailability|notifyTimeUsageChanged/.test(breakRead)) fail('journal/break-read.js', 'Break read model must only compose persisted facts');
if (!/from ['"]\.\.\/core\/time\/index\.js['"]/.test(breakService) || !/from ['"]\.\/break-data\.js['"]/.test(breakService)) fail('journal/break-service.js', 'Break service must own commands and validate through Availability');

if (!/getTimeUsagesForScope/.test(journalDay) || !/getTimeAvailabilityAt/.test(journalDay)) fail('journal/день.js', 'Journal Day must consume Core occupancy and minute state');
if (/getRecordsForDay|getJournalBreaks|getTimeUsages\(|rangesOverlap|time-grid/.test(journalDay)) fail('journal/день.js', 'Journal Day must not assemble or calculate time ownership locally');

if (!/onUsageClick/.test(timeline)) fail('ui/time/journal-day.js', 'Timeline UI must emit generic usage clicks');
if (/^import[^\n]*['"][^'"]*(?:availability|time-grid|time-usage|record-read|break-read|\/journal\/)[^'"]*['"]/m.test(timeline)) fail('ui/time/journal-day.js', 'Timeline UI must remain presentation-only');
if (/initJournalDayTimeline\([^)]*usages/.test(timeline) || /const usage = .*\.find/.test(timeline)) fail('ui/time/journal-day.js', 'Timeline UI must not decide which business usage owns a clicked minute');
if (!/onSlotClick\(\{[\s\S]*?from:[\s\S]*?to:/.test(timeline)) fail('ui/time/journal-day.js', 'Timeline UI must emit coordinates only');

if (/isTimeRangeAvailable|export function getTimeUsages\b|export function getUsageAtTime\b/.test(timeUsage)) fail('core/time-usage.js', 'Time Usage must not expose a second Availability implementation');
if (/journal\/|timetable\/|settings\/|ui\//.test(timeUsage)) fail('core/time-usage.js', 'Time Usage must remain neutral');

if (/journal\/|timetable\/|settings\/|ui\/|availability\.js|time-usage\.js|day\.js|workplace-time\.js/.test(timeGrid)) fail('core/time-grid.js', 'TimeGrid must remain neutral and depend only on technical time helpers');
if (!/createTimeGrid/.test(availability) || !/getTimeUsagesForScope/.test(availability) || !/getDayTime/.test(availability)) fail('core/availability.js', 'Availability must compose WorkPlan + usages + TimeGrid');
if (/journal\/|timetable\/|settings\/|ui\//.test(availability)) fail('core/availability.js', 'Availability must not depend on feature or UI implementations');

if (!/getDayDraftScheduleConflicts/.test(dayEditor)) fail('timetable/day-editor.js', 'Timetable Day Editor must ask WorkPlan for draft schedule conflicts');
if (/rangesOverlap/.test(dayEditor)) fail('timetable/day-editor.js', 'Timetable Day Editor must not implement its own overlap algorithm');

if (!/export function openTimePickerAction/.test(sharedTime) || !/return openPicker\(\{/.test(sharedTime)) fail('ui/time/index.js', 'Shared Time must expose one canonical direct time-picker action over the existing wheel owner.');
if (!/export function openTimeRangeAction/.test(sharedTime)) fail('ui/time/index.js', 'Shared Time must own the work-time range action.');
if (/time-range-title/.test(sharedTime)) fail('ui/time/index.js', 'Work-time range must not use one shared С - до title; each box owns its own label.');
if (!/time-range-fields/.test(sharedTime) || !/timePicker\(\{ label: 'С', name: 'from'/.test(sharedTime) || !/timePicker\(\{ label: 'До', name: 'to'/.test(sharedTime)) fail('ui/time/index.js', 'Work-time range must reuse the existing Shared timePicker twice on one row.');
if (/type="time"/.test(sharedTime)) fail('ui/time/index.js', 'Shared Time range must never fall back to native input[type=time].');
if (!/initTimePickers\(layer\)/.test(sharedTime)) fail('ui/time/index.js', 'Work-time range boxes must open the canonical Shared time wheel modal.');
if (!/modal\(content,\{variant:'x'/.test(sharedTime) || !/className:'modal--time-picker-sheet'/.test(sharedTime)) fail('ui/time/index.js', 'Canonical time selection must use Shared X, not S, technical or native picker.');
if (/modal\(content,\{variant:'s'/.test(sharedTime) || /variant:'technical'/.test(sharedTime)) fail('ui/time/index.js', 'Canonical time selection must never use S or technical modal.');
if (!/\.time-range-fields\{display:grid;grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)/.test(sharedTimeCss)) fail('ui/time/time.css', 'Work-time range boxes must stay in one horizontal row.');
if (/\.time-range-fields \.time-picker__label\{display:none\}/.test(sharedTimeCss)) fail('ui/time/time.css', 'Work-time range must keep С and До visible above their own boxes.');

if (errors.length) {
  console.error('time UI ownership check: FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('time UI ownership check: OK');
