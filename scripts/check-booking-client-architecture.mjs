import fs from 'node:fs';

const booking = fs.readFileSync('online-booking/booking.js', 'utf8');
const settings = fs.readFileSync('settings/online-booking/online-booking.js', 'utf8');
const ownerBridge = fs.readFileSync('online-booking/owner-bridge.js', 'utf8');
const ui = fs.readFileSync('ui/booking/index.js', 'utf8');
const css = fs.readFileSync('ui/booking/booking.css', 'utf8');

const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

expect(booking.includes("from '../core/booking-settings/index.js'"), 'Public booking must consume canonical booking settings.');
expect(booking.includes('bookingScreen('), 'Public booking must use shared booking client screen UI.');
expect(booking.includes('bookingChoiceCards('), 'Public booking choices must use shared booking choice UI.');
expect(booking.includes('bookingTimeGroups('), 'Public booking time must use shared grouped time UI.');
expect(!booking.includes('step: 15'), 'Public booking must not hardcode a 15 minute slot step.');
expect(settings.includes("from '../../core/booking-settings/index.js'"), 'Online booking settings must use canonical booking settings owner.');
expect(ownerBridge.includes('settings: getBookingSettings()'), 'Owner publication must publish canonical booking settings.');
expect(ui.includes('bookingAccountHeader'), 'Shared booking UI must own account header controls.');
expect(css.includes('.booking-client--center'), 'Shared booking CSS must own centered client flow layout.');

if (failures.length) {
  failures.forEach((message) => console.error(`booking client architecture: ${message}`));
  process.exit(1);
}
console.log('booking client architecture check: OK');
