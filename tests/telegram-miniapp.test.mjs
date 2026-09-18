import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const indexHtml = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const core = await readFile(new URL('../core.js', import.meta.url), 'utf8');
const bootstrap = await readFile(new URL('../core/bootstrap.js', import.meta.url), 'utf8');
const clientRuntime = await readFile(new URL('../online-booking/client-runtime.js', import.meta.url), 'utf8');
const entryAuth = await readFile(new URL('../core/telegram-entry-auth.js', import.meta.url), 'utf8');
const telegramRegistration = await readFile(new URL('../telegram-registration-flow.js', import.meta.url), 'utf8');
const bookingAccount = await readFile(new URL('../core/booking-account/index.js', import.meta.url), 'utf8');
const telegramBot = await readFile(new URL('../server/src/communication/telegram-bot.service.ts', import.meta.url), 'utf8');
const telegramAuth = await readFile(new URL('../server/src/online-booking/telegram-booking-auth.service.ts', import.meta.url), 'utf8');
const telegramAuthController = await readFile(new URL('../server/src/online-booking/telegram-booking-auth.controller.ts', import.meta.url), 'utf8');
const telegramWebAppAuth = await readFile(new URL('../server/src/online-booking/telegram-webapp-auth.service.ts', import.meta.url), 'utf8');
const onlineBookingModule = await readFile(new URL('../server/src/online-booking/online-booking.module.ts', import.meta.url), 'utf8');
const cardLink = await readFile(new URL('../server/src/online-booking/client-card-link.service.ts', import.meta.url), 'utf8');

// Telegram is a shell around the same public Book web app, not a second booking implementation.
assert.match(indexHtml, /https:\/\/telegram\.org\/js\/telegram-web-app\.js/);
assert.match(clientRuntime, /window\.Telegram\?\.WebApp/);
assert.match(clientRuntime, /webApp\.ready\(\)/);
assert.match(clientRuntime, /webApp\.expand\(\)/);
assert.match(core, /params\.get\('booking'\)/);
assert.match(core, /telegramEntry:\s*String\(params\.get\('tg_entry'\)/);

// The ordinary browser URL remains independent: without a Telegram token/bootstrap signal, normal Book loads unchanged.
assert.match(entryAuth, /if \(!tenantId \|\| !entryToken\) return \{ halt: false \}/);
assert.match(bootstrap, /if \(!telegramAuth\?\.halt\) await import\('\.\.\/core\.js'\)/);

// Telegram /start entry is exchanged before normal Book bootstrap, so a linked Telegram user never sees a password screen.
assert.match(bootstrap, /prepareTelegramEntryAuth/);
assert.match(entryAuth, /exchangeBookingTelegramEntry\(tenantId, entryToken\)/);
assert.match(entryAuth, /result\?\.state === 'authenticated'/);
assert.match(entryAuth, /runTelegramRegistrationFlow/);
assert.match(telegramRegistration, /registerBookingTelegramAccount\(tenantId, entryToken/);
assert.match(telegramRegistration, /name:\s*'phone'/);
assert.match(telegramRegistration, /name:\s*'email'/);
assert.doesNotMatch(telegramRegistration, /name:\s*'password'/);
assert.match(bookingAccount, /account\/telegram-entry\/exchange/);
assert.match(bookingAccount, /account\/telegram-entry\/register/);

// A new Telegram client must use the already approved Book registration sequence.
// Telegram changes authentication only; it does not introduce its own registration design.
assert.match(telegramRegistration, /title:\s*settings\.welcomeTitle/);
assert.match(telegramRegistration, /app\.querySelector\('\[data-booking-welcome-next\]'\).*renderAgreements/);
assert.match(telegramRegistration, /title:\s*'Соглашения'/);
assert.match(telegramRegistration, /if \(canContinue\) renderDetails\(\)/);
assert.match(telegramRegistration, /title:\s*'Ваши данные'/);
assert.match(telegramRegistration, /label:\s*'Имя'/);
assert.match(telegramRegistration, /label:\s*'Фамилия'/);
assert.match(telegramRegistration, /label:\s*'Телефон'/);
assert.match(telegramRegistration, /label:\s*'Email'/);
assert.doesNotMatch(telegramRegistration, /Регистрация через Telegram/);
assert.doesNotMatch(telegramRegistration, /Telegram уже подтверждён\. Пароль не нужен\./);
assert.match(entryAuth, /Registration keeps the approved Book screens and order/);

// Telegram Main App can launch directly. It validates Telegram initData server-side, mints the same one-time entry,
// then continues through the exact same account/profile path as /start.
assert.match(entryAuth, /params\.get\('tg_bot'\)/);
assert.match(entryAuth, /window\.Telegram\?\.WebApp\?\.initData/);
assert.match(entryAuth, /telegram-main-app\/\$\{encodeURIComponent\(cleanBot\)\}\/entry/);
assert.match(entryAuth, /replaceTelegramRoute\(\{ tenantId, entryToken, removeBot: true \}\)/);
assert.match(telegramAuthController, /telegram-main-app\/:botUsername\/entry/);
assert.match(telegramAuthController, /createMainAppEntry\(botUsername, body\?\.initData\)/);
assert.match(telegramAuth, /webAppAuth\.verify\(rawBotUsername, rawInitData\)/);
assert.match(telegramAuth, /communications\.createTelegramEntry\(verified\.tenantId/);
assert.match(onlineBookingModule, /TelegramWebAppAuthService/);

// Server verifies Main App data using the connected bot token and Telegram's WebAppData HMAC, never initDataUnsafe.
assert.match(telegramWebAppAuth, /TELEGRAM_CREDENTIALS_KEY/);
assert.match(telegramWebAppAuth, /createHmac\('sha256', 'WebAppData'\)/);
assert.match(telegramWebAppAuth, /createHmac\('sha256', secretKey\)/);
assert.match(telegramWebAppAuth, /timingSafeEqual/);
assert.match(telegramWebAppAuth, /params\.get\('auth_date'\)/);
assert.match(telegramWebAppAuth, /15 \* 60/);
assert.match(telegramWebAppAuth, /params\.get\('user'\)/);
assert.doesNotMatch(telegramWebAppAuth, /initDataUnsafe/);

// Server owns the one-time Telegram ticket and issues the ordinary booking-account session.
assert.match(telegramAuthController, /telegram-entry\/exchange/);
assert.match(telegramAuthController, /telegram-entry\/register/);
assert.match(telegramAuth, /CommunicationIdentity/);
assert.match(telegramAuth, /kind:\s*'booking-account'/);
assert.match(telegramAuth, /authMethod:\s*'telegram'/);
assert.match(telegramAuth, /randomBytes\(48\)/);
assert.match(telegramAuth, /bindTelegramEntry\(tenantId/);

// Bot /start still opens that same URL as a real Mini App and verifies the webhook with Telegram.
assert.match(telegramBot, /web_app:\s*\{\s*url:\s*url\.toString\(\)\s*\}/);
assert.match(telegramBot, /'setWebhook'/);
assert.match(telegramBot, /secret_token:\s*webhookSecret/);
assert.match(telegramBot, /'getWebhookInfo'/);
assert.match(telegramBot, /Telegram не подтвердил webhook/);
assert.match(telegramBot, /requiredHttpsUrl\('PUBLIC_API_URL'\)/);
assert.match(telegramBot, /requiredHttpsUrl\('CLIENT_APP_URL'\)/);

// Telegram is an authentication/contact method, not the Person key. Existing client history still attaches by phone/card rules.
assert.match(cardLink, /findOrAttachExistingCard/);
assert.match(cardLink, /cardState\(tenantId, account\.phone\)/);
assert.match(cardLink, /accounts:\s*uniqueStrings\(\[\.\.\.accountIds\(card\.owner\.person\), accountId\]\)/);

console.log('telegram-miniapp.test.mjs: ok');
