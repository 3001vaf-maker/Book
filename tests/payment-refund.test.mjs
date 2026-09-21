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
  settlementRow,
} from './helpers/finance-canonical.mjs';

function recordFor(id) {
  return { id, procedures: [] };
}

const browserService = readFileSync(new URL('../core/finance/service.js', import.meta.url), 'utf8');
const serverService = readFileSync(new URL('../server/src/finance/finance.service.ts', import.meta.url), 'utf8');
assert.match(browserService, /apiRequest\('\/finance\/operations\/payment'/);
assert.doesNotMatch(browserService, /writeFinanceState|queueAuxiliaryDataset/);
assert.match(serverService, /serviceAmount > due \+ 0\.009/);
assert.match(serverService, /splitAllocationComponents/);
assert.match(serverService, /tipsRemaining/);
assert.match(serverService, /const serviceAmount = Math\.min\(requested, serviceRemaining\);/);
assert.match(serverService, /const tips = Math\.min\(money\(requested - serviceAmount\), tipsRemaining\);/);
assert.doesNotMatch(serverService, /const tips = Math\.min\(requested, tipsRemaining\);/);

// A partial refund from a service+Tips payment must reopen service debt first.
const refundRequested = 1500;
const serviceRemainingForRefund = 7000;
const tipsRemainingForRefund = 1000;
const refundedServiceFirst = Math.min(refundRequested, serviceRemainingForRefund);
const refundedTipsAfterService = Math.min(refundRequested - refundedServiceFirst, tipsRemainingForRefund);
assert.equal(refundedServiceFirst, 1500);
assert.equal(refundedTipsAfterService, 0);

// Full payment is one Operation and one Ledger row for one wallet.
const fullSettlement = calculateSettlement([{ sourceId: 'procedure-1', name: 'Стрижка', price: 5000 }]);
const full = paymentFixture({
  id: 'payment-full',
  recordId: 'record-full',
  settlement: fullSettlement,
  allocations: [{ walletId: 'cash', walletName: 'Наличные', amount: 5000 }],
});
hydrateFinanceFromServer(canonicalFinanceState({
  settlements: [settlementRow('record-full', fullSettlement)],
  payments: [full],
}));

assert.equal(getDDSIncome().length, 1);
assert.equal(getLedgerEntries().length, 1);
assert.equal(getWalletDDSMovements('cash').reduce((sum, item) => sum + Number(item.total || 0), 0), 5000);
let state = getRecordPaymentState(recordFor('record-full'));
assert.equal(state.fullyPaid, true);
assert.equal(state.paidTotal, 5000);
assert.equal(state.remaining, 0);
assert.equal(getPaymentRemaining('payment-full'), 5000);

// Refund is a separate OUT operation and reopens the debt.
const fullRefund = refundFixture({
  id: 'refund-full',
  paymentId: 'payment-full',
  recordId: 'record-full',
  settlement: fullSettlement,
  walletId: 'cash',
  walletName: 'Наличные',
  serviceAmount: 5000,
});
hydrateFinanceFromServer(canonicalFinanceState({
  settlements: [settlementRow('record-full', fullSettlement)],
  payments: [full],
  refunds: [fullRefund],
}));
assert.equal(getDDSExpenses().length, 1);
assert.equal(getRefundsForPayment('payment-full').length, 1);
assert.equal(getPaymentRemaining('payment-full'), 0);
assert.equal(getWalletDDSMovements('cash').reduce((sum, item) => sum + Number(item.total || 0), 0), 0);
state = getRecordPaymentState(recordFor('record-full'));
assert.equal(state.fullyPaid, false);
assert.equal(state.paidTotal, 0);
assert.equal(state.remaining, 5000);

// Partial payments remain separate Operations. Split wallets are flat Ledger rows.
const partialSettlement = calculateSettlement([{ sourceId: 'procedure-partial', name: 'Окрашивание', price: 7000 }]);
const part1 = paymentFixture({
  id: 'part-1',
  recordId: 'record-partial',
  settlement: partialSettlement,
  allocations: [{ walletId: 'partial-cash', walletName: 'Наличные', amount: 2000 }],
});
const part2 = paymentFixture({
  id: 'part-2',
  recordId: 'record-partial',
  settlement: partialSettlement,
  allocations: [
    { walletId: 'partial-card', walletName: 'СберБанк', amount: 3000 },
    { walletId: 'partial-cash', walletName: 'Наличные', amount: 1000 },
  ],
});
const part3 = paymentFixture({
  id: 'part-3',
  recordId: 'record-partial',
  settlement: partialSettlement,
  allocations: [{ walletId: 'partial-card', walletName: 'СберБанк', amount: 1000 }],
});
hydrateFinanceFromServer(canonicalFinanceState({
  settlements: [settlementRow('record-partial', partialSettlement)],
  payments: [part1, part2, part3],
}));
state = getRecordPaymentState(recordFor('record-partial'));
assert.equal(state.fullyPaid, true);
assert.equal(state.paidTotal, 7000);
assert.equal(state.payments.length, 3);
assert.equal(getWalletDDSMovements('partial-cash').reduce((sum, item) => sum + Number(item.total || 0), 0), 3000);
assert.equal(getWalletDDSMovements('partial-card').reduce((sum, item) => sum + Number(item.total || 0), 0), 4000);
assert.equal(getLedgerEntries().filter((item) => item.operationId === 'part-2').length, 2);

// Tips increase wallet cash but do not increase paid service fact.
const tipsSettlement = calculateSettlement([{ sourceId: 'procedure-tips', name: 'Укладка', price: 7000 }]);
const tipsPayment = paymentFixture({
  id: 'payment-tips',
  recordId: 'record-tips',
  settlement: tipsSettlement,
  allocations: [{ walletId: 'tips-cash', walletName: 'Наличные', amount: 10000 }],
  serviceAmount: 7000,
  tips: 3000,
});
hydrateFinanceFromServer(canonicalFinanceState({
  settlements: [settlementRow('record-tips', tipsSettlement)],
  payments: [tipsPayment],
}));
state = getRecordPaymentState(recordFor('record-tips'));
assert.equal(state.fullyPaid, true);
assert.equal(state.paidTotal, 7000);
assert.equal(state.tipsTotal, 3000);
assert.equal(getWalletDDSMovements('tips-cash').reduce((sum, item) => sum + Number(item.total || 0), 0), 10000);
assert.equal(getLedgerEntries().filter((item) => item.operationId === 'payment-tips').length, 2);

// One economic payment split across two wallets stays one Operation and two flat Ledger rows.
const splitSettlement = calculateSettlement([{ sourceId: 'procedure-split', name: 'Окрашивание', price: 6000 }]);
const split = paymentFixture({
  id: 'payment-split',
  recordId: 'record-split',
  settlement: splitSettlement,
  allocations: [
    { walletId: 'split-cash', walletName: 'Наличные', amount: 2000 },
    { walletId: 'split-card', walletName: 'Карта', amount: 4000 },
  ],
});
const splitState = canonicalFinanceState({
  settlements: [settlementRow('record-split', splitSettlement)],
  payments: [split],
});
hydrateFinanceFromServer(splitState);
assert.equal(splitState.operations.length, 1);
assert.equal(getLedgerEntries().length, 2);
assert.equal(new Set(getLedgerEntries().map((item) => item.operationId)).size, 1);
assert.equal(getWalletDDSMovements('split-cash').reduce((sum, item) => sum + Number(item.total || 0), 0), 2000);
assert.equal(getWalletDDSMovements('split-card').reduce((sum, item) => sum + Number(item.total || 0), 0), 4000);

console.log('payment refund tests: OK');
