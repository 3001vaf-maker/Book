import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ALL_WORKPLACES_ID, headerControl, workplaceAddButton, workplaceContent } from '../ui/ui.js';

const addMarkup = workplaceAddButton();
assert.match(addMarkup, /\+ Добавить рабочее место/);
assert.match(addMarkup, /\bui-button\b/);
assert.match(addMarkup, /ui-button--secondary/);
assert.doesNotMatch(addMarkup, /ui-button--(?:full|small|compact)/);
assert.match(addMarkup, /data-add-workplace/);

const contentMarkup = workplaceContent({
  workplace: { key: 'beauty', name: 'Бьюти Тория' },
  showStats: true,
  stats: { days: 13, hours: 108, minutes: 0 },
});
assert.match(contentMarkup, /Бьюти Тория/);
assert.match(contentMarkup, /13 дней/);
assert.match(contentMarkup, /108 ч 00 м/);
assert.doesNotMatch(contentMarkup, /<button\b/);
assert.doesNotMatch(contentMarkup, /workplace-header-content/);
assert.equal(ALL_WORKPLACES_ID, '__all__');

const headerMarkup = headerControl(contentMarkup, {
  data: 'data-workplace-header-open',
  aria: 'Рабочее место: Бьюти Тория',
});
assert.match(headerMarkup, /class="header-control"/);
assert.match(headerMarkup, /data-header-control/);
assert.match(headerMarkup, /data-workplace-header-open/);
assert.match(headerMarkup, /Бьюти Тория/);
assert.doesNotMatch(headerMarkup, /timetable-workplace-button/);

const headerSource = readFileSync(new URL('../ui/header/index.js', import.meta.url), 'utf8');
assert.match(headerSource, /export function openHeaderControl\b/);
assert.match(headerSource, /variant:\s*'medium'/);

const workplaceSource = readFileSync(new URL('../ui/workplaces/index.js', import.meta.url), 'utf8');
assert.match(workplaceSource, /list\(\{\s*items:\s*listItems\s*\}\)/);
assert.match(workplaceSource, /Общий график/);
assert.match(workplaceSource, /WORKPLACE_FALLBACK_COLOR\s*=\s*'#212529'/);
assert.doesNotMatch(workplaceSource, /function\s+openPicker\b/);
assert.doesNotMatch(workplaceSource, /data-workplace-control-save/);
assert.doesNotMatch(workplaceSource, /<h2>Рабочий график<\/h2>/);
assert.match(workplaceSource, /title\s*=\s*''/);
assert.match(workplaceSource, /subtitle\s*=\s*''/);
assert.match(workplaceSource, /openHeaderControl\(content,\s*\{\s*title:\s*visibleTitle\s*\|\|\s*visibleSubtitle\s*\}\)/);

const graphSource = readFileSync(new URL('../timetable/timetable.js', import.meta.url), 'utf8');
assert.match(graphSource, /title:\s*'Рабочий график'/);

const journalSource = readFileSync(new URL('../journal/journal.js', import.meta.url), 'utf8');
assert.match(journalSource, /title:\s*''/);

const workplaceDataSource = readFileSync(new URL('../settings/profile/workplaces/data.js', import.meta.url), 'utf8');
assert.match(workplaceDataSource, /color:\s*String\(workplace\.color/);
assert.match(workplaceDataSource, /indicatorColor:\s*workplace\.color\s*\|\|\s*WORKPLACE_FALLBACK_COLOR/);

const workplaceEditorSource = readFileSync(new URL('../settings/profile/workplaces/workplaces.js', import.meta.url), 'utf8');
assert.match(workplaceEditorSource, /colorPicker\(\{name:'workplaceColor'/);
assert.match(workplaceEditorSource, /Название, город и цвет обязательны/);

const calendarSource = readFileSync(new URL('../ui/calendar/calendar.js', import.meta.url), 'utf8');
assert.match(calendarSource, /resolveDateIndicators/);
assert.match(calendarSource, /calendar__date-indicator/);

console.log('ui-workplaces tests: OK');
