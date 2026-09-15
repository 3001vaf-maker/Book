import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const bookingHtml = await readFile(new URL('../booking/index.html', import.meta.url), 'utf8');
const bookingApp = await readFile(new URL('../online-booking/app.js', import.meta.url), 'utf8');
const accountShell = await readFile(new URL('../online-booking/account-shell.js', import.meta.url), 'utf8');
const profileForm = await readFile(new URL('../online-booking/personal-data.js', import.meta.url), 'utf8');
const passwordForm = await readFile(new URL('../online-booking/password-settings.js', import.meta.url), 'utf8');
const consentForm = await readFile(new URL('../online-booking/consent-settings.js', import.meta.url), 'utf8');
const bookingApi = await readFile(new URL('../core/booking-account/index.js', import.meta.url), 'utf8');
const ui = await readFile(new URL('../ui/shell/index.js', import.meta.url), 'utf8');
const nav = await readFile(new URL('../ui/navigation/navigation.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../css/style.css', import.meta.url), 'utf8');

// Book root can enter a client account, while the dedicated /booking link stays compatible.
assert.match(html, /online-booking\/app\.js/);
assert.match(bookingHtml, /online-booking\/app\.js/);
assert.match(bookingApp, /renderClientAccount/);
assert.match(bookingApp, /getBookingContext/);
assert.match(bookingApp, /prepareBookingAccount/);
assert.match(bookingApp, /registerBookingAccount/);
assert.match(bookingApp, /loginBookingAccount/);
assert.match(bookingApp, /getBookingAccountToken/);
assert.match(bookingApp, /clearBookingAccount/);
assert.doesNotMatch(bookingApp, /localStorage/);

// Client navigation stays a shared UI primitive, not a local hand-made bar.
assert.match(ui, /clientBottomNavigation/);
assert.match(nav, /navigationBar/);
assert.match(accountShell, /clientBottomNavigation\(state\.clientTab/);
assert.doesNotMatch(accountShell, /<nav/);
assert.doesNotMatch(accountShell, /<button[^>]*data-client-nav/);
assert.match(css, /\.bottom-nav--client/);

// Profile card and history use shared UI primitives and the current booking account state.
assert.match(accountShell, /entityCard\(/);
assert.match(accountShell, /title: 'Профиль'/);
assert.match(accountShell, /title: 'История'/);
assert.match(accountShell, /title: 'Сообщения'/);
assert.match(accountShell, /getBookingAccount\(state\.tenantId\)/);
assert.match(accountShell, /const source = Array\.isArray\(account\.programs\) \? account\.programs : \[\]/);
assert.doesNotMatch(accountShell, /label: 'Депозит'/);
assert.doesNotMatch(accountShell, /label: 'Личный счёт'/);
assert.match(accountShell, /app-media-rail--placeholder/);
assert.match(accountShell, /openClientPersonalData/);
assert.match(accountShell, /openClientPasswordSettings/);
assert.match(accountShell, /openClientConsentSettings/);
assert.match(accountShell, /label: 'Изменить пароль'/);
assert.match(accountShell, /label: 'Согласия'/);
assert.match(accountShell, /data-client-consents/);
assert.match(accountShell, /data-chat-consents/);
assert.match(accountShell, /listEntry\(\{\s*columns:/s);
assert.match(accountShell, /variant: 'large'/);
assert.match(accountShell, /readOnlyReceipt\(/);
assert.match(accountShell, /label: 'Повторить запись'/);
assert.doesNotMatch(accountShell, /label: 'Повторить процедуру'/);
assert.match(accountShell, /action: \{ label: 'Записаться'/);
assert.match(accountShell, /messageComposer\(\{ attachments: true, rich: true \}\)/);
assert.match(accountShell, /bindRichTextEditor\(form\)/);
assert.match(accountShell, /data-message-attachment/);
assert.match(accountShell, /sendBookingChatMessage\(state\.tenantId, \{ body: value\.body, content: value\.content, attachments \}\)/);
assert.match(accountShell, /className: 'app-view-shell--chat'/);
assert.match(accountShell, /getBookingRequests\(state\.tenantId\)\.catch\(\(\) => \[\]\)/);
assert.match(accountShell, /data-client-chat-settings/);
assert.match(accountShell, /getBookingChatSettings\(state\.tenantId\)/);
assert.match(accountShell, /setBookingTelegramConsent\(state\.tenantId, !telegram\.enabled\)/);
assert.match(accountShell, /label: 'Telegram'.*checked: Boolean\(telegram\.enabled\).*disabled: !telegram\.linked/s);
assert.doesNotMatch(accountShell, /Promise\.allSettled\(unread/);
assert.doesNotMatch(accountShell, /markBookingNotificationRead\(state\.tenantId, item\.notificationId\)/);
assert.match(accountShell, /markBookingNotificationRead\(state\.tenantId, message\.notificationId\)/);
assert.match(accountShell, /node\.addEventListener\('click', \(\) => void openNotification\(\)\)/);

// Personal-data modal uses the Book controls, including Book calendar.
assert.match(profileForm, /photoField\(\{ name: 'photo'/);
assert.match(profileForm, /addLabel: '\+ Телефон'/);
assert.match(profileForm, /addLabel: '\+ Email'/);
assert.match(profileForm, /showEmptyRow: false/);
assert.match(profileForm, /monthDayPicker\(/);
assert.match(profileForm, /initMonthDayPickers\(/);
assert.match(profileForm, /saveBookingAccount/);
assert.doesNotMatch(profileForm, /<input[^>]+type=['"]date['"]/i);

// Account preferences and consent actions remain server-backed.
assert.match(passwordForm, /changeBookingPassword/);
assert.match(consentForm, /getBookingConsentState/);
assert.match(consentForm, /submitBookingConsents/);
assert.match(consentForm, /revokeBookingConsent/);
assert.match(bookingApi, /account\/me/);
assert.match(bookingApi, /account\/password/);
assert.match(bookingApi, /account\/consent-state/);
assert.match(bookingApi, /account\/consents/);
assert.match(bookingApi, /account\/chat/);
assert.match(bookingApi, /account\/push/);

console.log('booking client ui tests: OK');
