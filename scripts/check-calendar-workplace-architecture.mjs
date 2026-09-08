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

const workplaceData = read('settings/profile/workplaces/data.js');
const workplaceEditor = read('settings/profile/workplaces/workplaces.js');
const workplaceUi = read('ui/workplaces/index.js');
const calendarUi = read('ui/calendar/calendar.js');
const calendarCss = read('ui/calendar/calendar.css');
const listUi = read('ui/lists/list.js');
const graph = read('timetable/timetable.js');
const journalMonth = read('journal/месяц.js');
const allCss = [...walkCss('ui'), ...walkCss('css')];

if (!/color:\s*String\(workplace\.color/.test(workplaceData)) fail('settings/profile/workplaces/data.js', 'Workplace must own its color field');
if (!/indicatorColor:\s*workplace\.color\s*\|\|\s*WORKPLACE_FALLBACK_COLOR/.test(workplaceData)) fail('settings/profile/workplaces/data.js', 'missing Workplace color must resolve to the canonical black indicator fallback');
if (!/WORKPLACE_FALLBACK_COLOR\s*=\s*['"]#212529['"]/.test(workplaceData)) fail('settings/profile/workplaces/data.js', 'canonical missing-color indicator must be black (#212529)');
if (!/colorPicker\(\{name:'workplaceColor'[^}]*required:true/.test(workplaceEditor)) fail('settings/profile/workplaces/workplaces.js', 'Workplace editor must use shared required colorPicker()');

if (!/resolveDateIndicators/.test(calendarUi) || !/calendar__date-indicator/.test(calendarUi)) fail('ui/calendar/calendar.js', 'Calendar must own generic date indicator manifestation');
if (!/mode\s*===\s*['"]date['"]\s*\?\s*dateIndicatorsMarkup/.test(calendarUi)) fail('ui/calendar/calendar.js', 'date indicators must belong to the full Calendar and stay out of MonthDayPicker mode');
if (!/\.calendar__date-indicator\b/.test(calendarCss)) fail('ui/calendar/calendar.css', 'Calendar indicator presentation must live in Calendar CSS');
for (const path of allCss) {
  if (path === 'ui/calendar/calendar.css') continue;
  if (/\.calendar__date-indicator\b/.test(read(path))) fail(path, 'Calendar date indicator CSS belongs only to ui/calendar/calendar.css');
}

if (!/indicatorColor/.test(listUi) || !/ui-list__indicator/.test(listUi)) fail('ui/lists/list.js', 'generic List must support a generic color indicator');
for (const path of allCss) {
  if (path === 'ui/lists/list.css') continue;
  if (/\.ui-list__indicator\b/.test(read(path))) fail(path, 'List indicator CSS belongs only to ui/lists/list.css');
}

if (!/list\(\{\s*items:\s*listItems\s*\}\)/.test(workplaceUi)) fail('ui/workplaces/index.js', 'Workplace Header manifestation must use shared list()');
if (/function\s+openPicker\b|name:\s*['"]workplaceControlSelect['"]|data-workplace-control-save/.test(workplaceUi)) fail('ui/workplaces/index.js', 'Workplace Header manifestation must not recreate Select + Choose flow');
if (!/ALL_WORKPLACES_ID/.test(workplaceUi) || !/Общий график/.test(workplaceUi)) fail('ui/workplaces/index.js', 'Workplace List must support the aggregate graph row');

if (!/ALL_WORKPLACES_ID/.test(graph) || !/includeAggregate:\s*true/.test(graph)) fail('timetable/timetable.js', 'Graph must expose the aggregate workplace schedule through the shared Workplace List');
if (!/getWorkingDayTotalMinutes/.test(graph)) fail('timetable/timetable.js', 'aggregate Graph dates must show summed duration instead of a false continuous interval');
if (!/resolveDateIndicators/.test(graph) || /calendar__date-indicator/.test(graph)) fail('timetable/timetable.js', 'Graph must pass indicator data to Calendar instead of drawing indicators locally');
if (!/getWorkingDayIndicators/.test(journalMonth) || !/resolveDateIndicators/.test(journalMonth) || /calendar__date-indicator/.test(journalMonth)) fail('journal/месяц.js', 'Journal Month must use the same Calendar indicator channel and must not draw its own indicators');

if (errors.length) {
  console.error('calendar/workplace architecture check: FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('calendar/workplace architecture check: OK');
