import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  calculateSettlement,
  getDDSExpenses,
  getDDSIncome,
  getLedgerEntries,
  getPaymentRemaining,
  getRecordPaymentState,
  getRefundsForPayment,
  getWalletDDSMovements,
  hydrateFinanceFromServer,
} from '../core/finance/index.js';
import {
  canonicalFinanceState,
  paymentFixture,
  refundFixture,
  reversalFixture,
  settlementRow,
} from './helpers/finance-canonical.mjs';

function recordFor(id) {
  return { id, procedures: [] };
}

const serverFinance = readFileSync(new URL('../server/src/finance/finance.service.ts', import.meta.url), 'utf8');
const paymentUi = readFileSync(new URL('../journal/record-payment.js', import.meta.url), 'utf8');
assert.match(serverFinance, /createReversalFor/);
assert.match(serverFinance, /kind:\s*'cancel'/);
assert.match(serverFinance, /direction:\s*entry\.direction === 'IN' \? 'OUT' : 'IN'/);
assert.match(paymentUi, /await\s+cancelPaymentOperation\(payment\.id/);

// Cancelling a wrong payment keeps the original Ledger fact and appends a reversal.
const settlement = calculateSettlement([{ sourceId: 'procedure-cancel', name: 'Стрижка', price: 5000 }]);
const payment = paymentFixture({
  id: 'payment-cancel',
  recordId: 'record-cancel',
  settlement,
  allocations: [{ walletId: 'cancel-cash', walletName: 'Наличные', amount: 5000 }],
  status: 'cancelled',
});
const reversal = reversalFixture({
  id: 'cancel-payment-cancel',
  originalOperationId: payment.operation.operationId,
  recordId: 'record-cancel',
  entries: payment.ledger,
});
hydrateFinanceFromServer(canonicalFinanceState({
  settlements: [settlementRow('record-cancel', settlement)],
  payments: [payment],
  reversals: [reversal],
}));

assert.equal(getDDSIncome().find((item) => item.id === 'payment-cancel')?.status, 'cancelled');
assert.equal(getLedgerEntries().length, 2);
assert.equal(getWalletDDSMovements('cancel-cash').reduce((sum, item) => sum + Number(item.total || 0), 0), 0);
assert.equal(getPaymentRemaining('payment-cancel'), 0);
let state = getRecordPaymentState(recordFor('record-cancel'));
assert.equal(state.hasPayments, false);
assert.equal(state.paidTotal, 0);
assert.equal(state.remaining, 5000);

// Cancelling a payment that already had a refund reverses both parts, preserving the whole audit chain.
const chainSettlement = calculateSettlement([{ sourceId: 'procedure-chain', name: 'Окрашивание', price: 5000 }]);
const chainPayment = paymentFixture({
  id: 'payment-chain',
  recordId: 'record-chain',
  settlement: chainSettlement,
  allocations: [{ walletId: 'chain-cash', walletName: 'Наличные', amount: 5000 }],
  status: 'cancelled',
});
const chainRefund = refundFixture({
  id: 'refund-chain',
  paymentId: 'payment-chain',
  recordId: 'record-chain',
  settlement: chainSettlement,
  walletId: 'chain-cash',
  walletName: 'Наличные',
  serviceAmount: 1000,
  status: 'cancelled',
});
const reversePayment = reversalFixture({
  id: 'cancel-payment-chain',
  originalOperationId: 'payment-chain',
  recordId: 'record-chain',
  entries: chainPayment.ledger,
});
const reverseRefund = reversalFixture({
  id: 'cancel-refund-chain',
  originalOperationId: 'refund-chain',
  recordId: 'record-chain',
  entries: chainRefund.ledger,
});
hydrateFinanceFromServer(canonicalFinanceState({
  settlements: [settlementRow('record-chain', chainSettlement)],
  payments: [chainPayment],
  refunds: [chainRefund],
  reversals: [reversePayment, reverseRefund],
}));

assert.equal(getDDSExpenses().find((item) => item.id === 'refund-chain')?.status, 'cancelled');
assert.equal(getRefundsForPayment('payment-chain').length, 0);
assert.equal(getWalletDDSMovements('chain-cash').reduce((sum, item) => sum + Number(item.total || 0), 0), 0);
assert.equal(getLedgerEntries().length, 4);
state = getRecordPaymentState(recordFor('record-chain'));
assert.equal(state.hasPayments, false);
assert.equal(state.paidTotal, 0);
assert.equal(state.remaining, 5000);

console.log('payment cancel tests: OK');
