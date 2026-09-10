import assert from 'node:assert/strict';
import { createDay } from '../core/day.js';
import { createPaymentDraft, completePayment, getCompletedPaymentForSource } from '../core/payment.js';
import { createRecord, getRecords, moveRecord, updateRecord } from '../journal/record-data.js';
import { recordVisualState } from '../journal/record-state.js';
import { renderJournalList } from '../journal/список.js';
import { getClientMetadata } from '../main/clients/metadata.js';

const store = new Map();
globalThis.localStorage = {
  getItem: (key) => store.has(key) ? store.get(key) : null,
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
};
globalThis.requestAnimationFrame = (callback) => callback();

const days = [
  createDay({ date: '2026-09-10', workplaceId: 'studio', from: '09:00', to: '18:00' }),
  createDay({ date: '2026-09-11', workplaceId: 'studio', from: '09:00', to: '18:00' }),
];
store.set('book:timetable-state', JSON.stringify({ workingDays: days }));

const record = createRecord({
  date: '2026-09-10',
  workplaceId: 'studio',
  from: '10:00',
  to: '11:00',
  client: { key: 'client-1', name: 'Анна', surname: 'Тест', phone: '+70000000000' },
  procedures: [{ id: 'procedure-1', name: 'Стрижка', cost: 5000, duration: 60 }],
});
assert.ok(record);

const moved = moveRecord(record.id, { date: '2026-09-11', workplaceId: 'studio', from: '12:00', to: '13:00' });
assert.equal(moved?.date, '2026-09-11');
assert.equal(moved?.from, '12:00');

const noShow = updateRecord(record.id, { attendance: 'no-show' });
assert.equal(noShow?.attendance, 'no-show');
assert.equal(recordVisualState(noShow), 'no-show');

const draft = createPaymentDraft({
  source: { type: 'record', id: record.id },
  workplace: 'Студия',
  client: { uei: '', name: 'Анна Тест' },
  items: noShow.procedures,
  now: new Date('2026-09-11T13:05:00.000Z'),
});
const payment = completePayment(draft, {
  walletId: 'cash',
  walletName: 'Наличные',
  items: draft.items,
  total: 5000,
});
assert.ok(payment);
assert.equal(getCompletedPaymentForSource('record', record.id)?.id, payment.id);
assert.equal(recordVisualState(noShow, { paid: true }), 'paid');

const metadata = getClientMetadata('client-1');
assert.equal(metadata.recordCount, 1);
assert.equal(metadata.paidTotal, 5000);
assert.equal(metadata.lastVisit, '2026-09-11');

const listRoot = {
  innerHTML: '',
  querySelector: () => null,
};
renderJournalList(listRoot, { mode: 'flow' });
assert.match(listRoot.innerHTML, /journal-list-record--paid/);
assert.match(listRoot.innerHTML, /Анна Тест/);
assert.equal(getRecords().length, 1);

console.log('critical record flow tests: OK');
