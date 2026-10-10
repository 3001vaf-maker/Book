import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const integrations = readFileSync(new URL('../settings/integrations/integrations.js', import.meta.url), 'utf8');
const telegramCore = readFileSync(new URL('../core/integrations/telegram.js', import.meta.url), 'utf8');
const emailCore = readFileSync(new URL('../core/integrations/email.js', import.meta.url), 'utf8');
const inputs = readFileSync(new URL('../ui/inputs/index.js', import.meta.url), 'utf8');
const v2Css = readFileSync(new URL('../ui/v2/v2.css', import.meta.url), 'utf8');
const telegramService = readFileSync(new URL('../server/src/communication/telegram-bot.service.ts', import.meta.url), 'utf8');
const transactionalEmail = readFileSync(new URL('../server/src/transactional-email/transactional-email.service.ts', import.meta.url), 'utf8');
const communicationController = readFileSync(new URL('../server/src/communication/communication.controller.ts', import.meta.url), 'utf8');

assert.match(integrations, /workspaceHeaderContext\(\{ title: 'Интеграции' \}\)/);
assert.match(integrations, /miniCardRail\(\[/);
assert.match(integrations, /telegramMiniCard\(telegramState/);
assert.match(integrations, /emailMiniCard\(emailState/);
assert.match(integrations, /mountV2ZLayer/);
assert.match(integrations, /v2ZLayer/);
assert.match(integrations, /title: 'Telegram'/);
assert.match(integrations, /title: 'Email'/);
assert.match(integrations, /label: 'Подключить'/);
assert.match(integrations, /data-v2-primary-visible="false"/);
assert.match(integrations, /label: 'Отключить'/);
assert.match(integrations, /data-v2-primary-variant="danger"/);
assert.match(integrations, /Восстановить webhook/);
assert.match(integrations, /SMTP:/);
assert.match(integrations, /disabled: connected/);
assert.doesNotMatch(integrations, /Заменить токен|Новый токен бота|pageHeader|folderList|actionBlock/);

assert.match(telegramCore, /integrations\/telegram\/repair/);
assert.match(emailCore, /integrations\/email/);
assert.match(telegramService, /getWebhookInfo/);
assert.match(telegramService, /repairConnection/);
assert.match(telegramService, /configurationStatus/);
assert.match(telegramService, /PUBLIC_API_URL/);
assert.match(telegramService, /ACCOUNT_APP_URL/);
assert.match(transactionalEmail, /configurationStatus/);
assert.match(transactionalEmail, /transporter\(\)\.verify\(\)/);
assert.match(communicationController, /integrations\/email/);
assert.match(communicationController, /integrations\/telegram\/repair/);

assert.match(inputs, /disabled = false/);
assert.match(inputs, /disabled \? ' disabled'/);
assert.match(v2Css, /v2-header__slot--c \.v2-header__control--danger\{border-color:#EB4C42;background:#FDD2D2;color:#EB4C42\}/);

console.log('Email and Telegram integrations UI architecture tests: OK');
