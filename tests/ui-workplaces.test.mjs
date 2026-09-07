import assert from 'node:assert/strict';
import { workplaceAddButton } from '../ui/ui.js';

const markup = workplaceAddButton();
assert.match(markup, /\+ Добавить рабочее место/);
assert.match(markup, /ui-button--secondary/);
assert.match(markup, /ui-button--full/);
assert.match(markup, /data-add-workplace/);

console.log('ui-workplaces tests: OK');
