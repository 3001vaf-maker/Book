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
  journal,
  /id:\s*'working-time'[\s\S]*?label:\s*'Время работы'[\s\S]*?openDayTime\(allMode\s*\?\s*''\s*:\s*selectedWorkplaceId\)/,
  'Journal settings must expose working-time editing',
);
assert.match(
  journalDay,
  /onWorkFieldClick:\s*\(\)\s*=>\s*onWorkplaceFieldClick\(workplaceId\)/,
  'single-workplace Journal day must open the working-time editor from its work field',
);

console.log('working-time edit regression tests: OK');
