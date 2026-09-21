import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  calculateSettlement,
  getRecordPaymentState,
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

function reload(state) {
  hydrateFinanceFromServer(JSON.parse(JSON.stringify(state)));
}

// Browser Settlement uses the same cent-level money contract as server Finance.
const cents = calculateSettlement([
  {
    sourceType: 'procedure',
    sourceId: 'p1',
    name: 'Процедура',
    price: 100.01,
    discountMode: 'percent',
    discountPercent: 33.333,
  },
  {
    sourceType: 'product',
    sourceId: 'g1',
    name: 'Товар',
    price: 59.99,
    discountMode: 'money',
    discountMoney: 10.005,
  },
]);
assert.equal(cents.serviceTotal, 160);
assert.equal(cents.items[0].discountMoney, 33.34);
assert.equal(cents.items[0].planAmount, 66.67);
assert.equal(cents.items[1].discountMoney, 10.01);
assert.equal(cents.items[1].planAmount, 49.98);
assert.equal(cents.discountTotal, 43.35);
assert.equal(cents.planTotal, 116.65);

// Reload must prefer canonical FinanceSettlement over a stale legacy Record.finance snapshot.
const legacy8000 = calculateSettlement([{ sourceId: 'p-reload', name: 'Окрашивание', price: 8000 }]);
const corrected6400 = calculateSettlement([{
  sourceId: 'p-reload',
  name: 'Окрашивание',
  price: 8000,
  discountMode: 'percent',
  discountPercent: 20,
}]);
const correctedPayment = paymentFixture({
  id: 'payment-reload',
  recordId: 'record-reload',
  settlement: corrected6400,
  allocations: [{ walletId: 'cash', walletName: 'Наличные', amount: 6400 }],
});
reload(canonicalFinanceState({
  settlements: [settlementRow('record-reload', corrected6400)],
  payments: [correctedPayment],
}));
let state = getRecordPaymentState({
  id: 'record-reload',
  finance: legacy8000,
  procedures: [{ id: 'p-reload', name: 'Окрашивание', cost: 8000 }],
});
assert.equal(state.planTotal, 6400);
assert.equal(state.paidTotal, 6400);
assert.equal(state.remaining, 0);
assert.equal(state.fullyPaid, true);

// Partial payment survives server snapshot -> browser reload.
const partialSettlement = calculateSettlement([{ sourceId: 'p-partial', name: 'Стрижка', price: 5000 }]);
const partialPayment = paymentFixture({
  id: 'payment-partial-roundtrip',
  recordId: 'record-partial-roundtrip',
  settlement: partialSettlement,
  allocations: [{ walletId: 'cash', walletName: 'Наличные', amount: 2000 }],
});
reload(canonicalFinanceState({
  settlements: [settlementRow('record-partial-roundtrip', partialSettlement)],
  payments: [partialPayment],
}));
state = getRecordPaymentState({ id: 'record-partial-roundtrip', procedures: [] });
assert.equal(state.paidTotal, 2000);
assert.equal(state.remaining, 3000);
assert.equal(state.partiallyPaid, true);

// Split wallets remain one payment and totals survive reload.
const splitSettlement = calculateSettlement([{ sourceId: 'p-split', name: 'Услуга', price: 6000 }]);
const splitPayment = paymentFixture({
  id: 'payment-split-roundtrip',
  recordId: 'record-split-roundtrip',
  settlement: splitSettlement,
  allocations: [
    { walletId: 'cash', walletName: 'Наличные', amount: 2500 },
    { walletId: 'card', walletName: 'Карта', amount: 3500 },
  ],
});
reload(canonicalFinanceState({
  settlements: [settlementRow('record-split-roundtrip', splitSettlement)],
  payments: [splitPayment],
}));
assert.equal(getWalletDDSMovements('cash').reduce((sum, row) => sum + Number(row.total || 0), 0), 2500);
assert.equal(getWalletDDSMovements('card').reduce((sum, row) => sum + Number(row.total || 0), 0), 3500);
state = getRecordPaymentState({ id: 'record-split-roundtrip', procedures: [] });
assert.equal(state.remaining, 0);

// Tips are wallet cash but not service debt.
const tipsSettlement = calculateSettlement([{ sourceId: 'p-tips', name: 'Укладка', price: 7000 }]);
const tipsPayment = paymentFixture({
  id: 'payment-tips-roundtrip',
  recordId: 'record-tips-roundtrip',
  settlement: tipsSettlement,
  allocations: [{ walletId: 'cash', walletName: 'Наличные', amount: 8000 }],
  serviceAmount: 7000,
  tips: 1000,
});
reload(canonicalFinanceState({
  settlements: [settlementRow('record-tips-roundtrip', tipsSettlement)],
  payments: [tipsPayment],
}));
state = getRecordPaymentState({ id: 'record-tips-roundtrip', procedures: [] });
assert.equal(state.paidTotal, 7000);
assert.equal(state.tipsTotal, 1000);
assert.equal(state.remaining, 0);
assert.equal(getWalletDDSMovements('cash').reduce((sum, row) => sum + Number(row.total || 0), 0), 8000);

// Refund reopens debt after reload.
const refund = refundFixture({
  id: 'refund-roundtrip',
  paymentId: 'payment-tips-roundtrip',
  recordId: 'record-tips-roundtrip',
  settlement: tipsSettlement,
  walletId: 'cash',
  walletName: 'Наличные',
  serviceAmount: 1500,
});
reload(canonicalFinanceState({
  settlements: [settlementRow('record-tips-roundtrip', tipsSettlement)],
  payments: [tipsPayment],
  refunds: [refund],
}));
state = getRecordPaymentState({ id: 'record-tips-roundtrip', procedures: [] });
assert.equal(state.paidTotal, 5500);
assert.equal(state.remaining, 1500);

// Cancel keeps immutable audit rows and nets the payment to zero.
const cancelledPayment = paymentFixture({
  id: 'payment-cancel-roundtrip',
  recordId: 'record-cancel-roundtrip',
  settlement: partialSettlement,
  allocations: [{ walletId: 'cash', walletName: 'Наличные', amount: 5000 }],
  status: 'cancelled',
});
const reversal = reversalFixture({
  id: 'cancel-payment-cancel-roundtrip',
  originalOperationId: cancelledPayment.operation.operationId,
  recordId: 'record-cancel-roundtrip',
  entries: cancelledPayment.ledger,
});
reload(canonicalFinanceState({
  settlements: [settlementRow('record-cancel-roundtrip', partialSettlement)],
  payments: [cancelledPayment],
  reversals: [reversal],
}));
state = getRecordPaymentState({ id: 'record-cancel-roundtrip', procedures: [] });
assert.equal(state.paidTotal, 0);
assert.equal(state.remaining, 5000);
assert.equal(getWalletDDSMovements('cash').reduce((sum, row) => sum + Number(row.total || 0), 0), 0);

// Server remains authoritative and protects same-source money writes with Serializable transactions.
const serverFinance = readFileSync(new URL('../server/src/finance/finance.service.ts', import.meta.url), 'utf8');
const recordServer = readFileSync(new URL('../server/src/record/record.service.ts', import.meta.url), 'utf8');
assert.match(serverFinance, /TransactionIsolationLevel\.Serializable/);
assert.match(serverFinance, /saveSettlementWith\(tx/);
assert.match(serverFinance, /financeLedgerEntry\.create/);
assert.doesNotMatch(serverFinance, /queueAuxiliaryDataset/);
assert.match(recordServer, /settlementForSource/);
assert.match(recordServer, /repriceSettlement/);
assert.match(recordServer, /const \{ finance: _legacyFinance, \.\.\.currentRecord \} = current/);

console.log('finance roundtrip alignment tests: OK');
