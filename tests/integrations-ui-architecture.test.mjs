import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const integrations = readFileSync(new URL('../settings/integrations/integrations.js', import.meta.url), 'utf8');
const inputs = readFileSync(new URL('../ui/inputs/index.js', import.meta.url), 'utf8');
const v2Css = readFileSync(new URL('../ui/v2/v2.css', import.meta.url), 'utf8');

assert.match(integrations, /workspaceHeaderContext\(\{ title: 'Интеграции' \}\)/);
assert.match(integrations, /miniCardRail\(\[telegramMiniCard/);
assert.match(integrations, /mountV2ZLayer/);
assert.match(integrations, /v2ZLayer/);
assert.match(integrations, /title: 'Telegram'/);
assert.match(integrations, /label: 'Подключить'/);
assert.match(integrations, /data-v2-primary-visible="false"/);
assert.match(integrations, /label: 'Отключить'/);
assert.match(integrations, /data-v2-primary-variant="danger"/);
assert.match(integrations, /disabled: connected/);
assert.doesNotMatch(integrations, /Заменить токен|Новый токен бота|pageHeader|folderList|actionBlock/);
assert.match(inputs, /disabled = false/);
assert.match(inputs, /disabled \? ' disabled'/);
assert.match(v2Css, /v2-header__slot--c \.v2-header__control--danger\{border-color:#EB4C42;background:#FDD2D2;color:#EB4C42\}/);

console.log('integrations UI architecture tests: OK');
