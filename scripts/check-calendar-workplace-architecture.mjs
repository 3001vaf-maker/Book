import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const errors = [];
const read = (path) => readFileSync(join(root, path), 'utf8');
const fail = (path, message) => errors.push(`${path}: ${message}`);

function walkCss(dir) {
  const result = [];
  for (const name of readdirSync(join(root, dir))) {
    const path = join(root, dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) result.push(...walkCss(relative(root, path)));
    else if (name.endsWith('.css')) result.push(relative(root, path).replaceAll('\\', '/'));
  }
  return result;
}

const alphabet = read('UI_ALPHABET.md');
const calendarUi = read('ui/calendar/calendar.js');
const calendarCss = read('ui/calendar/calendar.css');
const workplaceUi = read('ui/workplaces/index.js');
const journalWorkplace = read('journal/workplace-control.js');
const graph = read('timetable/timetable.js');
const allCss = [...walkCss('ui'), ...walkCss('css')];

if (!alphabet.includes('| Calendar / DatePicker / DateNavigator | `ui/calendar` |')) {
  fail('UI_ALPHABET.md', 'Calendar owner must remain ui/calendar');
}
if (!alphabet.includes('| Workplace selector / workplace controls | `ui/workplaces` |')) {
  fail('UI_ALPHABET.md', 'Workplace controls owner must remain ui/workplaces');
}
if (!alphabet.includes('В APP-состоянии D с иконкой чата всегда означает `включить Messenger`')) {
  fail('UI_ALPHABET.md', 'APP Header D must remain the Messenger entry');
}

if (!/function\s+calendarHeader\s*\(/.test(calendarUi)
  || !/export function dateNavigator[\s\S]*return calendarHeader\(/.test(calendarUi)
  || !/return `<section class="calendar"[\s\S]*\$\{calendarHeader\(/.test(calendarUi)) {
  fail('ui/calendar/calendar.js', 'Calendar and DateNavigator must share one calendarHeader() primitive');
}
if (!/resolveDateIndicators/.test(calendarUi) || !/calendar__date-indicator/.test(calendarUi)) {
  fail('ui/calendar/calendar.js', 'Calendar must own generic date indicators');
}

if (!/\.calendar__header\{[^}]*grid-template-columns:36px minmax\(0,1fr\) 36px;[^}]*gap:4px;[^}]*margin:0/.test(calendarCss)) {
  fail('ui/calendar/calendar.css', 'Calendar header must own the canonical 36px controls and 4px gap');
}
if (!/\.calendar__month-button\{[^}]*width:36px;[^}]*height:36px;[^}]*border:1px solid var\(--border\);[^}]*border-radius:8px;[^}]*background:transparent;[^}]*font-size:18px/s.test(calendarCss)) {
  fail('ui/calendar/calendar.css', 'Calendar arrows must keep the canonical 36x36 / 18 / r8 geometry');
}
if (!/\.calendar__month\{[^}]*font-size:14px;[^}]*font-weight:700/.test(calendarCss)) {
  fail('ui/calendar/calendar.css', 'Calendar label must remain 14/700');
}
if (!/\.calendar__grid\{[^}]*grid-auto-rows:minmax\(74px,auto\);[^}]*gap:2px/.test(calendarCss)) {
  fail('ui/calendar/calendar.css', 'Calendar cells must keep 74px minimum height and 2px gap');
}
if (!/\.calendar__date\.is-today\{border-color:#B3ACA8;background:#E3E0DE\}/.test(calendarCss)
  || !/\.calendar__date\.is-selected\{box-shadow:inset 0 0 0 2px var\(--text\)\}/.test(calendarCss)
  || !/\.calendar__date-indicator\{[^}]*width:7px;[^}]*height:7px/.test(calendarCss)) {
  fail('ui/calendar/calendar.css', 'Calendar today, selected and indicator states must remain canonical');
}
for (const path of allCss) {
  if (path === 'ui/calendar/calendar.css') continue;
  if (/\.calendar__(?:header\b|month-button|month\b|weekdays\b|grid\b|date(?:\b|[.:])|date-number\b|date-content\b|date-indicator\b)/.test(read(path))) {
    fail(path, 'Shared Calendar presentation belongs only to ui/calendar/calendar.css');
  }
}

if (!/export function openWorkplaceControl/.test(workplaceUi)
  || !/openHeaderControl\(content/.test(workplaceUi)
  || !/list\(\{ items: listItems \}\)/.test(workplaceUi)
  || !/ALL_WORKPLACES_ID/.test(workplaceUi)) {
  fail('ui/workplaces/index.js', 'Graph workplace selection must compose Shared Header Control + List');
}
if (!/select\(\{/.test(journalWorkplace)
  || !/variant:\s*'x'/.test(journalWorkplace)
  || !/onSelect\(nextId\)/.test(journalWorkplace)) {
  fail('journal/workplace-control.js', 'Journal workplace selection must reuse Shared Select inside canonical X');
}

for (const token of ['initCalendar(', 'workspaceHeaderContext({', 'mountV2ZLayer(', 'v2HorizontalRail(', 'entityCard({']) {
  if (!graph.includes(token)) fail('timetable/timetable.js', `Graph must compose Shared owner: ${token}`);
}
if (!/resolveDateIndicators/.test(graph) || /calendar__date-indicator/.test(graph)) {
  fail('timetable/timetable.js', 'Graph must pass data to Shared Calendar instead of drawing Calendar UI locally');
}

if (errors.length) {
  console.error('calendar/workplace architecture check: FAILED');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log('calendar/workplace architecture check: OK');
