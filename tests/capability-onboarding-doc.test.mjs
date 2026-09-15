import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const contract = readFileSync(new URL('../docs/BOOK_CAPABILITY_CHANGE_ONBOARDING.md', import.meta.url), 'utf8');

assert.match(contract, /не зависит от перезагрузки страницы/);
assert.match(contract, /не хранит факт ознакомления в `localStorage`\/`sessionStorage`/);
assert.match(contract, /Сначала показывается один общий блокирующий модал/);
assert.match(contract, /только при первом клике мастера по этому разделу/);
assert.match(contract, /Отозванный раздел сразу исчезает/);
assert.match(contract, /Тексты сейчас намеренно не считаются финальными/);

console.log('capability onboarding product contract tests: OK');
