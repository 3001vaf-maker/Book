import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  calculateFinancialPlan,
  cancelPaymentOperation,
  getDDSExpenses,
  getDDSIncome,
  getDDSMovements,
  getPaymentRemaining,
  getRecordPaymentState,
  getRefundsForPayment,
  getWalletDDSMovements,
  recordPaymentIncome,
  recordRefundExpense,
} from '../core/finance/index.js';

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.has(key) ? storage.get(key) : null,
  setItem: (key, value) => storage.set(key, String(value)),
};

function recordFor(id, finance) {
  return { id, finance, procedures: [] };
}

const finance = calculateFinancialPlan([{ sourceId: 'procedure-cancel', name: 'Стрижка', price: 5000 }]);
const payment = recordPaymentIncome({
  source: { type: 'record', id: 'record-cancel' },
  finance,
  maxAmount: 5000,
  serviceAmount: 5000,
  allocations: [{ walletId: 'cancel-cash', walletName: 'Наличные', amount: 5000 }],
});
assert.ok(payment);
assert.equal(getRecordPaymentState(recordFor('record-cancel', finance)).fullyPaid, true);
assert.equal(getWalletDDSMovements('cancel-cash').reduce((sum, item) => sum + Number(item.total || 0), 0), 5000);

const cancelAt = new Date('2026-09-11T12:00:00.000Z');
const cancelled = cancelPaymentOperation(payment.id, { reason: 'incorrect-entry', now: cancelAt });
assert.ok(cancelled);
assert.equal(cancelled.status, 'cancelled');
assert.equal(cancelled.cancelReason, 'incorrect-entry');
assert.equal(cancelled.cancelledAt, cancelAt.toISOString());
assert.equal(getDDSIncome().find((item) => item.id === payment.id)?.status, 'cancelled');
assert.equal(getDDSMovements().find((item) => item.id === payment.id)?.status, 'cancelled');
assert.equal(getWalletDDSMovements('cancel-cash').length, 0);
assert.equal(getPaymentRemaining(payment.id), 0);
assert.equal(recordRefundExpense(payment.id), null);
let state = getRecordPaymentState(recordFor('record-cancel', finance));
assert.equal(state.paidTotal, 0);
assert.equal(state.remaining, 5000);
assert.equal(state.fullyPaid, false);
assert.equal(state.hasPayments, false);
assert.equal(cancelPaymentOperation(payment.id), null);

// If an incorrect payment already has a refund, cancelling the payment cancels the whole erroneous chain.
storage.clear();
const chainFinance = calculateFinancialPlan([{ sourceId: 'procedure-chain', name: 'Окрашивание', price: 5000 }]);
const chainPayment = recordPaymentIncome({
  source: { type: 'record', id: 'record-chain' },
  finance: chainFinance,
  maxAmount: 5000,
  serviceAmount: 5000,
  allocations: [{ walletId: 'chain-cash', walletName: 'Наличные', amount: 5000 }],
});
assert.ok(chainPayment);
const chainRefund = recordRefundExpense(chainPayment.id, { amount: 1000 });
assert.ok(chainRefund);
assert.equal(getWalletDDSMovements('chain-cash').reduce((sum, item) => sum + Number(item.total || 0), 0), 4000);

const chainCancelled = cancelPaymentOperation(chainPayment.id, { now: cancelAt });
assert.ok(chainCancelled);
const storedRefund = getDDSExpenses().find((item) => item.id === chainRefund.id);
assert.equal(storedRefund?.status, 'cancelled');
assert.equal(storedRefund?.cancelledBecausePaymentId, chainPayment.id);
assert.equal(getRefundsForPayment(chainPayment.id).length, 0);
assert.equal(getWalletDDSMovements('chain-cash').length, 0);
state = getRecordPaymentState(recordFor('record-chain', chainFinance));
assert.equal(state.paidTotal, 0);
assert.equal(state.remaining, 5000);
assert.equal(state.fullyPaid, false);

// Paid-state UI exposes one neutral entry, then two semantically distinct actions.
const paymentUi = readFileSync(new URL('../journal/record-payment.js', import.meta.url), 'utf8');
assert.match(paymentUi, /button\('Действия с оплатой',\s*\{\s*variant:\s*'secondary'/);
assert.match(paymentUi, /button\('Отменить операцию',\s*\{\s*variant:\s*'secondary'/);
assert.match(paymentUi, /button\('Возврат',\s*\{\s*variant:\s*'danger'/);
assert.match(paymentUi, /cancelPaymentOperation\(payment\.id/);

console.log('payment cancel tests: OK');
