import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calculateFinancialPlan, getRecordPaymentState } from '../core/financial-model.js';
import {
  getDDSExpenses,
  getDDSIncome,
  getPaymentRemaining,
  getRefundsForPayment,
  getWalletDDSMovements,
  recordPaymentIncome,
  recordRefundExpense,
} from '../core/dds.js';

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.has(key) ? storage.get(key) : null,
  setItem: (key, value) => storage.set(key, String(value)),
};

const ddsSource = readFileSync(new URL('../core/dds.js', import.meta.url), 'utf8');
const paymentUiSource = readFileSync(new URL('../ui/payment/index.js', import.meta.url), 'utf8');
const forbiddenEditPayment = /replacesPaymentId|status:\s*['"]corrected['"]|data-edit-payment|openPaymentEditor|Редактировать оплату/;
assert.doesNotMatch(ddsSource, forbiddenEditPayment);
assert.doesNotMatch(paymentUiSource, forbiddenEditPayment);

function recordFor(id, finance) {
  return { id, finance, procedures: [] };
}

// Existing DDS entries keep their financial snapshot and gain service/tips defaults safely.
storage.set('book.dds', JSON.stringify({
  version: 2,
  income: [{
    id: 'legacy-income',
    status: 'completed',
    source: { type: 'record', id: 'legacy-record' },
    total: 6400,
    allocations: [{ walletId: 'cash', walletName: 'Наличные', amount: 6400 }],
    business: {
      items: [{ sourceType: 'procedure', sourceId: 'legacy-procedure', name: 'Стрижка', price: 8000, discountMode: 'percent', discountPercent: 20, discountMoney: 1600, planAmount: 6400 }],
      serviceTotal: 8000,
      discountPercent: 20,
      discountTotal: 1600,
      planTotal: 6400,
    },
  }],
  expense: [],
}));
const migratedLegacy = getDDSIncome();
assert.equal(migratedLegacy.length, 1);
assert.equal(migratedLegacy[0].finance.serviceTotal, 8000);
assert.equal(migratedLegacy[0].finance.discountTotal, 1600);
assert.equal(migratedLegacy[0].finance.planTotal, 6400);
assert.equal(migratedLegacy[0].serviceAmount, 6400);
assert.equal(migratedLegacy[0].tips, 0);
assert.equal(migratedLegacy[0].business, undefined);
const storedMigrated = JSON.parse(storage.get('book.dds') || '{}');
assert.equal(storedMigrated.version, 5);
assert.equal(storedMigrated.income[0].finance.planTotal, 6400);
assert.equal(storedMigrated.income[0].business, undefined);
storage.clear();

const discounted = calculateFinancialPlan([{ sourceId: 'procedure-discount', name: 'Стрижка', price: 8000, discountPercent: 10 }]);
assert.equal(discounted.serviceTotal, 8000);
assert.equal(discounted.discountTotal, 800);
assert.equal(discounted.planTotal, 7200);

// Full payment.
const finance = calculateFinancialPlan([{ sourceId: 'procedure-1', name: 'Стрижка', price: 5000 }]);
const completed = recordPaymentIncome({
  source: { type: 'record', id: 'record-1' },
  workplace: 'workplace-1',
  client: { key: 'client-1' },
  finance,
  maxAmount: 5000,
  serviceAmount: 5000,
  allocations: [{ walletId: 'cash', walletName: 'Наличные', amount: 5000 }],
});
assert.equal(completed.status, 'completed');
assert.equal(completed.movementType, 'income');
assert.equal(completed.total, 5000);
assert.equal(completed.serviceAmount, 5000);
assert.equal(completed.tips, 0);
assert.equal(getWalletDDSMovements('cash').length, 1);
let state = getRecordPaymentState(recordFor('record-1', finance));
assert.equal(state.paidTotal, 5000);
assert.equal(state.remaining, 0);
assert.equal(state.fullyPaid, true);
assert.equal(getPaymentRemaining(completed.id), 5000);

// Refund reopens the amount due.
const refundAt = new Date('2026-09-10T10:00:00.000Z');
const refunded = recordRefundExpense(completed.id, { reason: 'Возврат клиенту', now: refundAt });
assert.equal(refunded.status, 'refund');
assert.equal(refunded.movementType, 'expense');
assert.equal(refunded.expenseType, 'refund');
assert.equal(refunded.serviceAmount, 5000);
assert.equal(refunded.tips, 0);
assert.equal(refunded.refundedAt, refundAt.toISOString());
assert.equal(refunded.reason, 'Возврат клиенту');
assert.equal(getDDSExpenses().length, 1);
assert.equal(getWalletDDSMovements('cash').reduce((sum, item) => sum + Number(item.total || 0), 0), 0);
assert.equal(getRefundsForPayment(completed.id).length, 1);
assert.equal(getPaymentRemaining(completed.id), 0);
state = getRecordPaymentState(recordFor('record-1', finance));
assert.equal(state.paidTotal, 0);
assert.equal(state.remaining, 5000);
assert.equal(state.fullyPaid, false);
assert.equal(recordRefundExpense(completed.id), null);

const repaid = recordPaymentIncome({
  source: { type: 'record', id: 'record-1' },
  finance,
  maxAmount: 5000,
  serviceAmount: 5000,
  allocations: [{ walletId: 'cash', walletName: 'Наличные', amount: 5000 }],
});
assert.ok(repaid);
assert.equal(getRecordPaymentState(recordFor('record-1', finance)).fullyPaid, true);

// Partial payments remain separate immutable DDS income movements.
const partialFinance = calculateFinancialPlan([{ sourceId: 'procedure-partial', name: 'Окрашивание', price: 7000 }]);
const firstPart = recordPaymentIncome({
  source: { type: 'record', id: 'record-partial' },
  finance: partialFinance,
  maxAmount: 7000,
  serviceAmount: 2000,
  allocations: [{ walletId: 'partial-cash', walletName: 'Наличные', amount: 2000 }],
});
assert.ok(firstPart);
assert.equal(firstPart.total, 2000);
let partialState = getRecordPaymentState(recordFor('record-partial', partialFinance));
assert.equal(partialState.paidTotal, 2000);
assert.equal(partialState.remaining, 5000);
assert.equal(partialState.partiallyPaid, true);
assert.equal(partialState.fullyPaid, false);

const secondPart = recordPaymentIncome({
  source: { type: 'record', id: 'record-partial' },
  finance: partialFinance,
  maxAmount: 5000,
  serviceAmount: 4000,
  allocations: [
    { walletId: 'partial-card', walletName: 'СберБанк', amount: 3000 },
    { walletId: 'partial-cash', walletName: 'Наличные', amount: 1000 },
  ],
});
assert.ok(secondPart);
assert.equal(secondPart.total, 4000);
partialState = getRecordPaymentState(recordFor('record-partial', partialFinance));
assert.equal(partialState.paidTotal, 6000);
assert.equal(partialState.remaining, 1000);
assert.equal(partialState.partiallyPaid, true);

// A service amount over the current remainder is rejected.
assert.equal(recordPaymentIncome({
  source: { type: 'record', id: 'record-partial' },
  finance: partialFinance,
  maxAmount: 1000,
  serviceAmount: 1001,
  allocations: [{ walletId: 'partial-card', walletName: 'СберБанк', amount: 1001 }],
}), null);

const finalPart = recordPaymentIncome({
  source: { type: 'record', id: 'record-partial' },
  finance: partialFinance,
  maxAmount: 1000,
  serviceAmount: 1000,
  allocations: [{ walletId: 'partial-card', walletName: 'СберБанк', amount: 1000 }],
});
assert.ok(finalPart);
partialState = getRecordPaymentState(recordFor('record-partial', partialFinance));
assert.equal(partialState.paidTotal, 7000);
assert.equal(partialState.remaining, 0);
assert.equal(partialState.fullyPaid, true);
assert.equal(partialState.payments.length, 3);
assert.equal(getWalletDDSMovements('partial-cash').reduce((sum, item) => sum + Number(item.total || 0), 0), 3000);
assert.equal(getWalletDDSMovements('partial-card').reduce((sum, item) => sum + Number(item.total || 0), 0), 4000);

// Required Tips example: 7,000 due, 10,000 received -> 3,000 Tips.
const tipsFinance = calculateFinancialPlan([{ sourceId: 'procedure-tips', name: 'Укладка', price: 7000 }]);
const withTips = recordPaymentIncome({
  source: { type: 'record', id: 'record-tips' },
  finance: tipsFinance,
  maxAmount: 7000,
  serviceAmount: 7000,
  tips: 3000,
  allocations: [{ walletId: 'tips-cash', walletName: 'Наличные', amount: 10000 }],
});
assert.ok(withTips);
assert.equal(withTips.total, 10000);
assert.equal(withTips.serviceAmount, 7000);
assert.equal(withTips.tips, 3000);
let tipsState = getRecordPaymentState(recordFor('record-tips', tipsFinance));
assert.equal(tipsState.paidTotal, 7000);
assert.equal(tipsState.remaining, 0);
assert.equal(tipsState.tipsTotal, 3000);
assert.equal(tipsState.fullyPaid, true);
assert.equal(getWalletDDSMovements('tips-cash').reduce((sum, item) => sum + Number(item.total || 0), 0), 10000);

// Required discount example: 7,000 price - 1,400 discount = 5,600 service, 6,000 received -> 400 Tips.
const discountTipsFinance = calculateFinancialPlan([{ sourceId: 'procedure-discount-tips', name: 'Стрижка', price: 7000, discountPercent: 20 }]);
assert.equal(discountTipsFinance.discountTotal, 1400);
assert.equal(discountTipsFinance.planTotal, 5600);
const discountTips = recordPaymentIncome({
  source: { type: 'record', id: 'record-discount-tips' },
  finance: discountTipsFinance,
  maxAmount: 5600,
  serviceAmount: 5600,
  tips: 400,
  allocations: [{ walletId: 'discount-cash', walletName: 'Наличные', amount: 6000 }],
});
assert.ok(discountTips);
assert.equal(discountTips.total, 6000);
assert.equal(discountTips.serviceAmount, 5600);
assert.equal(discountTips.tips, 400);
let discountTipsState = getRecordPaymentState(recordFor('record-discount-tips', discountTipsFinance));
assert.equal(discountTipsState.paidTotal, 5600);
assert.equal(discountTipsState.remaining, 0);
assert.equal(discountTipsState.tipsTotal, 400);
assert.equal(discountTipsState.fullyPaid, true);

// Refund Tips first: returning the 400 Tips must not reopen service debt.
const tipsRefund = recordRefundExpense(discountTips.id, { amount: 400 });
assert.ok(tipsRefund);
assert.equal(tipsRefund.total, 400);
assert.equal(tipsRefund.tips, 400);
assert.equal(tipsRefund.serviceAmount, 0);
discountTipsState = getRecordPaymentState(recordFor('record-discount-tips', discountTipsFinance));
assert.equal(discountTipsState.paidTotal, 5600);
assert.equal(discountTipsState.remaining, 0);
assert.equal(discountTipsState.tipsTotal, 0);
assert.equal(discountTipsState.fullyPaid, true);

// Once Tips are exhausted, further refund reduces service and reopens the debt.
const serviceRefund = recordRefundExpense(discountTips.id, { amount: 1000 });
assert.ok(serviceRefund);
assert.equal(serviceRefund.tips, 0);
assert.equal(serviceRefund.serviceAmount, 1000);
discountTipsState = getRecordPaymentState(recordFor('record-discount-tips', discountTipsFinance));
assert.equal(discountTipsState.paidTotal, 4600);
assert.equal(discountTipsState.remaining, 1000);
assert.equal(discountTipsState.fullyPaid, false);

// One payment can be allocated to two wallets without a mode switch.
const splitFinance = calculateFinancialPlan([{ sourceId: 'procedure-2', name: 'Окрашивание', price: 6000 }]);
const split = recordPaymentIncome({
  source: { type: 'record', id: 'record-2' },
  workplace: 'workplace-1',
  client: { key: 'client-2' },
  finance: splitFinance,
  maxAmount: 6000,
  serviceAmount: 6000,
  allocations: [
    { walletId: 'split-cash', walletName: 'Наличные', amount: 2000 },
    { walletId: 'split-card', walletName: 'Карта', amount: 4000 },
  ],
});
assert.equal(split.status, 'completed');
assert.equal(split.allocations.length, 2);
assert.equal(getWalletDDSMovements('split-cash').reduce((sum, item) => sum + Number(item.total || 0), 0), 2000);
assert.equal(getWalletDDSMovements('split-card').reduce((sum, item) => sum + Number(item.total || 0), 0), 4000);

console.log('payment refund tests: OK');
