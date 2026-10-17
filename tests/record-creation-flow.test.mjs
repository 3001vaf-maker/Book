import assert from 'node:assert/strict';
import fs from 'node:fs';
import { getBookingTimeRows } from '../online-booking/model.js';

const owner = fs.readFileSync('ui/record/creation-flow.js', 'utf8');
const journal = fs.readFileSync('journal/record.js', 'utf8');
const creationStart = journal.indexOf('export function openRecordCreation');
const editStart = journal.indexOf('function selectedRecordProcedures');
const journalCreation = journal.slice(creationStart, editStart > creationStart ? editStart : journal.length);
const booking = fs.readFileSync('online-booking/booking-x.js', 'utf8');
const day = fs.readFileSync('journal/день.js', 'utf8');
const recordCss = fs.readFileSync('ui/record/record.css', 'utf8');
const timeCss = fs.readFileSync('ui/time/time.css', 'utf8');

assert.match(owner, /variant: 'q'/);
assert.doesNotMatch(owner, /variant: 'x'|xRole:/);
assert.match(owner, /data-record-creation-body/);
assert.match(owner, /data-record-creation-action/);
assert.match(owner, /footer = ''/);
assert.doesNotMatch(owner, /mountV2ZLayer/);
assert.match(owner, /workplace: 'Выбор пространства'/);
assert.match(owner, /procedures: 'Выбор процедур'/);
assert.match(owner, /date: 'Выбор даты'/);
assert.match(owner, /time: 'Выбор времени'/);
assert.match(owner, /person: 'Выбор клиента'/);
assert.match(owner, /confirmation: 'Подтверждение записи'/);
assert.match(owner, /'break-start': 'Выбор времени С'/);
assert.match(owner, /'break-end': 'Выбор времени До'/);
assert.match(owner, /'Выбор времени начала', 'Выбор времени С'/);
assert.match(owner, /'Выбор времени до скольки', 'Выбор времени До'/);
assert.doesNotMatch(owner, /record-creation-time-row__hour/);
assert.doesNotMatch(owner, /time-slots--record-vertical|const groups = new Map|time-slots--hour-rows/);
assert.match(timeCss, /\.time-slots\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
assert.match(recordCss, /record-creation-flow__title h2\{[^}]*font-size:20px/);
assert.match(recordCss, /grid-template-rows:auto minmax\(0,1fr\) auto/);
assert.match(recordCss, /record-creation-flow__body\{[^}]*overflow:auto/);
assert.match(recordCss, /record-creation-flow__action\{[^}]*display:grid/);
assert.doesNotMatch(recordCss, /modal--bottom[^\n{]*record-creation|record-creation[^\n{]*modal--bottom|92dvh/);
assert.match(day, /import\('\.\/record\.js'\)/);
assert.equal(fs.existsSync('journal/record-creation-x.js'), false);
assert.equal(fs.existsSync('journal/record-edit.js'), false);
assert.match(journal, /label: 'Запись'/);
assert.match(journal, /label: 'Занять время'/);
assert.match(journalCreation, /initViewNavigation/);
assert.match(journalCreation, /state\.mode === 'block'[\s\S]*renderBlockEnd/);
assert.match(journalCreation, /title: 'Выбор времени до скольки'/);
assert.match(journalCreation, /title: 'Подтверждение перерыва'/);
assert.match(journalCreation, /createJournalBreak/);
assert.match(journalCreation, /step: 'time'[\s\S]*renderProcedures/);
assert.match(journalCreation, /step: 'procedures'[\s\S]*label: 'Далее'/);
assert.match(journalCreation, /step: 'person'/);
assert.match(journalCreation, /step: 'confirmation'[\s\S]*label: 'Подтвердить'/);
assert.match(journalCreation, /button\('Добавить из прайса'/);
assert.match(journalCreation, /button\('\+ Добавить процедуру'/);
assert.match(journalCreation, /button\('\+ Добавить клиента'/);
assert.match(journalCreation, /openPersonCreate/);
assert.match(journalCreation, /openProcedureEditor/);
assert.match(journalCreation, /assignProceduresToWorkplace/);
assert.doesNotMatch(journalCreation, /mountRecordZ|bindRecordSettings/);
assert.match(booking, /workplaces\.length === 1/);
assert.match(booking, /step: 'procedures'/);
assert.match(booking, /step: 'date'/);
assert.match(booking, /step: 'time'/);
assert.match(booking, /step: 'confirmation'/);
assert.doesNotMatch(booking, /mountV2ZLayer|booking-step-z|v2Header\(|v2Shell\(/);

// Public booking must not serialize independent startup/legal network requests.
assert.match(booking, /Promise\.all\(\[\s*refreshContext\(state\),\s*getAccount\(state\.tenantId\),\s*\]\)/);
assert.match(booking, /Promise\.all\(\[\s*getAccountPlatformState\(state\.tenantId\),\s*getAccountConsentState\(state\.tenantId\)/);

// Date -> time uses one row calculation, not a second duplicate free-slot pass.
const publicTimesStart = booking.indexOf('function renderTimes(state)');
const publicTimesEnd = booking.indexOf('function confirmationCard', publicTimesStart);
const publicTimes = booking.slice(publicTimesStart, publicTimesEnd);
assert.match(publicTimes, /getBookingTimeRows\(/);
assert.doesNotMatch(publicTimes, /getBookingSlots\(/);

// Confirmation reacts immediately and relies on server-side conflict validation instead of a pre-submit context round-trip.
const finalizeStart = booking.indexOf('async function finalizeBookingRequest');
const finalizeEnd = booking.indexOf('function startBookingFlow', finalizeStart);
const finalizeBlock = booking.slice(finalizeStart, finalizeEnd);
const createIndex = finalizeBlock.indexOf('await createBookingRequest');
assert.ok(createIndex > 0, 'booking confirmation must submit through createBookingRequest');
assert.doesNotMatch(finalizeBlock.slice(0, createIndex), /await refreshContext\(/);
assert.match(finalizeBlock, /if \(state\.confirming\) return/);
assert.match(finalizeBlock, /action\.textContent = 'Записываем…'/);
assert.match(booking, /action\.textContent = 'Сохраняем…'/);
assert.match(booking, /submit\.textContent = 'Входим…'/);

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

const naturalRows = getBookingTimeRows(context, {
  workplaceKey: 'w1',
  date: '2026-10-20',
  procedureIds: ['p1'],
  step: 0,
  now: new Date('2026-10-19T08:00:00Z'),
});
assert.deepEqual(
  naturalRows.map((row) => row.from),
  ['10:00', '11:00', '11:30', '12:00', '13:00'],
  'without an explicit booking step, public booking must show exact hours plus real occupied-end boundaries',
);
assert.equal(naturalRows.find((row) => row.from === '11:00')?.disabled, true);
assert.equal(naturalRows.find((row) => row.from === '11:30')?.available, true);
assert.equal(naturalRows.some((row) => row.from === '10:15'), false);

console.log('RecordCreation Q flow tests passed');