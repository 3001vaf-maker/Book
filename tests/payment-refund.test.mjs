import assert from 'node:assert/strict';

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.has(key) ? storage.get(key) : null,
  setItem: (key, value) => storage.set(key, String(value)),
};

const {
  createPaymentDraft,
  completePayment,
  refundPayment,
  getPayments,
  getPaymentsForWallet,
  getRefundedPayments,
  getCompletedPaymentForSource,
} = await import('../core/payment.js');

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

const refundAt = new Date('2026-09-10T10:00:00.000Z');
const refunded = refundPayment(completed.id, { reason: 'Возврат клиенту', now: refundAt });

assert.equal(refunded.status, 'refunded');
assert.equal(refunded.refundedAt, refundAt.toISOString());
assert.equal(refunded.refundReason, 'Возврат клиенту');
assert.equal(getPayments().length, 1);
assert.equal(getPaymentsForWallet('cash').length, 0);
assert.equal(getRefundedPayments().length, 1);
assert.equal(getCompletedPaymentForSource('record', 'record-1'), null);
assert.equal(refundPayment(completed.id), null);

console.log('payment refund tests: OK');
