import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  calculateSettlement,
  cancelPaymentOperation,
  getDDSExpenses,
  getDDSIncome,
  getDDSMovements,
  getPaymentRemaining,
  getRecordPaymentState,
  getRefundsForPayment,
  getWalletDDSMovements,
  hydrateFinanceFromServer,
  recordPaymentIncome,
  recordRefundExpense,
} from '../core/finance/index.js';

function recordFor(id, settlement) {
  return {
    id,
    procedures: (settlement?.items || []).map((item) => ({ id: item.sourceId, name: item.name, cost: item.price, duration: 60 })),
    products: [],
  };
}

hydrateFinanceFromServer({ version: 5, income: [], expense: [] });
const settlement = calculateSettlement([{ sourceId: 'procedure-cancel', name: 'Стрижка', price: 5000 }]);
const payment = recordPaymentIncome({
  source: { type: 'record', id: 'record-cancel' },
  settlement,
  maxAmount: 5000,
  serviceAmount: 5000,
  allocations: [{ walletId: 'cancel-cash', walletName: 'Наличные', amount: 5000 }],
});
assert.ok(payment);
assert.equal(getRecordPaymentState(recordFor('record-cancel', settlement)).fullyPaid, true);
assert.equal(getWalletDDSMovements('cancel-cash').reduce((sum, item) => sum + Number(item.total || 0), 0), 5000);

const cancelAt = new Date('2026-09-11T12:00:00.000Z');
const cancelled = cancelPaymentOperation(payment.id, { reason: 'incorrect-entry', now: cancelAt });
assert.ok(cancelled);
assert.equal(cancelled.status, 'cancelled');
assert.equal(cancelled.cancelReason, 'incorrect-entry');
assert.equal(cancelled.cancelledAt, cancelAt.toISOString());
assert.equal(getDDSIncome().find((item) => item.operationId === payment.id)?.status, 'cancelled');
assert.equal(getDDSMovements().find((item) => item.operationId === payment.id)?.status, 'cancelled');
assert.equal(getWalletDDSMovements('cancel-cash').reduce((sum, item) => sum + Number(item.total || 0), 0), 0);
const cancellationRows = getDDSMovements().filter((item) => item.operationType === 'cancellation');
assert.ok(cancellationRows.length > 0);
assert.ok(cancellationRows.every((item) => item.reversalOfLedgerEntryId));
assert.equal(getPaymentRemaining(payment.id), 0);
assert.equal(recordRefundExpense(payment.id), null);
let state = getRecordPaymentState(recordFor('record-cancel', settlement));
assert.equal(state.paidTotal, 0);
assert.equal(state.remaining, 5000);
assert.equal(state.fullyPaid, false);
assert.equal(state.hasPayments, false);
assert.equal(cancelPaymentOperation(payment.id), null);

// If an incorrect payment already has a refund, cancelling the payment cancels the whole erroneous chain.
hydrateFinanceFromServer({ version: 5, income: [], expense: [] });
const chainSettlement = calculateSettlement([{ sourceId: 'procedure-chain', name: 'Окрашивание', price: 5000 }]);
const chainPayment = recordPaymentIncome({
  source: { type: 'record', id: 'record-chain' },
  settlement: chainSettlement,
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
const storedRefund = getDDSExpenses().find((item) => item.operationId === chainRefund.id);
assert.equal(storedRefund?.status, 'cancelled');
assert.equal(getRefundsForPayment(chainPayment.id).length, 0);
assert.equal(getWalletDDSMovements('chain-cash').reduce((sum, item) => sum + Number(item.total || 0), 0), 0);
state = getRecordPaymentState(recordFor('record-chain', chainSettlement));
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
