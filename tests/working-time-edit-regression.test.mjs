import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const timetable = readFileSync(new URL('../timetable/timetable.js', import.meta.url), 'utf8');
const journal = readFileSync(new URL('../journal/journal.js', import.meta.url), 'utf8');
const journalDay = readFileSync(new URL('../journal/день.js', import.meta.url), 'utf8');

assert.match(
  timetable,
  /function\s+openSelectedWorkingTimeCorrection\(dates\s*=\s*selection\?\.getSelectedDates\?\.\(\)\s*\|\|\s*\[\]\)/,
  'Graph must expose working-time correction for selected dates',
);
assert.match(
  timetable,
  /data-timetable-correct-selected-time/,
  'Graph settings layer must expose the correction action',
);
assert.match(
  timetable,
  /timePicker\(\{\s*name:\s*'timetableCorrectionFrom'[\s\S]*?minuteStep:\s*1/,
  'Graph correction must allow arbitrary minute precision for start time',
);
assert.match(
  timetable,
  /timePicker\(\{\s*name:\s*'timetableCorrectionTo'[\s\S]*?minuteStep:\s*1/,
  'Graph correction must allow arbitrary minute precision for end time',
);
assert.match(
  timetable,
  /getWorkingTimeUsageConflicts\(\{\s*date,\s*workplaceId:\s*selectedWorkplaceId,\s*from,\s*to\s*\}\)/,
  'Graph correction must protect existing records and breaks',
);
assert.match(
  timetable,
  /getScheduleConflicts\(workingDays,\s*\{[\s\S]*?workplaceId:\s*selectedWorkplaceId,[\s\S]*?date,[\s\S]*?from,[\s\S]*?to/,
  'Graph correction must protect cross-workplace schedule conflicts',
);
assert.match(
  timetable,
  /selected\.forEach\(\(date\)\s*=>\s*updateDayTime\(workingDays,\s*selectedWorkplaceId,\s*date,\s*from,\s*to\)\)/,
  'Graph correction must persist the selected working-day times',
);

assert.match(
  timetable,
  /function\s+openTimetableSettingsMenu\(\)/,
  'Graph A must own the quick bottom settings menu',
);
assert.match(
  timetable,
  /button\('Время работы',\s*\{\s*variant:\s*'secondary',[\s\S]*?data-timetable-settings-time/,
  'Graph A settings must expose a neutral outlined working-time action for selected working dates',
);
assert.match(
  journal,
  /openTimetableDayTimeEditor/,
  'Journal Day must use the compact working-time editor',
);
assert.match(
  journal,
  /activeView\s*===\s*'day'\s*&&\s*!allMode[\s\S]*?id:\s*'working-time'[\s\S]*?label:\s*'Рабочее время'[\s\S]*?openDayTime\(selectedWorkplaceId\)/,
  'Journal Day settings must expose compact working-time editing only for a concrete workplace',
);
assert.match(
  journalDay,
  /onWorkFieldClick/,
  'Journal Day work field must allow the existing quick time adjustment',
);
assert.match(
  journal,
  /renderJournalMonth\(viewRoot,[\s\S]*?onDateSelect:/,
  'Journal Month must remain navigation into Day rather than schedule editing',
);

console.log('working-time edit regression tests: OK');
