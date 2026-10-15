import fs from 'node:fs';

const originalRead = fs.readFileSync.bind(fs);
const legacy = originalRead('online-booking/booking-legacy.js', 'utf8');
const flow = originalRead('online-booking/booking-x.js', 'utf8');
const wrapper = originalRead('online-booking/booking.js', 'utf8');
const journalFlow = originalRead('journal/record-creation-x.js', 'utf8');
const journalDay = originalRead('journal/день.js', 'utf8');
const sharedCreation = originalRead('ui/record/creation-flow.js', 'utf8');

fs.readFileSync = (path, ...args) => {
  if (String(path) === 'online-booking/booking.js') return `${legacy}\n${flow}`;
  return originalRead(path, ...args);
};
try {
  await import('./check-booking-account-architecture-legacy.mjs');
} finally {
  fs.readFileSync = originalRead;
}

const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

expect(wrapper.includes("from './booking-x.js'"), 'Active online booking entry must route booking creation through booking-x.js.');
expect(wrapper.includes("entry === 'account' || entry === 'chat'"), 'Legacy tenant account/profile compatibility may be used only for non-creation account/chat entry.');
expect(flow.includes('openRecordCreationOwner('), 'End-user booking creation must use the one Shared RecordCreation X owner.');
expect(flow.includes('recordCreationTimeRows(') && flow.includes('getBookingTimeRows('), 'End-user booking time must show shared hour rows with unavailable/occupied slots retained.');
expect(!flow.includes('mountV2ZLayer') && !flow.includes("className: 'booking-step-z'") && !flow.includes('v2ZLayer('), 'Active end-user booking creation must not build a Z step stack.');
expect(!flow.includes('v2Header(') && !flow.includes('v2Shell('), 'Record creation X must not take ownership of A/B/C/D or create a second application shell.');
expect(flow.includes('workplaces.length === 1') && flow.includes("state.workplaceKey = String(workplaces[0]?.key || '')"), 'One available workplace must be resolved automatically without a workplace step.');
expect(flow.includes("step: 'workplace'") && flow.includes("step: 'procedures'") && flow.includes("step: 'date'") && flow.includes("step: 'time'") && flow.includes("step: 'confirmation'"), 'Active end-user flow must keep the canonical steps inside one X owner.');
expect(journalDay.includes("import('./record-creation-x.js')"), 'Journal day must launch the dedicated RecordCreation X flow.');
expect(journalFlow.includes('openRecordCreationOwner('), 'Journal creation must use the same Shared RecordCreation X owner.');
expect(!journalFlow.includes('mountRecordZ') && !journalFlow.includes('mountV2ZLayer') && !journalFlow.includes('bindRecordSettings'), 'Journal creation must not recreate the old Z stack or settings owner.');
expect(!journalFlow.includes('openPersonCreate') && !journalFlow.includes('openProcedureEditor') && !journalFlow.includes('assignProceduresToWorkplace'), 'External People/Service creation actions must stay out of this RecordCreation migration.');
expect(sharedCreation.includes("variant: 'x'") && sharedCreation.includes('data-record-creation-body'), 'Shared RecordCreation owner must be one X whose body is replaced between steps.');
expect(!sharedCreation.includes('mountV2ZLayer') && !sharedCreation.includes("variant: 'q'"), 'Shared RecordCreation owner must not stack Z/Q step surfaces.');

if (failures.length) {
  console.error('Booking X architecture check failed:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log('Booking X architecture check passed.');
