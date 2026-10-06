import assert from 'node:assert/strict';
import fs from 'node:fs';

const journal = fs.readFileSync(new URL('../journal/journal.js', import.meta.url), 'utf8');
const day = fs.readFileSync(new URL('../journal/день.js', import.meta.url), 'utf8');
const month = fs.readFileSync(new URL('../journal/месяц.js', import.meta.url), 'utf8');
const calendarCss = fs.readFileSync(new URL('../ui/calendar/calendar.css', import.meta.url), 'utf8');
const zLayout = fs.readFileSync(new URL('../ui/v2/z-layout.js', import.meta.url), 'utf8');

assert.match(zLayout, /setV2ZHeaderRows/);
assert.match(zLayout, /gap:8px/);
assert.match(journal, /setV2ZHeaderRows\(root, \[primaryNavigation, secondaryNavigation\]\)/);
assert.match(journal, /views: listModes/);
assert.match(day, /navigationRoot = null/);
assert.match(day, /initDateNavigator\(navigatorRoot/);
assert.match(month, /navigationRoot = null/);
assert.match(month, /calendar__header--compact/);
assert.match(calendarCss, /calendar__header--compact/);
assert.match(calendarCss, /36px minmax\(0,1fr\) 36px/);

console.log('Journal Z header contract passed');
