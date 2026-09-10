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

function normalizedAllocations(payment) {
  if (Array.isArray(payment?.allocations) && payment.allocations.length) {
    return payment.allocations.map((item) => ({
      walletId: String(item?.walletId || ''),
      walletName: String(item?.walletName || ''),
      amount: Math.max(0, numberValue(item?.amount)),
    })).filter((item) => item.walletId && item.amount > 0);
  }
  if (!payment?.walletId) return [];
  return [{
    walletId: String(payment.walletId || ''),
    walletName: String(payment.walletName || ''),
    amount: Math.max(0, numberValue(payment.total)),
  }];
}

function activePaymentForSource(payments, source = null) {
  const sourceType = String(source?.type || '');
  const sourceId = String(source?.id || '');
  if (!sourceType || !sourceId) return null;
  const matches = payments.filter((payment) => payment?.status === 'completed'
    && String(payment?.source?.type || '') === sourceType
    && String(payment?.source?.id || '') === sourceId
    && Math.max(0, numberValue(payment.total) - refundsTotal(payments, payment.id)) > 0.009);
  return matches.length ? matches[matches.length - 1] : null;
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

export function completeSplitPayment(draft, { allocations = [], items = [], total = 0 } = {}) {
  if (!draft?.id) return null;
  const payments = readPayments();
  if (activePaymentForSource(payments, draft.source)) return null;

  const finalItems = preparedItems(Array.isArray(items) && items.length ? items : draft.items);
  const expected = paymentTotal(finalItems);
  const requestedTotal = Math.max(0, numberValue(total));
  if (Math.abs(expected - requestedTotal) > 0.009) return null;

  const preparedAllocations = (Array.isArray(allocations) ? allocations : [])
    .map((item) => ({
      id: globalThis.crypto?.randomUUID?.() || `allocation-${Date.now()}-${Math.random()}`,
      walletId: String(item?.walletId || ''),
      walletName: String(item?.walletName || ''),
      amount: Math.max(0, numberValue(item?.amount)),
    }))
    .filter((item) => item.walletId && item.amount > 0);
  const allocated = preparedAllocations.reduce((sum, item) => sum + item.amount, 0);
  if (!preparedAllocations.length || Math.abs(allocated - expected) > 0.009) return null;

  const payment = {
    ...draft,
    id: globalThis.crypto?.randomUUID?.() || `payment-${Date.now()}`,
    status: 'completed',
    allocations: preparedAllocations,
    walletId: preparedAllocations.length === 1 ? preparedAllocations[0].walletId : '',
    walletName: preparedAllocations.length === 1 ? preparedAllocations[0].walletName : '',
    items: finalItems,
    total: expected,
    paidAt: new Date().toISOString(),
  };
  payments.push(payment);
  writePayments(payments);
  notifyPaymentsChanged({ action: 'complete', paymentId: payment.id, total: payment.total, source: payment.source || null });
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

  const allocations = normalizedAllocations(original);
  const fallbackAllocation = allocations.length === 1 ? allocations[0] : null;
  const resolvedWalletId = String(walletId || fallbackAllocation?.walletId || '');
  const resolvedWalletName = String(walletName || fallbackAllocation?.walletName || '');
  if (!resolvedWalletId) return null;

  const refund = {
    id: globalThis.crypto?.randomUUID?.() || `refund-${Date.now()}`,
    status: 'refund',
    originalPaymentId: original.id,
    source: original.source || null,
    workplace: original.workplace || '',
    client: original.client || null,
    walletId: resolvedWalletId,
    walletName: resolvedWalletName,
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
  const entries = [];

  payments.forEach((payment) => {
    if (payment?.status === 'completed') {
      normalizedAllocations(payment)
        .filter((allocation) => allocation.walletId === id)
        .forEach((allocation) => entries.push({
          ...payment,
          ledgerType: 'payment',
          walletId: allocation.walletId,
          walletName: allocation.walletName,
          total: allocation.amount,
        }));
      return;
    }
    if (payment?.status === 'refund' && String(payment?.walletId || '') === id) {
      entries.push({ ...payment, ledgerType: 'refund', total: -Math.max(0, numberValue(payment.total)) });
    }
  });

  return entries.sort((a, b) => String(a?.createdAt || '').localeCompare(String(b?.createdAt || '')));
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
  return activePaymentForSource(readPayments(), { type: sourceType, id: sourceId });
}
