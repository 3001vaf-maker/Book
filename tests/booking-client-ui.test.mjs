import assert from 'node:assert/strict';
import fs from 'node:fs';

const booking = fs.readFileSync('online-booking/booking.js', 'utf8');
const accountShell = fs.readFileSync('online-booking/account-shell.js', 'utf8');
const bookingAccountApi = fs.readFileSync('core/booking-account/index.js', 'utf8');
const onlineBookingController = fs.readFileSync('server/src/online-booking/online-booking.controller.ts', 'utf8');
const consentPolicy = fs.readFileSync('server/src/document-state/consent-policy.service.ts', 'utf8');
const telegramBot = fs.readFileSync('server/src/communication/telegram-bot.service.ts', 'utf8');
const shellUi = fs.readFileSync('ui/shell/index.js', 'utf8');
const shellCss = fs.readFileSync('ui/shell/shell.css', 'utf8');
const bookingUi = fs.readFileSync('ui/booking/index.js', 'utf8');

assert.match(booking, /renderClientAccount/);
assert.match(booking, /bookingChoiceCards\(/);
assert.match(booking, /bookingTimeGroups\(/);
assert.match(booking, /meta:\s*\[\s*\{ value: money\(subtotal\), label: 'Стоимость' \}/);
assert.match(booking, /onRepeat:/);
assert.doesNotMatch(booking, /−\$\{discount\}/);
assert.doesNotMatch(booking, /durationText\(duration\)/);

assert.match(accountShell, /clientProfileCard\(/);
assert.match(accountShell, /label: 'Стоимость'/);
assert.match(accountShell, /label: 'Скидка'/);
assert.match(accountShell, /label: 'Оплачено'/);
assert.match(accountShell, /listEntry\(\{\s*columns:/s);
assert.match(accountShell, /variant: 'large'/);
assert.match(accountShell, /readOnlyReceipt\(/);
assert.match(accountShell, /label: 'Повторить процедуру'/);
assert.match(accountShell, /action: \{ label: 'Записаться'/);
assert.match(accountShell, /messageComposer\(/);
assert.match(accountShell, /data-client-chat-settings/);
assert.match(accountShell, /getBookingChatSettings\(state\.tenantId\)/);
assert.match(accountShell, /setBookingTelegramConsent\(state\.tenantId, !telegram\.enabled\)/);
assert.match(accountShell, /label: 'Telegram'.*checked: Boolean\(telegram\.enabled\).*disabled: !telegram\.linked/s);
assert.doesNotMatch(accountShell, /Promise\.allSettled\(unread/);
assert.doesNotMatch(accountShell, /markBookingNotificationRead\(state\.tenantId, item\.notificationId\)/);
assert.match(accountShell, /markBookingNotificationRead\(state\.tenantId, message\.notificationId\)/);
assert.match(accountShell, /node\.addEventListener\('click', \(\) => void openNotification\(\)\)/);

assert.match(bookingAccountApi, /account\/chat\/settings/);
assert.match(bookingAccountApi, /account\/chat\/telegram-consent/);
assert.match(onlineBookingController, /contactPointConsentState\([\s\S]*?'TELEGRAM'[\s\S]*?identity\.externalUserId[\s\S]*?'messages-consent'/);
assert.match(onlineBookingController, /acceptContactPointConsent\([\s\S]*?'TELEGRAM'[\s\S]*?identity\.externalUserId[\s\S]*?'client-chat-settings'/);
assert.match(onlineBookingController, /revokeContactPointConsent\([\s\S]*?'TELEGRAM'[\s\S]*?identity\.externalUserId[\s\S]*?'client-chat-settings'/);
assert.match(consentPolicy, /async canSendMessages\(tenantId: string, typeValue: unknown, value: unknown\)/);
assert.match(telegramBot, /canSendMessages\(tenantId, 'TELEGRAM', identity\.externalUserId\)/);
assert.doesNotMatch(telegramBot, /canSendMessages\(tenantId, personKey/);

assert.match(shellUi, /appHeader/);
assert.match(shellUi, /clientBottomNavigation/);
assert.match(shellUi, /clientProfileCard/);
assert.match(shellUi, /messageThread/);
assert.match(shellUi, /readOnlyReceipt/);
assert.match(shellCss, /grid-template-columns:var\(--shell-icon-slot\) minmax\(0,1fr\) var\(--shell-action-slot\) var\(--shell-icon-slot\)/);
assert.match(shellCss, /bottom-nav--client/);
assert.match(shellCss, /client-profile-card__metric strong/);
assert.match(shellCss, /font-size:clamp\(18px,4\.8vw,20px\)/);
assert.match(bookingUi, /Утро/);
assert.match(bookingUi, /День/);
assert.match(bookingUi, /Вечер/);

console.log('booking client UI tests passed');
