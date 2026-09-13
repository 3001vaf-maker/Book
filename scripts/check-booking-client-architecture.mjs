import fs from 'node:fs';

const booking = fs.readFileSync('online-booking/booking.js', 'utf8');
const accountShell = fs.readFileSync('online-booking/account-shell.js', 'utf8');
const consentSettings = fs.readFileSync('online-booking/consent-settings.js', 'utf8');
const settings = fs.readFileSync('settings/online-booking/online-booking.js', 'utf8');
const serverSync = fs.readFileSync('online-booking/server-sync.js', 'utf8');
const bookingUi = fs.readFileSync('ui/booking/index.js', 'utf8');
const shellUi = fs.readFileSync('ui/shell/index.js', 'utf8');
const shellCss = fs.readFileSync('ui/shell/shell.css', 'utf8');
const clientMobileCss = fs.readFileSync('ui/shell/client-mobile.css', 'utf8');

const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

expect(booking.includes("from '../core/booking-settings/index.js'"), 'Public booking must consume canonical booking settings.');
expect(booking.includes('appShell({'), 'Booking workflow must use the shared App Shell.');
expect(booking.includes('appHeader({ title, back, action })'), 'Booking workflow must use the shared stable A/title/B/C header.');
expect(booking.includes('bookingThemeStyle(state.settings)'), 'Booking workflow must keep the master-selected booking theme.');
expect(!booking.includes('bookingScreen('), 'Booking workflow must not return to the legacy separate booking screen shell.');
expect(booking.includes('bookingChoiceCards('), 'Public booking choices must use shared booking choice UI.');
expect(booking.includes('bookingTimeGroups('), 'Public booking time must use shared grouped time UI.');
expect(booking.includes('initCalendar('), 'Public booking date must use the shared Book calendar.');
expect(!booking.includes("type: 'date'"), 'Public booking must not use native technical date controls.');
expect(booking.includes('renderAgreements') && booking.includes('renderWorkplaces') && booking.includes('renderProcedures') && booking.includes('renderDates') && booking.includes('renderTimes') && booking.includes('renderConfirmation'), 'Booking workflow must preserve the agreed booking sequence.');
expect(booking.includes('renderClientAccount'), 'Authenticated client account must use the unified client shell.');
expect(!booking.includes('step: 15'), 'Public booking must not hardcode a 15 minute slot step.');
expect(settings.includes("from '../../core/booking-settings/index.js'"), 'Online booking settings must use canonical booking settings owner.');
expect(settings.includes('Отменить изменения'), 'Online booking style drafts must provide a cancel path before save.');
expect(serverSync.includes("apiRequest('/business-state')"), 'Open Book must refresh from canonical server business state.');
expect(shellUi.includes('appHeader'), 'Shared UI must own stable A/title/B/C header.');
expect(shellUi.includes("variant: 'secondary'"), 'Shared header secondary controls must use the canonical light button role.');
expect(shellUi.includes('clientBottomNavigation'), 'Shared UI must own client bottom navigation.');
expect(shellUi.includes('messageComposer'), 'Shared UI must own messenger composer.');
expect(shellUi.includes('readOnlyReceipt'), 'Shared UI must own read-only receipt sheet.');
expect(shellCss.includes('--shell-icon-slot'), 'Shared shell CSS must own stable header slots.');
expect(shellCss.includes('.app-view-shell--chat') && shellCss.includes('.message-composer{position:fixed'), 'Shared shell CSS must keep chat composer fixed while the thread scrolls.');
expect(clientMobileCss.includes('--app-max-width:390px'), 'Client application must keep the compact phone-width contract.');
expect(!clientMobileCss.includes('max-width:none'), 'Client application must never disable its phone-width limit.');
expect(!accountShell.includes("document.createElement('style')") && !accountShell.includes('<style>'), 'Client features must not own local CSS.');
expect(accountShell.includes("messageComposer({ attachments: true })"), 'Client chat must use the shared composer with media attachment control.');
expect(accountShell.includes("label: 'Повторить запись'"), 'Client history must use the agreed repeat-booking action.');
expect(accountShell.includes("label: 'Согласия'"), 'Client account and chat settings must expose consent controls.');
expect(consentSettings.includes('revokeBookingConsent'), 'Client consent settings must use the canonical server-backed revoke flow.');
expect(bookingUi.includes('bookingChoiceCards'), 'Shared booking UI must continue to own booking choice controls.');

if (failures.length) {
  failures.forEach((message) => console.error(`booking client architecture: ${message}`));
  process.exit(1);
}
console.log('booking client architecture check: OK');
