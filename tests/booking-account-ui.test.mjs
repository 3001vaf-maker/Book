import assert from 'node:assert/strict';
import fs from 'node:fs';

const originalRead = fs.readFileSync.bind(fs);
const legacy = originalRead('online-booking/booking-legacy.js', 'utf8');
const flow = originalRead('online-booking/booking-x.js', 'utf8');
const wrapper = originalRead('online-booking/booking.js', 'utf8');
const journalFlow = originalRead('journal/record-creation-x.js', 'utf8');
const journalDay = originalRead('journal/день.js', 'utf8');
const sharedCreation = originalRead('ui/record/creation-flow.js', 'utf8');
const timeUi = originalRead('ui/time/index.js', 'utf8');

fs.readFileSync = (path, ...args) => {
  if (String(path) === 'online-booking/booking.js') return `${legacy}\n${flow}`;
  return originalRead(path, ...args);
};
try {
  await import('./booking-account-ui-legacy.test.mjs');
} finally {
  fs.readFileSync = originalRead;
}

assert.match(wrapper, /from '\.\/booking-x\.js'/, 'active booking wrapper must route creation to X flow');
assert.match(flow, /openRecordCreationOwner\(/, 'client booking must use shared RecordCreation owner');
assert.doesNotMatch(flow, /mountV2ZLayer|booking-step-z|v2ZLayer\(/, 'active client booking must not create Z step layers');
assert.doesNotMatch(flow, /v2Header\(|v2Shell\(/, 'record creation must not replace A\/B\/C\/D');
assert.match(flow, /workplaces\.length === 1[\s\S]*state\.workplaceKey = String\(workplaces\[0\]\?\.key \|\| ''\)/, 'one workplace must skip workplace step');
assert.match(flow, /recordCreationTimeRows\(rows/, 'client time must use shared hour-row manifestation');
assert.match(flow, /getBookingTimeRows\(/, 'client time must keep occupied\/blocked slots visible');
assert.match(flow, /step: 'workplace'/);
assert.match(flow, /step: 'procedures'/);
assert.match(flow, /step: 'date'/);
assert.match(flow, /step: 'time'/);
assert.match(flow, /step: 'confirmation'/);
assert.match(journalDay, /import\('\.\/record-creation-x\.js'\)/, 'journal must invoke new creation flow');
assert.match(journalFlow, /openRecordCreationOwner\(/, 'journal and client must share the X owner');
assert.doesNotMatch(journalFlow, /mountRecordZ|bindRecordSettings|openPersonCreate|openProcedureEditor|assignProceduresToWorkplace/);
assert.match(sharedCreation, /variant: 'x'/);
assert.doesNotMatch(sharedCreation, /mountV2ZLayer|variant: 'q'/);
assert.match(timeUi, /slot\.disabled\|\|slot\.available===false/, 'shared time slots must support disabled occupied slots');

console.log('active RecordCreation X flow UI tests passed');
