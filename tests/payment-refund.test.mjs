import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calculateFinancialPlan } from '../core/financial-model.js';
import {
  getActivePaymentForSource,
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

// Existing DDS v2 entries keep their full financial snapshot when renamed to `finance`.
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
assert.equal(migratedLegacy[0].business, undefined);
const storedMigrated = JSON.parse(storage.get('book.dds') || '{}');
assert.equal(storedMigrated.version, 3);
assert.equal(storedMigrated.income[0].finance.planTotal, 6400);
assert.equal(storedMigrated.income[0].business, undefined);
storage.clear();

const discounted = calculateFinancialPlan([{ sourceId: 'procedure-discount', name: 'Стрижка', price: 8000, discountPercent: 10 }]);
assert.equal(discounted.serviceTotal, 8000);
assert.equal(discounted.discountTotal, 800);
assert.equal(discounted.planTotal, 7200);

const finance = calculateFinancialPlan([{ sourceId: 'procedure-1', name: 'Стрижка', price: 5000 }]);
const completed = recordPaymentIncome({
  source: { type: 'record', id: 'record-1' },
  workplace: 'workplace-1',
  client: { key: 'client-1' },
  finance,
  allocations: [{ walletId: 'cash', walletName: 'Наличные', amount: 5000 }],
});

assert.equal(completed.status, 'completed');
assert.equal(completed.movementType, 'income');
assert.equal(completed.finance.serviceTotal, 5000);
assert.equal(getWalletDDSMovements('cash').length, 1);
assert.equal(getActivePaymentForSource('record', 'record-1')?.id, completed.id);
assert.equal(getPaymentRemaining(completed.id), 5000);

assert.equal(recordPaymentIncome({
  source: { type: 'record', id: 'record-1' },
  finance,
  allocations: [{ walletId: 'cash', walletName: 'Наличные', amount: 5000 }],
}), null);
assert.equal(getDDSIncome().length, 1);

const refundAt = new Date('2026-09-10T10:00:00.000Z');
const refunded = recordRefundExpense(completed.id, { reason: 'Возврат клиенту', now: refundAt });
assert.equal(refunded.status, 'refund');
assert.equal(refunded.movementType, 'expense');
assert.equal(refunded.expenseType, 'refund');
assert.equal(refunded.refundedAt, refundAt.toISOString());
assert.equal(refunded.reason, 'Возврат клиенту');
assert.equal(getDDSExpenses().length, 1);
assert.equal(getWalletDDSMovements('cash').reduce((sum, item) => sum + Number(item.total || 0), 0), 0);
assert.equal(getRefundsForPayment(completed.id).length, 1);
assert.equal(getPaymentRemaining(completed.id), 0);
assert.equal(getActivePaymentForSource('record', 'record-1'), null);
assert.equal(recordRefundExpense(completed.id), null);

const repaid = recordPaymentIncome({
  source: { type: 'record', id: 'record-1' },
  finance,
  allocations: [{ walletId: 'cash', walletName: 'Наличные', amount: 5000 }],
});
assert.ok(repaid);
assert.equal(getActivePaymentForSource('record', 'record-1')?.id, repaid.id);

const invalidFinance = calculateFinancialPlan([{ sourceId: 'procedure-invalid', name: 'Услуга', price: 1000 }]);
assert.equal(recordPaymentIncome({
  source: { type: 'record', id: 'record-invalid' },
  finance: invalidFinance,
  allocations: [{ walletId: 'cash', walletName: 'Наличные', amount: 900 }],
}), null);

const splitFinance = calculateFinancialPlan([{ sourceId: 'procedure-2', name: 'Окрашивание', price: 6000 }]);
const split = recordPaymentIncome({
  source: { type: 'record', id: 'record-2' },
  workplace: 'workplace-1',
  client: { key: 'client-2' },
  finance: splitFinance,
  allocations: [
    { walletId: 'split-cash', walletName: 'Наличные', amount: 2000 },
    { walletId: 'split-card', walletName: 'Карта', amount: 4000 },
  ],
});
assert.equal(split.status, 'completed');
assert.equal(split.allocations.length, 2);
assert.equal(getWalletDDSMovements('split-cash').reduce((sum, item) => sum + Number(item.total || 0), 0), 2000);
assert.equal(getWalletDDSMovements('split-card').reduce((sum, item) => sum + Number(item.total || 0), 0), 4000);
assert.equal(recordRefundExpense(split.id), null);

const partial = recordRefundExpense(split.id, { amount: 1000, walletId: 'split-card', walletName: 'Карта' });
assert.equal(partial.total, 1000);
assert.equal(getPaymentRemaining(split.id), 5000);
assert.equal(getActivePaymentForSource('record', 'record-2')?.id, split.id);
assert.equal(getWalletDDSMovements('split-card').reduce((sum, item) => sum + Number(item.total || 0), 0), 3000);

const finalRefund = recordRefundExpense(split.id, { amount: 5000, walletId: 'split-cash', walletName: 'Наличные' });
assert.equal(finalRefund.total, 5000);
assert.equal(getPaymentRemaining(split.id), 0);
assert.equal(getActivePaymentForSource('record', 'record-2'), null);
const splitLedgerTotal = [...getWalletDDSMovements('split-cash'), ...getWalletDDSMovements('split-card')]
  .reduce((sum, item) => sum + Number(item.total || 0), 0);
assert.equal(splitLedgerTotal, 0);

console.log('payment refund tests: OK');
