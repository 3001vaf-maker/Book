import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const integrations = readFileSync(new URL('../settings/integrations/integrations.js', import.meta.url), 'utf8');
const telegramCore = readFileSync(new URL('../core/integrations/telegram.js', import.meta.url), 'utf8');
const emailCore = readFileSync(new URL('../core/integrations/email.js', import.meta.url), 'utf8');
const inputs = readFileSync(new URL('../ui/inputs/index.js', import.meta.url), 'utf8');
const modalCss = readFileSync(new URL('../ui/modals/modal.css', import.meta.url), 'utf8');
const v2Css = readFileSync(new URL('../ui/v2/v2.css', import.meta.url), 'utf8');
const telegramService = readFileSync(new URL('../server/src/communication/telegram-bot.service.ts', import.meta.url), 'utf8');
const transactionalEmail = readFileSync(new URL('../server/src/transactional-email/transactional-email.service.ts', import.meta.url), 'utf8');
const communicationController = readFileSync(new URL('../server/src/communication/communication.controller.ts', import.meta.url), 'utf8');

assert.match(integrations, /workspaceHeaderContext\(\{ title: 'Интеграции' \}\)/);
assert.match(integrations, /miniCardRail\(\[/);
assert.match(integrations, /telegramMiniCard\(telegramState/);
assert.match(integrations, /emailMiniCard\(emailState/);

assert.match(integrations, /modal\(telegramXContent\(resolved\)/);
assert.match(integrations, /variant: 'x'/);
assert.match(integrations, /xRole: 'editor'/);
assert.match(integrations, /infoUI\('', \{/);
assert.match(integrations, /actionOnly: true/);
assert.match(integrations, /openDocumentViewer\(\{ title: info\.title, content: info\.content \}\)/);
assert.match(integrations, /@BotFather/);
assert.match(integrations, /\/newbot/);
assert.match(integrations, /Токен Telegram-бота/);
assert.match(integrations, /button\(connected \? 'Отключить' : 'Подключить'/);
assert.match(integrations, /label: 'Telegram-бот'/);
assert.match(integrations, /disabled: true/);
assert.match(integrations, /modal-title modal-title--action/);
assert.match(modalCss, /\.modal-title--action\{display:flex;align-items:center;justify-content:space-between/);

assert.doesNotMatch(integrations, /repairTelegramBotConnection|Восстановить webhook|telegramDiagnostics/);
assert.doesNotMatch(integrations, /Ключ шифрования:|API для webhook:|Очередь Telegram:|Webhook: не работает|fetch failed/);
assert.doesNotMatch(integrations, /integration-telegram-layer/);
assert.doesNotMatch(integrations, /workspaceHeaderContext\(\{ title: 'Telegram'/);
assert.match(integrations, /integration-email-layer/);
assert.match(integrations, /SMTP:/);
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
