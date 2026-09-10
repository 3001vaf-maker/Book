import assert from 'node:assert/strict';
import { createDay } from '../core/day.js';
import { recordPaymentIncome } from '../core/dds.js';
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
store.set('book.people', JSON.stringify([{ key: 'client-1', name: 'Анна', surname: 'Тест', phones: ['+70000000000'], discountPercent: 20 }]));

const record = createRecord({
  date: '2026-09-10',
  workplaceId: 'studio',
  from: '10:00',
  to: '11:00',
  client: { key: 'client-1', name: 'Анна', surname: 'Тест', phone: '+70000000000' },
  procedures: [{ id: 'procedure-1', name: 'Стрижка', cost: 5000, duration: 60 }],
});
assert.ok(record);
assert.equal(record.procedures[0].cost, 5000);
assert.equal(record.finance.serviceTotal, 5000);
assert.equal(record.finance.discountPercent, 20);
assert.equal(record.finance.discountTotal, 1000);
assert.equal(record.finance.planTotal, 4000);

const corrected = updateRecord(record.id, {
  procedures: [{ id: 'procedure-1', name: 'Стрижка', cost: 8000, duration: 60 }],
});
assert.equal(corrected.procedures[0].cost, 8000);
assert.equal(corrected.finance.serviceTotal, 8000);
assert.equal(corrected.finance.discountTotal, 1600);
assert.equal(corrected.finance.planTotal, 6400);

const moved = moveRecord(record.id, { date: '2026-09-11', workplaceId: 'studio', from: '12:00', to: '13:00' });
assert.equal(moved?.date, '2026-09-11');
assert.equal(moved?.from, '12:00');
assert.equal(moved?.finance?.planTotal, 6400);

const noShow = updateRecord(record.id, { attendance: 'no-show' });
assert.equal(noShow?.attendance, 'no-show');
assert.equal(recordVisualState(noShow), 'no-show');

const payment = recordPaymentIncome({
  source: { type: 'record', id: record.id },
  workplace: 'Студия',
  client: { key: 'client-1', name: 'Анна Тест' },
  business: noShow.finance,
  allocations: [{ walletId: 'cash', walletName: 'Наличные', amount: 6400 }],
});
assert.ok(payment);
assert.equal(payment.business.serviceTotal, 8000);
assert.equal(payment.business.discountTotal, 1600);
assert.equal(payment.total, 6400);
assert.equal(recordVisualState(noShow, { paid: true }), 'paid');

const attended = updateRecord(record.id, { attendance: 'arrived' });
assert.equal(attended?.procedures?.[0]?.cost, 8000);
assert.equal(attended?.finance?.planTotal, 6400);
assert.equal(attended?.finance?.factTotal, 6400);
assert.equal(getRecords()[0]?.procedures?.[0]?.cost, 8000);
assert.equal(getRecords()[0]?.finance?.planTotal, 6400);

const metadata = getClientMetadata('client-1');
assert.equal(metadata.recordCount, 1);
assert.equal(metadata.paidTotal, 6400);
assert.equal(metadata.lastVisit, '2026-09-11');

const listRoot = {
  innerHTML: '',
  querySelector: () => null,
};
renderJournalList(listRoot, { mode: 'flow' });
assert.match(listRoot.innerHTML, /journal-list-record--paid/);
assert.match(listRoot.innerHTML, /Анна Тест/);
assert.match(listRoot.innerHTML, /6 400 ₽/);
assert.equal(getRecords().length, 1);

console.log('critical record flow tests: OK');
