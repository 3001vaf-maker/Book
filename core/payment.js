const STORAGE_KEY = 'book.payments';

const numberValue = (value) => {
  const number = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(number) ? number : 0;
};

function readPayments() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function writePayments(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.isArray(items) ? items : []));
}

function notifyPaymentsChanged(detail = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('book:payments-changed', { detail }));
}

function refundsTotal(payments, paymentId) {
  return payments
    .filter((payment) => payment?.status === 'refund' && String(payment?.originalPaymentId || '') === String(paymentId || ''))
    .reduce((sum, payment) => sum + Math.max(0, numberValue(payment?.total)), 0);
}

export function paymentMoment(now = new Date()) {
  return {
    date: `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getFullYear()).slice(-2)}`,
    time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    createdAt: now.toISOString(),
  };
}

export function paymentTotal(items = []) {
  return (Array.isArray(items) ? items : []).reduce((sum, item) => {
    const price = Math.max(0, numberValue(item?.price ?? item?.cost));
    const discount = Math.max(0, Math.min(price, numberValue(item?.discountMoney)));
    return sum + Math.max(0, price - discount);
  }, 0);
}

function preparedItems(items = []) {
  return (Array.isArray(items) ? items : []).map((item) => ({
    sourceId: item?.sourceId || item?.id || '',
    name: item?.name || '',
    price: Math.max(0, numberValue(item?.price ?? item?.cost)),
    discountPercent: Math.max(0, Math.min(100, numberValue(item?.discountPercent))),
    discountMoney: Math.max(0, numberValue(item?.discountMoney)),
  }));
}

export function createPaymentDraft({ source = null, workplace = '', client = null, items = [], now = new Date() } = {}) {
  const moment = paymentMoment(now);
  const itemsPrepared = preparedItems(items);
  return {
    id: globalThis.crypto?.randomUUID?.() || `payment-${Date.now()}`,
    status: 'draft',
    source,
    workplace: String(workplace || ''),
    client: client ? { ...client } : null,
    date: moment.date,
    time: moment.time,
    createdAt: moment.createdAt,
    items: itemsPrepared,
    total: paymentTotal(itemsPrepared),
  };
}

export function completePayment(draft, { walletId = '', walletName = '', items = [], total = 0 } = {}) {
  if (!draft?.id || !walletId) return null;
  return completeSplitPayment(draft, { allocations: [{ walletId, walletName, amount: total }], items, total });
}

export function completeSplitPayment(draft, { allocations = [], items = [], total = 0, replacesPaymentId = '' } = {}) {
  if (!draft?.id) return null;
  const preparedAllocations = (Array.isArray(allocations) ? allocations : [])
    .map((item) => ({
      id: globalThis.crypto?.randomUUID?.() || `allocation-${Date.now()}-${Math.random()}`,
      walletId: String(item?.walletId || ''),
      walletName: String(item?.walletName || ''),
      amount: Math.max(0, numberValue(item?.amount)),
    }))
    .filter((item) => item.walletId && item.amount > 0);
  const expected = Math.max(0, numberValue(total));
  const allocated = preparedAllocations.reduce((sum, item) => sum + item.amount, 0);
  if (!preparedAllocations.length || Math.abs(allocated - expected) > 0.009) return null;

  const payments = readPayments();
  if (replacesPaymentId) {
    const previousIndex = payments.findIndex((item) => String(item?.id || '') === String(replacesPaymentId));
    if (previousIndex >= 0 && payments[previousIndex]?.status === 'completed') {
      payments[previousIndex] = { ...payments[previousIndex], status: 'corrected', correctedAt: new Date().toISOString() };
    }
  }

  const payment = {
    ...draft,
    id: globalThis.crypto?.randomUUID?.() || `payment-${Date.now()}`,
    status: 'completed',
    allocations: preparedAllocations,
    walletId: preparedAllocations.length === 1 ? preparedAllocations[0].walletId : '',
    walletName: preparedAllocations.length === 1 ? preparedAllocations[0].walletName : '',
    items: preparedItems(items),
    total: expected,
    paidAt: new Date().toISOString(),
    replacesPaymentId: String(replacesPaymentId || ''),
  };
  payments.push(payment);
  writePayments(payments);
  notifyPaymentsChanged({ action: replacesPaymentId ? 'correct' : 'complete', paymentId: payment.id, total: payment.total, source: payment.source || null });
  return payment;
}

export function refundPayment(paymentId, { reason = '', amount = null, walletId = '', walletName = '', now = new Date() } = {}) {
  const id = String(paymentId || '');
  const payments = readPayments();
  const original = payments.find((payment) => String(payment?.id || '') === id && payment?.status === 'completed');
  if (!original) return null;
  const alreadyRefunded = refundsTotal(payments, id);
  const remaining = Math.max(0, Number(original.total || 0) - alreadyRefunded);
  const refundAmount = Math.min(remaining, Math.max(0, amount == null ? remaining : numberValue(amount)));
  if (!refundAmount) return null;
  const fallbackAllocation = original.allocations?.[0] || null;
  const refund = {
    id: globalThis.crypto?.randomUUID?.() || `refund-${Date.now()}`,
    status: 'refund',
    originalPaymentId: original.id,
    source: original.source || null,
    workplace: original.workplace || '',
    client: original.client || null,
    walletId: String(walletId || fallbackAllocation?.walletId || original.walletId || ''),
    walletName: String(walletName || fallbackAllocation?.walletName || original.walletName || ''),
    total: refundAmount,
    reason: String(reason || ''),
    createdAt: now.toISOString(),
    refundedAt: now.toISOString(),
  };
  payments.push(refund);
  writePayments(payments);
  notifyPaymentsChanged({
    action: refundAmount >= remaining - 0.009 ? 'refund-full' : 'refund-partial',
    paymentId: refund.id,
    originalPaymentId: original.id,
    total: refund.total,
    source: refund.source || null,
  });
  return refund;
}

export function getPayments() {
  return readPayments();
}

export function getPaymentRemaining(paymentId) {
  const payments = readPayments();
  const payment = payments.find((item) => String(item?.id || '') === String(paymentId || '') && item?.status === 'completed');
  if (!payment) return 0;
  return Math.max(0, numberValue(payment.total) - refundsTotal(payments, payment.id));
}

export function getPaymentsForWallet(walletId) {
  const id = String(walletId || '');
  const payments = readPayments();
  return payments.filter((payment) => payment?.status === 'completed').flatMap((payment) => {
    const allocations = Array.isArray(payment.allocations) && payment.allocations.length
      ? payment.allocations
      : [{ walletId: payment.walletId || '', walletName: payment.walletName || '', amount: payment.total || 0 }];
    const refunds = payments.filter((item) => item?.status === 'refund' && String(item?.originalPaymentId || '') === String(payment.id));
    return allocations.filter((item) => String(item.walletId || '') === id).map((item) => {
      const refunded = refunds.filter((refund) => String(refund.walletId || '') === id).reduce((sum, refund) => sum + Number(refund.total || 0), 0);
      return { ...payment, walletId: item.walletId, walletName: item.walletName, total: Math.max(0, Number(item.amount || 0) - refunded) };
    }).filter((item) => item.total > 0);
  });
}

export function getRefundedPayments() {
  return readPayments().filter((payment) => payment?.status === 'refund' || payment?.status === 'refunded');
}

export function getRefundsForPayment(paymentId) {
  return readPayments().filter((payment) => payment?.status === 'refund' && String(payment?.originalPaymentId || '') === String(paymentId || ''));
}

export function getCompletedPaymentForSource(type, id) {
  const sourceType = String(type || '');
  const sourceId = String(id || '');
  if (!sourceType || !sourceId) return null;
  const payments = readPayments();
  const matches = payments.filter((payment) => payment?.status === 'completed'
    && String(payment?.source?.type || '') === sourceType
    && String(payment?.source?.id || '') === sourceId
    && Math.max(0, numberValue(payment.total) - refundsTotal(payments, payment.id)) > 0.009);
  return matches.length ? matches[matches.length - 1] : null;
}
