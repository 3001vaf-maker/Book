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
const timeUi = read('ui/time/index.js');
const timeCss = read('ui/time/time.css');
const listUi = read('ui/lists/list.js');
const graph = read('timetable/timetable.js');
const dayEditor = read('timetable/day-editor.js');
const journal = read('journal/journal.js');
const journalWorkplaceControl = read('journal/workplace-control.js');
const journalMonth = read('journal/месяц.js');
const recordData = read('journal/record-data.js');
const timeUsage = read('core/time-usage.js');
const coreEntry = read('core.js');
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

if (!/list\(\{\s*items:\s*listItems\s*\}\)/.test(workplaceUi)) fail('ui/workplaces/index.js', 'Graph Workplace manifestation must use shared list()');
if (/function\s+openPicker\b|name:\s*['"]workplaceControlSelect['"]|data-workplace-control-save/.test(workplaceUi)) fail('ui/workplaces/index.js', 'Graph Workplace manifestation must not recreate Select + Choose flow');
if (!/ALL_WORKPLACES_ID/.test(workplaceUi) || !/Общий график/.test(workplaceUi)) fail('ui/workplaces/index.js', 'Graph Workplace List must own the aggregate graph row');
if (/Все записи|aggregateLabel|aggregateAria/.test(workplaceUi)) fail('ui/workplaces/index.js', 'Graph Workplace control must not contain Journal aggregate semantics');
if (/<h2>Рабочий график<\/h2>/.test(workplaceUi)) fail('ui/workplaces/index.js', 'Workplace must not own the visible Header Control title');
if (!/title\s*=\s*['"]['"]/.test(workplaceUi) || !/subtitle\s*=\s*['"]['"]/.test(workplaceUi)) fail('ui/workplaces/index.js', 'Graph Workplace manifestation must accept caller-owned optional title/subtitle');
if (!/openHeaderControl\(content,\s*\{\s*title:\s*visibleTitle\s*\|\|\s*visibleSubtitle\s*\}\)/.test(workplaceUi)) fail('ui/workplaces/index.js', 'Graph Workplace manifestation must pass the caller-owned heading to Header Control');
if (/Корректировка времени|data-workplace-control-open-time|workplaceControlFrom|workplaceControlTo/.test(workplaceUi)) fail('ui/workplaces/index.js', 'Graph Header Workplace List must not own working-time correction');

if (!/ALL_WORKPLACES_ID/.test(graph) || !/includeAggregate:\s*true/.test(graph)) fail('timetable/timetable.js', 'Graph must expose the aggregate workplace schedule through its Workplace control');
if (!/getWorkingDayTotalMinutes/.test(graph)) fail('timetable/timetable.js', 'aggregate Graph dates must show summed duration instead of a false continuous interval');
if (!/resolveDateIndicators/.test(graph) || /calendar__date-indicator/.test(graph)) fail('timetable/timetable.js', 'Graph must pass indicator data to Calendar instead of drawing indicators locally');
if (!/openWorkplaceControl\s*\(\s*\{[\s\S]*?title:\s*['"]Рабочий график['"]/.test(graph)) fail('timetable/timetable.js', 'Graph must own and pass its visible Header Control title');
if (!/actionsRoot\.hidden\s*=\s*allMode/.test(graph)) fail('timetable/timetable.js', 'aggregate Graph mode must hide the working-day apply action');
if (!/openTimetableDayEditor/.test(graph)) fail('timetable/timetable.js', 'aggregate date click must call the Timetable-owned day editor');
if (/function\s+openAggregateDayEditor/.test(graph)) fail('timetable/timetable.js', 'Graph page must not keep a second local day-editor implementation');
if (/journal\/record-data\.js/.test(graph)) fail('timetable/timetable.js', 'Graph must not import or own Record data directly');
if (/canCorrectTime|onSaveTime/.test(graph)) fail('timetable/timetable.js', 'Graph Header Workplace List must not receive time-correction callbacks');

if (!/export function openTimetableDayEditor/.test(dayEditor)) fail('timetable/day-editor.js', 'Timetable must own one canonical working-day editor');
if (!/variant:\s*['"]medium['"]/.test(dayEditor)) fail('timetable/day-editor.js', 'canonical day editor must use the shared medium Modal');
if (!/time-range-fields/.test(dayEditor) || !/timePicker\(\{\s*name:\s*`aggregateFrom/.test(dayEditor) || !/timePicker\(\{\s*name:\s*`aggregateTo/.test(dayEditor)) fail('timetable/day-editor.js', 'canonical day editor must use shared TimePicker fields');
if (!/getWorkingTimeUsageConflicts/.test(dayEditor)) fail('timetable/day-editor.js', 'canonical day editor must ask Core for occupied-time conflicts');
if (!/Пересечение с/.test(dayEditor) || !/Запись \$\{conflict\.from\}–\$\{conflict\.to\} выходит за рабочее время/.test(dayEditor)) fail('timetable/day-editor.js', 'canonical day editor must show actual schedule/record conflicts');
if (!/\+ Добавить рабочее пространство/.test(dayEditor) || !/openDayWorkplaceControl/.test(dayEditor)) fail('timetable/day-editor.js', 'canonical day editor must own workspace addition for the day');
if (/journal\//.test(dayEditor)) fail('timetable/day-editor.js', 'Timetable day editor must not depend on Journal implementation');

if (/openWorkplaceControl/.test(journal)) fail('journal/journal.js', 'Journal must not call the Graph Workplace control');
if (!/openJournalWorkplaceControl/.test(journal)) fail('journal/journal.js', 'Journal must use its own Header manifestation');
if (!/openTimetableDayEditor/.test(journal) || !/timetable\/day-editor\.js/.test(journal)) fail('journal/journal.js', 'Journal must call the Timetable-owned working-day editor instead of recreating it');
if (/getDayWorkplaceDraft|saveDayWorkplaceTime|openDayWorkplaceTime|updateDayTime|hasScheduleConflict|createDay|saveDays/.test(journal)) fail('journal/journal.js', 'Journal must not own working-day mutation or validation');
if (!/export function openJournalWorkplaceControl/.test(journalWorkplaceControl)) fail('journal/workplace-control.js', 'Journal must own a separate Workplace selection manifestation');
if (!/openHeaderControl/.test(journalWorkplaceControl) || !/list\(\{\s*items\s*\}\)/.test(journalWorkplaceControl)) fail('journal/workplace-control.js', 'Journal manifestation must reuse shared Header Control and List');
if (!/Все записи/.test(journalWorkplaceControl) || /Общий график/.test(journalWorkplaceControl)) fail('journal/workplace-control.js', 'Journal manifestation must own only Journal aggregate semantics');
if (!/data-journal-workplace-select/.test(journalWorkplaceControl) || /data-workplace-control-select/.test(journalWorkplaceControl)) fail('journal/workplace-control.js', 'Journal and Graph controls must have separate interaction channels');
if (!/getWorkingDayIndicators/.test(journalMonth) || !/resolveDateIndicators/.test(journalMonth) || /calendar__date-indicator/.test(journalMonth)) fail('journal/месяц.js', 'Journal Month must use the same Calendar indicator channel and must not draw its own indicators');

if (!/export function getWorkingTimeRecordConflicts/.test(recordData)) fail('journal/record-data.js', 'Record owner must expose only conflicts against a proposed working interval');
if (!/!containsRange\(from, to, record\.from, record\.to\)/.test(recordData)) fail('journal/record-data.js', 'Record conflict query must return only records that fall outside the proposed working interval');
if (!/configureWorkingTimeConflictSource/.test(timeUsage) || !/getWorkingTimeUsageConflicts/.test(timeUsage)) fail('core/time-usage.js', 'Core time usage must expose a configured conflict contract without owning Record state');
if (!/configureWorkingTimeConflictSource\(getWorkingTimeRecordConflicts\)/.test(coreEntry)) fail('core.js', 'App composition must wire the Record owner into the Core time-usage conflict contract');
if (!/hidden\.dispatchEvent\(new Event\(['"]change['"],\{bubbles:true\}\)\)/.test(timeUi)) fail('ui/time/index.js', 'shared TimePicker must emit change so conflict validation updates after edits');
if (!/\.time-range-fields\b/.test(timeCss)) fail('ui/time/time.css', 'shared Time UI must own the two-column time-range layout');

if (errors.length) {
  console.error('calendar/workplace architecture check: FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('calendar/workplace architecture check: OK');
