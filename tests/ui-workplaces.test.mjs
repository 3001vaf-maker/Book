import assert from 'node:assert/strict';
import { workplaceAddButton } from '../ui/ui.js';

const markup = workplaceAddButton();
assert.match(markup, /\+ Добавить рабочее место/);
assert.match(markup, /\bui-button\b/);
assert.match(markup, /ui-button--secondary/);
assert.doesNotMatch(markup, /ui-button--(?:full|small|compact)/);
assert.match(markup, /data-add-workplace/);

console.log('ui-workplaces tests: OK');
