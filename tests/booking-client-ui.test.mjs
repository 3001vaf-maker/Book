import assert from 'node:assert/strict';
import fs from 'node:fs';

const booking = fs.readFileSync('online-booking/booking.js', 'utf8');
const bookingUi = fs.readFileSync('ui/booking/index.js', 'utf8');
const bookingCss = fs.readFileSync('ui/booking/booking.css', 'utf8');

assert.match(booking, /bookingAccountHeader\(\)/);
assert.match(booking, /bookingPersonalDataButton\(\)/);
assert.match(booking, /bookingHistoryCards\(/);
assert.match(booking, /meta:\s*\[\s*\{ value: money\(subtotal\), label: 'Стоимость' \}/);
assert.doesNotMatch(booking, /durationText\(duration\)/);
assert.match(bookingUi, /Утро/);
assert.match(bookingUi, /День/);
assert.match(bookingUi, /Вечер/);
assert.match(bookingCss, /booking-client--center/);
assert.match(bookingCss, /booking-account-header__actions/);

console.log('booking client UI tests passed');
