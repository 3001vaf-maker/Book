import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const indexHtml = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const core = await readFile(new URL('../core.js', import.meta.url), 'utf8');
const bootstrap = await readFile(new URL('../core/bootstrap.js', import.meta.url), 'utf8');
const clientRuntime = await readFile(new URL('../online-booking/client-runtime.js', import.meta.url), 'utf8');
const entryAuth = await readFile(new URL('../core/telegram-entry-auth.js', import.meta.url), 'utf8');
const bookingAccount = await readFile(new URL('../core/booking-account/index.js', import.meta.url), 'utf8');
const telegramBot = await readFile(new URL('../server/src/communication/telegram-bot.service.ts', import.meta.url), 'utf8');
const telegramAuth = await readFile(new URL('../server/src/online-booking/telegram-booking-auth.service.ts', import.meta.url), 'utf8');
const telegramAuthController = await readFile(new URL('../server/src/online-booking/telegram-booking-auth.controller.ts', import.meta.url), 'utf8');
const cardLink = await readFile(new URL('../server/src/online-booking/client-card-link.service.ts', import.meta.url), 'utf8');

// Telegram is a shell around the same public Book web app, not a second booking implementation.
assert.match(indexHtml, /https:\/\/telegram\.org\/js\/telegram-web-app\.js/);
assert.match(clientRuntime, /window\.Telegram\?\.WebApp/);
assert.match(clientRuntime, /webApp\.ready\(\)/);
assert.match(clientRuntime, /webApp\.expand\(\)/);
assert.match(core, /params\.get\('booking'\)/);
assert.match(core, /telegramEntry:\s*String\(params\.get\('tg_entry'\)/);

// Telegram entry is exchanged before the normal Book bootstrap, so a linked Telegram user never sees a password screen.
assert.match(bootstrap, /prepareTelegramEntryAuth/);
assert.match(bootstrap, /await prepareTelegramEntryAuth\(\)/);
assert.match(entryAuth, /exchangeBookingTelegramEntry\(tenantId, entryToken\)/);
assert.match(entryAuth, /result\?\.state === 'authenticated'/);
assert.match(entryAuth, /registerBookingTelegramAccount\(tenantId, entryToken/);
assert.match(entryAuth, /name="phone"/);
assert.match(entryAuth, /name="email"/);
assert.doesNotMatch(entryAuth, /name="password"/);
assert.match(bookingAccount, /account\/telegram-entry\/exchange/);
assert.match(bookingAccount, /account\/telegram-entry\/register/);

// Server owns the one-time Telegram ticket and issues the ordinary booking-account session.
assert.match(telegramAuthController, /telegram-entry\/exchange/);
assert.match(telegramAuthController, /telegram-entry\/register/);
assert.match(telegramAuth, /CommunicationIdentity/);
assert.match(telegramAuth, /kind:\s*'booking-account'/);
assert.match(telegramAuth, /authMethod:\s*'telegram'/);
assert.match(telegramAuth, /randomBytes\(48\)/);
assert.match(telegramAuth, /bindTelegramEntry\(tenantId/);

// Bot opens that same URL as a real Mini App and verifies the webhook with Telegram.
assert.match(telegramBot, /web_app:\s*\{\s*url:\s*url\.toString\(\)\s*\}/);
assert.match(telegramBot, /'setWebhook'/);
assert.match(telegramBot, /secret_token:\s*webhookSecret/);
assert.match(telegramBot, /'getWebhookInfo'/);
assert.match(telegramBot, /Telegram не подтвердил webhook Book/);
assert.match(telegramBot, /requiredHttpsUrl\('PUBLIC_API_URL'\)/);
assert.match(telegramBot, /requiredHttpsUrl\('CLIENT_APP_URL'\)/);

// Telegram is an authentication/contact method, not the Person key. Existing client history still attaches by phone/card rules.
assert.match(cardLink, /findOrAttachExistingCard/);
assert.match(cardLink, /cardState\(tenantId, account\.phone\)/);
assert.match(cardLink, /accounts:\s*uniqueStrings\(\[\.\.\.accountIds\(card\.owner\.person\), accountId\]\)/);

console.log('telegram-miniapp.test.mjs: ok');
