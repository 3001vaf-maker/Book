import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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

const coreSource = readFileSync(new URL('../core/payment.js', import.meta.url), 'utf8');
const recordPaymentSource = readFileSync(new URL('../journal/record-payment.js', import.meta.url), 'utf8');
const paymentUiSource = readFileSync(new URL('../ui/payment/index.js', import.meta.url), 'utf8');
const forbiddenEditPayment = /replacesPaymentId|status:\s*['"]corrected['"]|data-edit-payment|openPaymentEditor|Редактировать оплату/;
assert.doesNotMatch(coreSource, forbiddenEditPayment);
assert.doesNotMatch(recordPaymentSource, forbiddenEditPayment);
assert.doesNotMatch(paymentUiSource, forbiddenEditPayment);

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

const duplicateDraft = createPaymentDraft({
  source: { type: 'record', id: 'record-1' },
  items: [{ id: 'procedure-1', name: 'Стрижка', cost: 5000 }],
});
assert.equal(completePayment(duplicateDraft, {
  walletId: 'cash',
  walletName: 'Наличные',
  items: duplicateDraft.items,
  total: 5000,
}), null);
assert.equal(getPayments().length, 1);

const refundAt = new Date('2026-09-10T10:00:00.000Z');
const refunded = refundPayment(completed.id, { reason: 'Возврат клиенту', now: refundAt });

assert.equal(refunded.status, 'refund');
assert.equal(refunded.refundedAt, refundAt.toISOString());
assert.equal(refunded.reason, 'Возврат клиенту');
assert.equal(getPayments().length, 2);
assert.equal(getPaymentsForWallet('cash').reduce((sum, item) => sum + Number(item.total || 0), 0), 0);
assert.equal(getPaymentsForWallet('cash').filter((item) => item.ledgerType === 'refund').length, 1);
assert.equal(getRefundedPayments().length, 1);
assert.equal(getRefundsForPayment(completed.id).length, 1);
assert.equal(getPaymentRemaining(completed.id), 0);
assert.equal(getCompletedPaymentForSource('record', 'record-1'), null);
assert.equal(refundPayment(completed.id), null);

const repayDraft = createPaymentDraft({
  source: { type: 'record', id: 'record-1' },
  items: [{ id: 'procedure-1', name: 'Стрижка', cost: 5000 }],
});
const repaid = completePayment(repayDraft, {
  walletId: 'cash',
  walletName: 'Наличные',
  items: repayDraft.items,
  total: 5000,
});
assert.ok(repaid);
assert.equal(getCompletedPaymentForSource('record', 'record-1')?.id, repaid.id);

const invalidDraft = createPaymentDraft({
  source: { type: 'record', id: 'record-invalid' },
  items: [{ id: 'procedure-invalid', name: 'Услуга', cost: 1000 }],
});
assert.equal(completePayment(invalidDraft, {
  walletId: 'cash',
  walletName: 'Наличные',
  items: invalidDraft.items,
  total: 900,
}), null);

const splitDraft = createPaymentDraft({
  source: { type: 'record', id: 'record-2' },
  workplace: 'workplace-1',
  client: { key: 'client-2' },
  items: [{ id: 'procedure-2', name: 'Окрашивание', cost: 6000 }],
});
const split = completeSplitPayment(splitDraft, {
  allocations: [
    { walletId: 'split-cash', walletName: 'Наличные', amount: 2000 },
    { walletId: 'split-card', walletName: 'Карта', amount: 4000 },
  ],
  items: [{ sourceId: 'procedure-2', name: 'Окрашивание', price: 6000 }],
  total: 6000,
});
assert.equal(split.status, 'completed');
assert.equal(split.allocations.length, 2);
assert.equal(getPaymentsForWallet('split-cash').reduce((sum, item) => sum + Number(item.total || 0), 0), 2000);
assert.equal(getPaymentsForWallet('split-card').reduce((sum, item) => sum + Number(item.total || 0), 0), 4000);
assert.equal(refundPayment(split.id), null);

const partial = refundPayment(split.id, { amount: 1000, walletId: 'split-card', walletName: 'Карта' });
assert.equal(partial.total, 1000);
assert.equal(getPaymentRemaining(split.id), 5000);
assert.equal(getCompletedPaymentForSource('record', 'record-2')?.id, split.id);
assert.equal(getPaymentsForWallet('split-card').reduce((sum, item) => sum + Number(item.total || 0), 0), 3000);

const finalRefund = refundPayment(split.id, { amount: 5000, walletId: 'split-cash', walletName: 'Наличные' });
assert.equal(finalRefund.total, 5000);
assert.equal(getPaymentRemaining(split.id), 0);
assert.equal(getCompletedPaymentForSource('record', 'record-2'), null);
const splitLedgerTotal = [...getPaymentsForWallet('split-cash'), ...getPaymentsForWallet('split-card')]
  .reduce((sum, item) => sum + Number(item.total || 0), 0);
assert.equal(splitLedgerTotal, 0);
assert.equal(getPayments().some((item) => item?.status === 'corrected'), false);

console.log('payment refund tests: OK');
