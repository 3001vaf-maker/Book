import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const indexHtml = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const core = await readFile(new URL('../core.js', import.meta.url), 'utf8');
const clientRuntime = await readFile(new URL('../online-booking/client-runtime.js', import.meta.url), 'utf8');
const telegramBot = await readFile(new URL('../server/src/communication/telegram-bot.service.ts', import.meta.url), 'utf8');
const cardLink = await readFile(new URL('../server/src/online-booking/client-card-link.service.ts', import.meta.url), 'utf8');

// Telegram is a shell around the same public Book web app, not a second booking implementation.
assert.match(indexHtml, /https:\/\/telegram\.org\/js\/telegram-web-app\.js/);
assert.match(clientRuntime, /window\.Telegram\?\.WebApp/);
assert.match(clientRuntime, /webApp\.ready\(\)/);
assert.match(clientRuntime, /webApp\.expand\(\)/);
assert.match(clientRuntime, /bindBookingTelegramEntry\(tenant, entry\)/);
assert.match(core, /params\.get\('booking'\)/);
assert.match(core, /telegramEntry:\s*String\(params\.get\('tg_entry'\)/);

// Bot opens that same URL as a real Mini App and verifies the webhook with Telegram.
assert.match(telegramBot, /web_app:\s*\{\s*url:\s*url\.toString\(\)\s*\}/);
assert.match(telegramBot, /'setWebhook'/);
assert.match(telegramBot, /secret_token:\s*webhookSecret/);
assert.match(telegramBot, /'getWebhookInfo'/);
assert.match(telegramBot, /Telegram не подтвердил webhook Book/);
assert.match(telegramBot, /requiredHttpsUrl\('PUBLIC_API_URL'\)/);
assert.match(telegramBot, /requiredHttpsUrl\('CLIENT_APP_URL'\)/);

// Telegram never becomes the client identity key: booking accounts still attach to an existing client by phone.
assert.match(cardLink, /findOrAttachExistingCard/);
assert.match(cardLink, /cardState\(tenantId, account\.phone\)/);
assert.match(cardLink, /accounts:\s*uniqueStrings\(\[\.\.\.accountIds\(card\.owner\.person\), accountId\]\)/);

console.log('telegram-miniapp.test.mjs: ok');
