import fs from 'node:fs';

const failures = [];
const expect = (value, message) => { if (!value) failures.push(message); };
const read = (path) => fs.readFileSync(path, 'utf8');

const records = read('records/records.js');
const owner = read('ui/record/creation-flow.js');
const day = read('journal/день.js');
const personEntry = read('core/people/record-creation.js');
const booking = read('online-booking/booking.js');
const account = read('online-booking/account.js');
const userEntry = read('online-booking/user-entry.js');

expect(!fs.existsSync('journal/record.js'), 'journal/record.js must not exist.');
expect(!fs.existsSync('journal/record-view.js'), 'journal/record-view.js must not exist.');
expect(!fs.existsSync('journal/record-creation-x.js'), 'journal/record-creation-x.js must not exist.');
expect(!fs.existsSync('online-booking/booking-x.js'), 'booking-x.js must not exist.');
expect(fs.existsSync('journal/journal-view.js'), 'Journal plaque display must live in journal/journal-view.js.');
expect(records.includes('export function openRecords'), 'records/records.js must own the Records flow.');
expect(owner.includes("variant: 'q'"), 'Records must use the canonical Q modal owner.');
expect(day.includes("import('../records/records.js')"), 'Journal Day must call canonical Records.');
expect(day.includes("import('./journal-view.js')"), 'Journal Day must open Journal View for an existing plaque.');
expect(personEntry.includes("from '../../records/records.js'"), 'Person entry must call canonical Records.');
expect(booking.includes("from '../records/records.js'"), 'Booking must call canonical Records.');
expect(!account.includes("from '../records/records.js'"), 'Account must route to Booking and must not own Records.');
expect(account.includes("params.set('booking', id)"), 'Account Booking action must pass tenant identity to the Booking route.');
expect(userEntry.includes("params.get('booking')"), 'End-user entry must resolve the internal Booking route.');
expect(userEntry.includes("from './account.js'"), 'End-user entry must load Account from account.js.');
expect(userEntry.includes("from './booking.js'"), 'End-user entry must load Booking from booking.js.');

if (failures.length) {
  console.error('Records compatibility check failed:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log('Records compatibility check passed.');
