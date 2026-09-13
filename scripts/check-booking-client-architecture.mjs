import fs from 'node:fs';

const booking = fs.readFileSync('online-booking/booking.js', 'utf8');
const accountShell = fs.readFileSync('online-booking/account-shell.js', 'utf8');
const settings = fs.readFileSync('settings/online-booking/online-booking.js', 'utf8');
const serverSync = fs.readFileSync('online-booking/server-sync.js', 'utf8');
const bookingUi = fs.readFileSync('ui/booking/index.js', 'utf8');
const shellUi = fs.readFileSync('ui/shell/index.js', 'utf8');
const shellCss = fs.readFileSync('ui/shell/shell.css', 'utf8');

const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

expect(booking.includes("from '../core/booking-settings/index.js'"), 'Public booking must consume canonical booking settings.');
expect(booking.includes('bookingScreen('), 'Booking workflow must keep shared booking screen UI.');
expect(booking.includes('bookingChoiceCards('), 'Public booking choices must use shared booking choice UI.');
expect(booking.includes('bookingTimeGroups('), 'Public booking time must use shared grouped time UI.');
expect(booking.includes('renderClientAccount'), 'Authenticated client account must use the unified client shell.');
expect(!booking.includes('step: 15'), 'Public booking must not hardcode a 15 minute slot step.');
expect(settings.includes("from '../../core/booking-settings/index.js'"), 'Online booking settings must use canonical booking settings owner.');
expect(serverSync.includes("apiRequest('/business-state')"), 'Open Book must refresh from canonical server business state.');
expect(shellUi.includes('appHeader'), 'Shared UI must own stable A/title/B/C header.');
expect(shellUi.includes('clientBottomNavigation'), 'Shared UI must own client bottom navigation.');
expect(shellUi.includes('messageComposer'), 'Shared UI must own messenger composer.');
expect(shellUi.includes('readOnlyReceipt'), 'Shared UI must own read-only receipt sheet.');
expect(shellCss.includes('--shell-icon-slot'), 'Shared shell CSS must own stable header slots.');
expect(!accountShell.includes("document.createElement('style')") && !accountShell.includes('<style>'), 'Client features must not own local CSS.');
expect(bookingUi.includes('bookingChoiceCards'), 'Shared booking UI must continue to own booking choice controls.');

if (failures.length) {
  failures.forEach((message) => console.error(`booking client architecture: ${message}`));
  process.exit(1);
}
console.log('booking client architecture check: OK');
