import assert from 'node:assert/strict';
import { headerControl, workplaceAddButton, workplaceHeaderContent } from '../ui/ui.js';

const addMarkup = workplaceAddButton();
assert.match(addMarkup, /\+ Добавить рабочее место/);
assert.match(addMarkup, /\bui-button\b/);
assert.match(addMarkup, /ui-button--secondary/);
assert.doesNotMatch(addMarkup, /ui-button--(?:full|small|compact)/);
assert.match(addMarkup, /data-add-workplace/);

const workplaceContent = workplaceHeaderContent({
  workplace: { key: 'beauty', name: 'Бьюти Тория' },
  showStats: true,
  stats: { days: 13, hours: 108, minutes: 0 },
});
assert.match(workplaceContent, /Бьюти Тория/);
assert.match(workplaceContent, /13 дней/);
assert.match(workplaceContent, /108 ч 00 м/);
assert.doesNotMatch(workplaceContent, /<button\b/);

const headerMarkup = headerControl(workplaceContent, {
  data: 'data-workplace-header-open',
  aria: 'Рабочее место: Бьюти Тория',
});
assert.match(headerMarkup, /class="header-control"/);
assert.match(headerMarkup, /data-header-control/);
assert.match(headerMarkup, /data-workplace-header-open/);
assert.match(headerMarkup, /Бьюти Тория/);
assert.doesNotMatch(headerMarkup, /timetable-workplace-button/);

console.log('ui-workplaces tests: OK');
