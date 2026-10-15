import assert from 'node:assert/strict';
import fs from 'node:fs';
import { getBookingTimeRows } from '../online-booking/model.js';

const owner = fs.readFileSync('ui/record/creation-flow.js', 'utf8');
const journal = fs.readFileSync('journal/record-creation-x.js', 'utf8');
const booking = fs.readFileSync('online-booking/booking-x.js', 'utf8');
const day = fs.readFileSync('journal/день.js', 'utf8');

assert.match(owner, /variant: 'x'/);
assert.match(owner, /data-record-creation-body/);
assert.doesNotMatch(owner, /mountV2ZLayer|variant: 'q'/);
assert.match(day, /import\('\.\/record-creation-x\.js'\)/);
assert.match(journal, /step: 'time'[\s\S]*renderProcedures/);
assert.match(journal, /step: 'procedures'[\s\S]*label: 'Далее'/);
assert.match(journal, /step: 'person'/);
assert.match(journal, /step: 'confirmation'[\s\S]*label: 'Подтвердить'/);
assert.doesNotMatch(journal, /openPersonCreate|openProcedureEditor|assignProceduresToWorkplace|bindRecordSettings/);
assert.match(booking, /workplaces\.length === 1/);
assert.match(booking, /step: 'procedures'/);
assert.match(booking, /step: 'date'/);
assert.match(booking, /step: 'time'/);
assert.match(booking, /step: 'confirmation'/);
assert.doesNotMatch(booking, /mountV2ZLayer|booking-step-z|v2Header\(|v2Shell\(/);

const context = {
  workplaces: [{ key: 'w1', name: 'A', timeZone: 'Europe/Moscow', from: '10:00', to: '14:00' }],
  procedures: [{ id: 'p1', name: 'P', duration: 30, workplaces: [{ workplaceId: 'w1' }] }],
  days: [{ workplaceId: 'w1', date: '2026-10-20', from: '10:00', to: '14:00' }],
  occupancy: [{ id: 'r1', workplaceId: 'w1', date: '2026-10-20', from: '11:00', to: '11:30' }],
};
const rows = getBookingTimeRows(context, {
  workplaceKey: 'w1',
  date: '2026-10-20',
  procedureIds: ['p1'],
  step: 15,
  now: new Date('2026-10-19T08:00:00Z'),
});
const occupied = rows.find((row) => row.from === '11:00');
const free = rows.find((row) => row.from === '11:30');
assert.equal(occupied?.available, false, 'occupied slot must remain present but unavailable');
assert.equal(occupied?.occupied, true, 'occupied slot must be explicitly marked');
assert.equal(occupied?.disabled, true, 'occupied slot must not be selectable');
assert.equal(free?.available, true, 'adjacent free slot must remain selectable');

console.log('RecordCreation X flow tests passed');
