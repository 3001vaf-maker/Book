import assert from 'node:assert/strict';
import fs from 'node:fs';

const booking = fs.readFileSync('online-booking/booking.js', 'utf8');
const accountShell = fs.readFileSync('online-booking/account-shell.js', 'utf8');
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
