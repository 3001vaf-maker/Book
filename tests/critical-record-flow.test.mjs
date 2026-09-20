import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hydrateDaysFromServer } from '../core/day/index.js';
import {
  calculateSettlement,
  getRecordPaymentState,
  getRecordSettlement,
  getSettlementItemTotals,
  hydrateFinanceFromServer,
  migrateLegacyRecordSettlements,
  recordPaymentIncome,
  recordRefundExpense,
  saveRecordSettlement,
} from '../core/finance/index.js';
import {
  createRecord,
  getLegacyRecordSettlementRows,
  getRecords,
  hydrateRecordStateFromServer,
  moveRecord,
  recordVisualState,
  updateRecord,
} from '../core/record/index.js';
import { renderJournalList } from '../journal/список.js';
import { hydratePeopleFromServer } from '../main/people/data.js';
import { getPersonMetadata } from '../main/people/metadata.js';
import { getWalletBalance, hydrateWalletsFromServer } from '../settings/wallets/data.js';

globalThis.requestAnimationFrame = (callback) => callback();

hydrateDaysFromServer([
  { date: '2026-09-10', workplaceId: 'studio', from: '09:00', to: '18:00' },
  { date: '2026-09-11', workplaceId: 'studio', from: '09:00', to: '18:00' },
]);
hydratePeopleFromServer([
  { key: 'person-1', name: 'Анна', surname: 'Тест', phones: ['+70000000000'], discountPercent: 20 },
  { key: 'person-2', name: 'Ирина', surname: 'БезСкидки', phones: ['+71111111111'], discountPercent: 0 },
]);
hydrateRecordStateFromServer({ records: [], recordEvents: [] });
hydrateFinanceFromServer({ version: 6, settlements: {}, income: [], expense: [] });
hydrateWalletsFromServer([]);

const record = createRecord({
  date: '2026-09-10',
  workplaceId: 'studio',
  from: '10:00',
  to: '11:00',
  person: { key: 'person-1', name: 'Анна', surname: 'Тест', phone: '+70000000000', discountPercent: 20 },
  procedures: [{ id: 'procedure-1', name: 'Стрижка', cost: 5000, duration: 60 }],
});
assert.ok(record);
assert.equal('finance' in record, false);
assert.equal(record.procedures[0].cost, 5000);
let settlement = getRecordSettlement(record);
assert.equal(settlement.serviceTotal, 5000);
assert.equal(settlement.discountPercent, 20);
assert.equal(settlement.discountTotal, 1000);
assert.equal(settlement.planTotal, 4000);

const corrected = updateRecord(record.id, {
  procedures: [{ id: 'procedure-1', name: 'Стрижка', cost: 8000, duration: 60 }],
});
assert.equal(corrected.procedures[0].cost, 8000);
assert.equal('finance' in corrected, false);
settlement = getRecordSettlement(corrected);
assert.equal(settlement.serviceTotal, 8000);
assert.equal(settlement.discountTotal, 1600);
assert.equal(settlement.planTotal, 6400);

const moved = moveRecord(record.id, { date: '2026-09-11', workplaceId: 'studio', from: '12:00', to: '13:00' });
assert.equal(moved?.date, '2026-09-11');
assert.equal(moved?.from, '12:00');
assert.equal(getRecordSettlement(moved).planTotal, 6400);

const noShow = updateRecord(record.id, { attendance: 'no-show' });
assert.equal(noShow?.attendance, 'no-show');
assert.equal(recordVisualState(noShow), 'no-show');

const noShowSettlement = getRecordSettlement(noShow);
const payment = recordPaymentIncome({
  source: { type: 'record', id: record.id },
  workplace: 'Студия',
  person: { key: 'person-1', name: 'Анна Тест' },
  settlement: noShowSettlement,
  maxAmount: 6400,
  serviceAmount: 6400,
  allocations: [{ walletId: 'cash', walletName: 'Наличные', amount: 6400 }],
});
assert.ok(payment);
assert.equal(payment.finance.serviceTotal, 8000);
assert.equal(payment.finance.discountTotal, 1600);
assert.equal(payment.total, 6400);
assert.equal(getRecordPaymentState(noShow).fullyPaid, true);
assert.equal(recordVisualState(noShow, { paid: true }), 'paid');

const attended = updateRecord(record.id, { attendance: 'arrived' });
assert.equal(attended?.procedures?.[0]?.cost, 8000);
assert.equal('finance' in attended, false);
assert.equal(getRecordSettlement(attended).planTotal, 6400);
assert.equal(getRecordSettlement(attended).factTotal, 6400);
assert.equal(getRecords()[0]?.procedures?.[0]?.cost, 8000);
assert.equal('finance' in getRecords()[0], false);

const metadata = getPersonMetadata('person-1');
assert.equal(metadata.recordCount, 1);
assert.equal(metadata.paidTotal, 6400);
assert.equal(metadata.lastVisit, '2026-09-11');

const listRoot = { innerHTML: '', querySelector: () => null };
renderJournalList(listRoot, { mode: 'flow' });
assert.match(listRoot.innerHTML, /journal-list-record--paid/);
assert.match(listRoot.innerHTML, /Анна Тест/);
assert.match(listRoot.innerHTML, /6 400 ₽/);
assert.equal(getRecords().length, 1);

// Person has no default discount. Finance assigns 20% at payment stage.
const paymentStageRecord = createRecord({
  date: '2026-09-11',
  workplaceId: 'studio',
  from: '14:00',
  to: '15:00',
  person: { key: 'person-2', name: 'Ирина', surname: 'БезСкидки', phone: '+71111111111' },
  procedures: [{ id: 'procedure-2', name: 'Окрашивание', cost: 8000, duration: 60 }],
});
assert.ok(paymentStageRecord);
assert.equal('finance' in paymentStageRecord, false);
const defaultSettlement = getRecordSettlement(paymentStageRecord);
assert.equal(defaultSettlement.serviceTotal, 8000);
assert.equal(defaultSettlement.discountTotal, 0);
assert.equal(defaultSettlement.planTotal, 8000);

const paymentStageSettlement = calculateSettlement(defaultSettlement.items.map((item) => ({
  ...item,
  discountMode: 'percent',
  discountPercent: 20,
  discountMoney: '',
})));
assert.ok(saveRecordSettlement(paymentStageRecord.id, paymentStageSettlement));
const storedPaymentSettlement = getRecordSettlement(paymentStageRecord);
assert.equal(storedPaymentSettlement.discountPercent, 20);
assert.equal(storedPaymentSettlement.discountTotal, 1600);
assert.equal(storedPaymentSettlement.planTotal, 6400);
assert.equal(storedPaymentSettlement.items[0].discountMode, 'percent');
assert.equal('finance' in getRecords().find((item) => item.id === paymentStageRecord.id), false);

const paymentStageIncome = recordPaymentIncome({
  source: { type: 'record', id: paymentStageRecord.id },
  workplace: 'Студия',
  person: { key: 'person-2', name: 'Ирина БезСкидки' },
  settlement: storedPaymentSettlement,
  maxAmount: 6400,
  serviceAmount: 6400,
  allocations: [{ walletId: 'cash', walletName: 'Наличные', amount: 6400 }],
});
assert.ok(paymentStageIncome);
assert.equal(paymentStageIncome.total, 6400);
assert.equal(paymentStageIncome.finance.discountTotal, 1600);

const paymentStageAttended = updateRecord(paymentStageRecord.id, { attendance: 'arrived' });
assert.equal('finance' in paymentStageAttended, false);
assert.equal(getRecordPaymentState(paymentStageAttended).paidTotal, 6400);
assert.equal(getPersonMetadata('person-2').paidTotal, 6400);
assert.equal(getSettlementItemTotals('procedure', 'procedure-2').factTotal, 6400);
assert.equal(getWalletBalance('cash'), 12800);

const returned = recordRefundExpense(paymentStageIncome.id, { reason: 'Возврат человеку' });
assert.ok(returned);
assert.equal(getPersonMetadata('person-2').paidTotal, 0);
assert.equal(getSettlementItemTotals('procedure', 'procedure-2').factTotal, 0);
assert.equal(getWalletBalance('cash'), 6400);

// A Record restored on another device remains finance-free; Finance restores the payment snapshot.
const historicalSettlement = calculateSettlement([{
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
  person: { key: 'person-history', name: 'История' },
  settlement: historicalSettlement,
  maxAmount: 6400,
  serviceAmount: 6400,
  allocations: [{ walletId: 'cashless', walletName: 'Безналичные', amount: 6400 }],
});
assert.ok(historicalIncome);
hydrateRecordStateFromServer({
  records: [{
    id: 'record-history',
    date: '2026-09-01',
    workplaceId: 'studio',
    from: '09:00',
    to: '10:00',
    person: { key: 'person-history', name: 'История' },
    procedures: [{ id: 'procedure-history', name: 'Историческая услуга', cost: 8000, duration: 60 }],
    products: [],
    createdAt: '2026-09-01T08:00:00.000Z',
    updatedAt: '2026-09-01T08:00:00.000Z',
  }],
  recordEvents: [],
});
const restoredHistory = getRecords().find((item) => item.id === 'record-history');
assert.ok(restoredHistory);
assert.equal('finance' in restoredHistory, false);
assert.equal(restoredHistory.procedures[0].cost, 8000);
const restoredSettlement = getRecordSettlement(restoredHistory);
assert.equal(restoredSettlement.discountPercent, 20);
assert.equal(restoredSettlement.discountTotal, 1600);
assert.equal(restoredSettlement.planTotal, 6400);
assert.equal(restoredSettlement.factTotal, 6400);

// Legacy Record finance is captured for migration but never exposed as Record truth.
const legacySettlement = calculateSettlement([{
  sourceType: 'procedure',
  sourceId: 'legacy-procedure',
  name: 'Legacy',
  price: 5000,
  discountMode: 'percent',
  discountPercent: 10,
}]);
hydrateRecordStateFromServer({
  records: [{
    id: 'legacy-record',
    date: '2026-09-11',
    workplaceId: 'studio',
    from: '16:00',
    to: '17:00',
    person: { key: 'person-legacy', discountPercent: 0 },
    procedures: [{ id: 'legacy-procedure', name: 'Legacy', cost: 5000, duration: 60 }],
    finance: legacySettlement,
  }],
  recordEvents: [],
});
const cleanLegacyRecord = getRecords()[0];
assert.equal('finance' in cleanLegacyRecord, false);
const legacyRows = getLegacyRecordSettlementRows();
assert.equal(legacyRows.length, 1);
migrateLegacyRecordSettlements(legacyRows);
assert.equal(getRecordSettlement(cleanLegacyRecord).planTotal, 4500);

// Record card shows service value / discount metadata. Amount due belongs only to payment bottom sheet.
const recordViewSource = readFileSync(new URL('../journal/record-view.js', import.meta.url), 'utf8');
const recordPaymentSource = readFileSync(new URL('../journal/record-payment.js', import.meta.url), 'utf8');
assert.match(recordViewSource, /label:\s*'расход'/);
assert.match(recordViewSource, /label:\s*'стоимость'/);
assert.match(recordViewSource, /скидка/);
assert.doesNotMatch(recordViewSource, /record\.finance|state\.finance/);
assert.doesNotMatch(recordViewSource, /К оплате/);
assert.match(recordPaymentSource, /saveRecordSettlement/);
assert.doesNotMatch(recordPaymentSource, /finance:\s*settlement/);
assert.match(recordPaymentSource, /К оплате/);

console.log('critical record flow tests: OK');
