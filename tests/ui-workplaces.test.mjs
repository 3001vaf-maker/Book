import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { headerControl, workplaceAddButton, workplaceContent } from '../ui/ui.js';

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

console.log('ui-workplaces tests: OK');
