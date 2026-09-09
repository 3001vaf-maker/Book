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

export function createPaymentDraft({ source = null, workplace = '', client = null, items = [], now = new Date() } = {}) {
  const moment = paymentMoment(now);
  const preparedItems = (Array.isArray(items) ? items : []).map((item) => ({
    sourceId: item?.id || '',
    name: item?.name || '',
    price: Math.max(0, numberValue(item?.price ?? item?.cost)),
    discountPercent: 0,
    discountMoney: 0,
  }));

  return {
    id: globalThis.crypto?.randomUUID?.() || `payment-${Date.now()}`,
    status: 'draft',
    source,
    workplace: String(workplace || ''),
    client: client ? { ...client } : null,
    date: moment.date,
    time: moment.time,
    createdAt: moment.createdAt,
    items: preparedItems,
    total: paymentTotal(preparedItems),
  };
}

export function completePayment(draft, { walletId = '', walletName = '', items = [], total = 0 } = {}) {
  if (!draft?.id || !walletId) return null;
  const preparedItems = (Array.isArray(items) ? items : []).map((item) => ({
    sourceId: item?.sourceId || '',
    name: item?.name || '',
    price: Math.max(0, numberValue(item?.price)),
    discountPercent: Math.max(0, numberValue(item?.discountPercent)),
    discountMoney: Math.max(0, numberValue(item?.discountMoney)),
  }));
  const payment = {
    ...draft,
    status: 'completed',
    walletId: String(walletId),
    walletName: String(walletName || ''),
    items: preparedItems,
    total: Math.max(0, numberValue(total)),
    paidAt: new Date().toISOString(),
  };
  writePayments([...readPayments(), payment]);
  window.dispatchEvent(new CustomEvent('book:payments-changed', { detail: { paymentId: payment.id, walletId: payment.walletId } }));
  return payment;
}

export function getPayments() {
  return readPayments();
}

export function getPaymentsForWallet(walletId) {
  return readPayments().filter((payment) => payment?.status === 'completed' && String(payment?.walletId || '') === String(walletId || ''));
}
