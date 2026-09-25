import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const people = readFileSync(new URL('../main/people/people.js', import.meta.url), 'utf8');
const v2 = readFileSync(new URL('../ui/v2/index.js', import.meta.url), 'utf8');
const v2Css = readFileSync(new URL('../ui/v2/v2.css', import.meta.url), 'utf8');
const core = readFileSync(new URL('../core.js', import.meta.url), 'utf8');
const miniCard = readFileSync(new URL('../ui/cards/mini-card.js', import.meta.url), 'utf8');

assert.match(people, /title:\s*'Клиенты'/);
assert.match(people, /Поиск по имени или UEI/);
assert.match(people, /data-people-list-settings/);
assert.match(people, /variant:\s*'quick'/);
assert.match(people, /Выгрузить/);
assert.match(people, /Загрузить/);
assert.match(people, /Шаблон/);

assert.match(people, /mountV2ZLayer\([\s\S]*stack:\s*true/);
assert.match(people, /people-overview-layer/);
assert.match(people, /people-edit-layer/);
assert.match(people, /data-person-card/);
assert.match(people, /data-person-z3-action/);
assert.match(people, /dirty \? 'Сохранить' : 'Удалить'/);
assert.match(people, /layer\.v2Close\?\.\(\);[\s\S]*callbacks\.onSaved/);
assert.doesNotMatch(people, /data-workspace-back-source/);

assert.match(people, /miniCard\(\{/);
assert.match(people, /title:\s*'UEI'/);
assert.match(people, /title:\s*'Согласия'/);
assert.match(people, /showApply:\s*false/);
assert.match(people, /data-person-direct-chat/);

assert.match(v2, /mountV2ZLayer\(root, html, \{ onClose = null, stack = false \}/);
assert.match(v2, /if \(!stack\) stage\.querySelectorAll/);
assert.match(v2, /isTopmost/);
assert.match(v2Css, /--v2-z-layer-shift/);
assert.match(core, /chatPersonKey/);
assert.match(core, /onDirectChat/);
assert.match(core, /data-workspace-d-action/);
assert.match(miniCard, /export function miniCard/);

console.log('People layered UI architecture: OK');
