import assert from 'node:assert/strict';

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.has(key) ? storage.get(key) : null,
  setItem: (key, value) => storage.set(key, String(value)),
};

const {
  createPaymentDraft,
  completePayment,
  completeSplitPayment,
  refundPayment,
  paymentTotal,
  getPayments,
  getPaymentsForWallet,
  getRefundedPayments,
  getCompletedPaymentForSource,
  getRefundsForPayment,
  getPaymentRemaining,
} = await import('../core/payment.js');

assert.equal(paymentTotal([{ price: 8000, discountMoney: 800 }]), 7200);

const draft = createPaymentDraft({
  source: { type: 'record', id: 'record-1' },
  workplace: 'workplace-1',
  client: { key: 'client-1' },
  items: [{ id: 'procedure-1', name: 'Стрижка', cost: 5000 }],
});

const completed = completePayment(draft, {
  walletId: 'cash',
  walletName: 'Наличные',
  items: [{ sourceId: 'procedure-1', name: 'Стрижка', price: 5000, discountPercent: 0, discountMoney: 0 }],
  total: 5000,
});

assert.equal(completed.status, 'completed');
assert.equal(getPaymentsForWallet('cash').length, 1);
assert.equal(getCompletedPaymentForSource('record', 'record-1')?.id, completed.id);
assert.equal(getPaymentRemaining(completed.id), 5000);

const refundAt = new Date('2026-09-10T10:00:00.000Z');
const refunded = refundPayment(completed.id, { reason: 'Возврат клиенту', now: refundAt });

assert.equal(refunded.status, 'refund');
assert.equal(refunded.refundedAt, refundAt.toISOString());
assert.equal(refunded.reason, 'Возврат клиенту');
assert.equal(getPayments().length, 2);
assert.equal(getPaymentsForWallet('cash').length, 0);
assert.equal(getRefundedPayments().length, 1);
assert.equal(getRefundsForPayment(completed.id).length, 1);
assert.equal(getPaymentRemaining(completed.id), 0);
assert.equal(getCompletedPaymentForSource('record', 'record-1'), null);
assert.equal(refundPayment(completed.id), null);

const splitDraft = createPaymentDraft({
  source: { type: 'record', id: 'record-2' },
  workplace: 'workplace-1',
  client: { key: 'client-2' },
  items: [{ id: 'procedure-2', name: 'Окрашивание', cost: 6000 }],
});
const split = completeSplitPayment(splitDraft, {
  allocations: [
    { walletId: 'cash', walletName: 'Наличные', amount: 2000 },
    { walletId: 'card', walletName: 'Карта', amount: 4000 },
  ],
  items: [{ sourceId: 'procedure-2', name: 'Окрашивание', price: 6000 }],
  total: 6000,
});
assert.equal(split.status, 'completed');
assert.equal(split.allocations.length, 2);
assert.equal(getPaymentsForWallet('cash').at(-1)?.total, 2000);
assert.equal(getPaymentsForWallet('card').at(-1)?.total, 4000);

const partial = refundPayment(split.id, { amount: 1000, walletId: 'card', walletName: 'Карта' });
assert.equal(partial.total, 1000);
assert.equal(getPaymentRemaining(split.id), 5000);
assert.equal(getCompletedPaymentForSource('record', 'record-2')?.id, split.id);

console.log('payment refund tests: OK');
