import assert from 'node:assert/strict';
import { calculateFinancialPlan, getFinancialItemFact } from '../core/financial-model.js';
import { createDay } from '../core/day.js';
import { recordPaymentIncome, recordRefundExpense } from '../core/dds.js';
import { createRecord, getRecords, moveRecord, updateRecord } from '../journal/record-data.js';
import { recordVisualState } from '../journal/record-state.js';
import { renderJournalList } from '../journal/список.js';
import { getClientMetadata } from '../main/clients/metadata.js';
import { getWalletBalance } from '../settings/wallets/data.js';

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
store.set('book.people', JSON.stringify([
  { key: 'client-1', name: 'Анна', surname: 'Тест', phones: ['+70000000000'], discountPercent: 20 },
  { key: 'client-2', name: 'Ирина', surname: 'БезСкидки', phones: ['+71111111111'], discountPercent: 0 },
]));

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
  finance: noShow.finance,
  allocations: [{ walletId: 'cash', walletName: 'Наличные', amount: 6400 }],
});
assert.ok(payment);
assert.equal(payment.finance.serviceTotal, 8000);
assert.equal(payment.finance.discountTotal, 1600);
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

// Profile has no discount. Master assigns 20% at payment stage.
const paymentStageRecord = createRecord({
  date: '2026-09-11',
  workplaceId: 'studio',
  from: '14:00',
  to: '15:00',
  client: { key: 'client-2', name: 'Ирина', surname: 'БезСкидки', phone: '+71111111111' },
  procedures: [{ id: 'procedure-2', name: 'Окрашивание', cost: 8000, duration: 60 }],
});
assert.ok(paymentStageRecord);
assert.equal(paymentStageRecord.finance.serviceTotal, 8000);
assert.equal(paymentStageRecord.finance.discountTotal, 0);
assert.equal(paymentStageRecord.finance.planTotal, 8000);

const paymentStagePlan = calculateFinancialPlan(paymentStageRecord.finance.items.map((item) => ({
  ...item,
  discountMode: 'percent',
  discountPercent: 20,
  discountMoney: '',
})));
const paymentStageUpdated = updateRecord(paymentStageRecord.id, { finance: paymentStagePlan });
assert.equal(paymentStageUpdated.procedures[0].cost, 8000);
assert.equal(paymentStageUpdated.finance.serviceTotal, 8000);
assert.equal(paymentStageUpdated.finance.discountPercent, 20);
assert.equal(paymentStageUpdated.finance.discountTotal, 1600);
assert.equal(paymentStageUpdated.finance.planTotal, 6400);
assert.equal(paymentStageUpdated.finance.items[0].discountMode, 'percent');

const paymentStageIncome = recordPaymentIncome({
  source: { type: 'record', id: paymentStageRecord.id },
  workplace: 'Студия',
  client: { key: 'client-2', name: 'Ирина БезСкидки' },
  finance: paymentStageUpdated.finance,
  allocations: [{ walletId: 'cash', walletName: 'Наличные', amount: 6400 }],
});
assert.ok(paymentStageIncome);
assert.equal(paymentStageIncome.total, 6400);
assert.equal(paymentStageIncome.finance.serviceTotal, 8000);
assert.equal(paymentStageIncome.finance.discountTotal, 1600);

const paymentStageAttended = updateRecord(paymentStageRecord.id, { attendance: 'arrived' });
assert.equal(paymentStageAttended.finance.factTotal, 6400);
assert.equal(getClientMetadata('client-2').paidTotal, 6400);
assert.equal(getFinancialItemFact('procedure', 'procedure-2').factTotal, 6400);
assert.equal(getWalletBalance('cash'), 12800);

const returned = recordRefundExpense(paymentStageIncome.id, { reason: 'Возврат клиенту' });
assert.ok(returned);
updateRecord(paymentStageRecord.id, {});
assert.equal(getClientMetadata('client-2').paidTotal, 0);
assert.equal(getFinancialItemFact('procedure', 'procedure-2').factTotal, 0);
assert.equal(getWalletBalance('cash'), 6400);

// Legacy paid records with a payment-stage discount recover the exact financial snapshot.
const historicalPlan = calculateFinancialPlan([{
  sourceType: 'procedure',
  sourceId: 'procedure-history',
  name: 'Историческая услуга',
  price: 8000,
  discountMode: 'percent',
  discountPercent: 20,
}]);
const historicalIncome = recordPaymentIncome({
  source: { type: 'record', id: 'record-history' },
  workplace: 'Студия',
  client: { key: 'client-history', name: 'История' },
  finance: historicalPlan,
  allocations: [{ walletId: 'cashless', walletName: 'Безналичные', amount: 6400 }],
});
assert.ok(historicalIncome);
const rawRecords = JSON.parse(localStorage.getItem('book.records') || '[]');
rawRecords.push({
  id: 'record-history',
  status: 'active',
  date: '2026-09-01',
  workplaceId: 'studio',
  from: '09:00',
  to: '10:00',
  client: { key: 'client-history', name: 'История' },
  procedures: [{ id: 'procedure-history', name: 'Историческая услуга', cost: 8000, duration: 60 }],
});
localStorage.setItem('book.records', JSON.stringify(rawRecords));
const restoredHistory = getRecords().find((item) => item.id === 'record-history');
assert.equal(restoredHistory.procedures[0].cost, 8000);
assert.equal(restoredHistory.finance.discountPercent, 20);
assert.equal(restoredHistory.finance.discountTotal, 1600);
assert.equal(restoredHistory.finance.planTotal, 6400);
assert.equal(restoredHistory.finance.factTotal, 6400);

console.log('critical record flow tests: OK');
