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
const timeUsage = read('core/time-usage.js');
const timeGrid = read('core/time-grid.js');
const availability = read('core/availability.js');
const dayEditor = read('timetable/day-editor.js');
const architecture = read('ARCHITECTURE_DICTIONARY.md');

if (!/from ['"]\.\.\/core\/availability\.js['"]/.test(recordFlow)) fail('journal/record.js', 'Record creation must ask Core Availability');
if (!/checkTimeAvailability/.test(recordFlow) || !/listAvailableStartTimes/.test(recordFlow) || !/listAvailableEndTimes/.test(recordFlow)) fail('journal/record.js', 'Record creation must use canonical Availability queries');
if (!/getWorkplaceWorkingDates/.test(recordFlow)) fail('journal/record.js', 'Record creation must use the canonical WorkPlan date query');
if (/from ['"]\.\.\/core\/day\.js['"]|isTimeRangeAvailable|getTimeUsages|getJournalBreaks|getRecords\(|getDayTime|getDay\(/.test(recordFlow)) fail('journal/record.js', 'Record creation must not rebuild occupancy or WorkPlan availability');
if (/from ['"]\.\/break-data\.js['"]/.test(recordFlow)) fail('journal/record.js', 'Record creation must command Break through break-service.js');

if (!/listAvailableStartTimes/.test(recordView)) fail('journal/record-view.js', 'Record editor must ask Core Availability for time choices');
if (!/getWorkplaceWorkingDates/.test(recordView)) fail('journal/record-view.js', 'Record editor must use the canonical WorkPlan date query');
if (/from ['"]\.\.\/core\/day\.js['"]/.test(recordView)) fail('journal/record-view.js', 'Record editor must not read WorkPlan storage directly');
if (!/timeSlots\(\{\s*values,\s*selected:/.test(recordView)) fail('journal/record-view.js', 'Record editor must pass canonical values to shared timeSlots');
if (/timeSlots\(\{[^}]*\boccupied\b/.test(recordView) || /timeSlots\(\{[^}]*\bfrom:\s*workingTime/.test(recordView)) fail('journal/record-view.js', 'Record editor must not use a local availability contract');
if (!/const startWorkplaceEdit/.test(recordView) || !/startDateEdit\(workplaceDraft/.test(recordView)) fail('journal/record-view.js', 'Workplace edit must require Date then Time');
if (!/const startRecordDateEdit/.test(recordView) || !/startDateEdit\(\{ \.\.\.state \}/.test(recordView)) fail('journal/record-view.js', 'Date edit must require Time before applying');
if (!/chooseTimeForDraft\(datedDraft/.test(recordView)) fail('journal/record-view.js', 'Date selection must chain into time selection');
if (/openWorkplacePicker\(state,\s*\(workplaceId\)\s*=>\s*applyPatch/.test(recordView)) fail('journal/record-view.js', 'Workplace selection must not apply a partial scheduling tuple');
if (/openDatePicker\(state,\s*\(date\)\s*=>\s*applyPatch/.test(recordView)) fail('journal/record-view.js', 'Date selection must not apply stale time');

if (!/from ['"]\.\.\/core\/availability\.js['"]/.test(breakView)) fail('journal/break-view.js', 'Break view must ask Core Availability');
if (!/listAvailableStartTimes/.test(breakView) || !/listAvailableEndTimes/.test(breakView)) fail('journal/break-view.js', 'Break view must use canonical Availability choices');
if (/from ['"]\.\.\/core\/(?:day|time-usage|time-grid)\.js['"]|from ['"]\.\/break-data\.js['"]|getRecordsForDay|getJournalBreaks|isTimeRangeAvailable|getTimeUsages/.test(breakView)) fail('journal/break-view.js', 'Break view must not calculate occupancy or use persistence directly');

if (/^import /m.test(breakData) || /notifyTimeUsageChanged|checkTimeAvailability|isValidRange|normalizeTime/.test(breakData)) fail('journal/break-data.js', 'Break data must remain persistence-only');
if (!/from ['"]\.\/break-data\.js['"]/.test(breakRead) || /checkTimeAvailability|notifyTimeUsageChanged/.test(breakRead)) fail('journal/break-read.js', 'Break read model must only compose persisted facts');
if (!/from ['"]\.\.\/core\/availability\.js['"]/.test(breakService) || !/from ['"]\.\/break-data\.js['"]/.test(breakService)) fail('journal/break-service.js', 'Break service must own commands and validate through Availability');

if (!/getTimeUsagesForScope/.test(journalDay) || !/getTimeAvailabilityAt/.test(journalDay)) fail('journal/день.js', 'Journal Day must consume Core occupancy and minute state');
if (/getRecordsForDay|getJournalBreaks|getTimeUsages\(|rangesOverlap|time-grid/.test(journalDay)) fail('journal/день.js', 'Journal Day must not assemble or calculate time ownership locally');

if (!/onUsageClick/.test(timeline)) fail('ui/time/journal-day.js', 'Timeline UI must emit generic usage clicks');
if (/availability|time-grid|time-usage|record-read|break-read|journal\//.test(timeline)) fail('ui/time/journal-day.js', 'Timeline UI must remain presentation-only');
if (/initJournalDayTimeline\([^)]*usages/.test(timeline) || /const usage = .*\.find/.test(timeline)) fail('ui/time/journal-day.js', 'Timeline UI must not decide which business usage owns a clicked minute');
if (!/onSlotClick\(\{[\s\S]*?from:[\s\S]*?to:/.test(timeline)) fail('ui/time/journal-day.js', 'Timeline UI must emit coordinates only');

if (/isTimeRangeAvailable|export function getTimeUsages\b|export function getUsageAtTime\b/.test(timeUsage)) fail('core/time-usage.js', 'Time Usage must not expose a second Availability implementation');
if (/journal\/|timetable\/|settings\/|ui\//.test(timeUsage)) fail('core/time-usage.js', 'Time Usage must remain neutral');

if (/journal\/|timetable\/|settings\/|ui\/|availability\.js|time-usage\.js|day\.js|workplace-time\.js/.test(timeGrid)) fail('core/time-grid.js', 'TimeGrid must remain neutral and depend only on technical time helpers');
if (!/createTimeGrid/.test(availability) || !/getTimeUsagesForScope/.test(availability) || !/getDayTime/.test(availability)) fail('core/availability.js', 'Availability must compose WorkPlan + usages + TimeGrid');
if (/journal\/|timetable\/|settings\/|ui\//.test(availability)) fail('core/availability.js', 'Availability must not depend on feature or UI implementations');

if (!/getDayDraftScheduleConflicts/.test(dayEditor)) fail('timetable/day-editor.js', 'Timetable Day Editor must ask WorkPlan for draft schedule conflicts');
if (/rangesOverlap/.test(dayEditor)) fail('timetable/day-editor.js', 'Timetable Day Editor must not implement its own overlap algorithm');

if (!/## 14\. Journal → WorkPlan → Availability → TimeGrid → UI/.test(architecture)) fail('ARCHITECTURE_DICTIONARY.md', 'canonical scheduling ownership contract is missing');
if (!/Обычное продуктовое ТЗ не является разрешением менять эту архитектуру/.test(architecture)) fail('ARCHITECTURE_DICTIONARY.md', 'architecture-change rule is missing');

if (errors.length) {
  console.error('time UI ownership check: FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('time UI ownership check: OK');
