import fs from 'node:fs';

const core = fs.readFileSync('core.js', 'utf8');
const owner = fs.readFileSync('ui/record/creation-flow.js', 'utf8');
const journal = fs.readFileSync('journal/record-creation-x.js', 'utf8');
const day = fs.readFileSync('journal/день.js', 'utf8');
const booking = fs.readFileSync('online-booking/booking-x.js', 'utf8');
const model = fs.readFileSync('online-booking/model.js', 'utf8');
const recordCss = fs.readFileSync('ui/record/record.css', 'utf8');
const failures = [];
const expect = (value, message) => { if (!value) failures.push(message); };

expect(core.includes("import { renderOnlineBookingX as renderOnlineBooking } from './online-booking/booking-x.js';"), 'Public booking runtime must use booking-x.js.');
expect(!core.includes("renderGlobalClient, renderOnlineBooking } from './online-booking/booking.js'"), 'Legacy booking.js must not own active booking creation.');
expect(owner.includes("variant: 'q'"), 'RecordCreation is a large working flow and must use the canonical Q modal.');
expect(!owner.includes("variant: 'x'") && !owner.includes('xRole:'), 'RecordCreation must not masquerade as an oversized X modal.');
expect(owner.includes('data-record-creation-body'), 'RecordCreation owner must replace one body between steps.');
expect(!owner.includes('mountV2ZLayer'), 'RecordCreation owner must not create Z step layers.');
expect(!/modal--bottom[^\n{]*record-creation|record-creation[^\n{]*modal--bottom|92dvh/.test(recordCss), 'Feature CSS must not override canonical X geometry to fit RecordCreation.');
expect(day.includes("import('./record-creation-x.js')"), 'Journal Day must launch the shared RecordCreation flow.');
expect(journal.includes('openRecordCreationOwner('), 'Journal creation must use Shared RecordCreation owner.');
expect(!journal.includes('mountRecordZ') && !journal.includes('mountV2ZLayer') && !journal.includes('bindRecordSettings'), 'Journal creation must not restore the old Z/settings flow.');
expect(!journal.includes('openPersonCreate') && !journal.includes('openProcedureEditor') && !journal.includes('assignProceduresToWorkplace'), 'External People/Service creation must stay outside this migration.');
expect(booking.includes('openRecordCreationOwner('), 'End-user creation must use Shared RecordCreation owner.');
expect(!booking.includes('mountV2ZLayer') && !booking.includes('v2ZLayer(') && !booking.includes('v2Header(') && !booking.includes('v2Shell('), 'End-user creation must not own Z stack or A/B/C/D shell.');
expect(booking.includes('workplaces.length === 1'), 'One end-user workplace must be auto-resolved without a workplace step.');
expect(booking.includes("step: 'workplace'") && booking.includes("step: 'procedures'") && booking.includes("step: 'date'") && booking.includes("step: 'time'") && booking.includes("step: 'confirmation'"), 'End-user creation must keep canonical steps in one Q.');
expect(booking.includes('recordCreationTimeRows(rows') && booking.includes('getBookingTimeRows('), 'End-user time must keep blocked time visible through shared rows.');
expect(model.includes('export function getBookingTimeRows'), 'Booking model must expose full time-row state, not only free slots.');
expect(!booking.includes('recordConfirmationEditStep') && !journal.includes('recordConfirmationEditStep'), 'Creation confirmation must not contain correction navigation.');

if (failures.length) {
  console.error('RecordCreation architecture check failed:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log('RecordCreation Q architecture check passed.');
