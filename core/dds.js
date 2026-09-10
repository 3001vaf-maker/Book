const STORAGE_KEY = 'book.dds';
const LEGACY_PAYMENT_KEY = 'book.payments';
const VERSION = 1;

const numberValue = (value) => {
  const number = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(number) ? number : 0;
};

const clampPercent = (value) => Math.max(0, Math.min(100, numberValue(value)));
const sourceKey = (source = null) => `${String(source?.type || '')}:${String(source?.id || '')}`;

function emptyState() {
  return { version: VERSION, operational: [], income: [], expense: [] };
}

function readLegacyPayments() {
  try {
    const value = JSON.parse(localStorage.getItem(LEGACY_PAYMENT_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function migrateLegacyPayments() {
  const state = emptyState();
  readLegacyPayments().forEach((item) => {
    if (item?.status === 'completed') state.income.push({ ...item });
    else if (item?.status === 'refund' || item?.status === 'refunded') state.expense.push({ ...item, status: 'refund' });
  });
  return state;
}

function normalizedState(value) {
  if (!value || typeof value !== 'object') return null;
  return {
    version: VERSION,
    operational: Array.isArray(value.operational) ? value.operational : [],
    income: Array.isArray(value.income) ? value.income : [],
    expense: Array.isArray(value.expense) ? value.expense : [],
  };
}

function readState() {
  try {
    const stored = normalizedState(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'));
    if (stored) return stored;
  } catch {}
  const migrated = migrateLegacyPayments();
  if (migrated.income.length || migrated.expense.length) writeState(migrated);
  return migrated;
}

function writeState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedState(state) || emptyState()));
}

function notifyDDSChanged(detail = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('book:dds-changed', { detail }));
  window.dispatchEvent(new CustomEvent('book:payments-changed', { detail }));
}

export function paymentMoment(now = new Date()) {
  return {
    date: `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getFullYear()).slice(-2)}`,
    time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    createdAt: now.toISOString(),
  };
}

export function calculateFinancialSnapshot(items = [], { discountPercent = 0 } = {}) {
  const defaultPercent = clampPercent(discountPercent);
  const prepared = (Array.isArray(items) ? items : []).map((item) => {
    const price = Math.max(0, numberValue(item?.price ?? item?.cost));
    const explicitPercent = item?.discountPercent === '' || item?.discountPercent == null
      ? null
      : clampPercent(item.discountPercent);
    const percent = explicitPercent == null ? defaultPercent : explicitPercent;
    const hasExplicitMoney = item?.discountMoney !== '' && item?.discountMoney != null;
    const discountMoney = Math.max(0, Math.min(price, hasExplicitMoney
      ? numberValue(item.discountMoney)
      : price * percent / 100));
    const resolvedPercent = price > 0
      ? (hasExplicitMoney ? discountMoney / price * 100 : percent)
      : 0;
    return {
      sourceId: item?.sourceId || item?.id || '',
      name: item?.name || '',
      price,
      discountPercent: clampPercent(resolvedPercent),
      discountMoney,
      due: Math.max(0, price - discountMoney),
    };
  });

  const serviceTotal = prepared.reduce((sum, item) => sum + item.price, 0);
  const discountTotal = prepared.reduce((sum, item) => sum + item.discountMoney, 0);
  const dueTotal = prepared.reduce((sum, item) => sum + item.due, 0);
  const percents = [...new Set(prepared.map((item) => Math.round(item.discountPercent * 10000) / 10000))];

  return {
    items: prepared,
    serviceTotal,
    discountPercent: percents.length === 1 ? percents[0] : null,
    discountTotal,
    dueTotal,
  };
}

function sameOperational(a, b) {
  return JSON.stringify({
    source: a?.source || null,
    workplace: a?.workplace || '',
    client: a?.client || null,
    status: a?.status || 'active',
    items: a?.items || [],
    serviceTotal: numberValue(a?.serviceTotal),
    discountPercent: a?.discountPercent ?? null,
    discountTotal: numberValue(a?.discountTotal),
    dueTotal: numberValue(a?.dueTotal),
  }) === JSON.stringify({
    source: b?.source || null,
    workplace: b?.workplace || '',
    client: b?.client || null,
    status: b?.status || 'active',
    items: b?.items || [],
    serviceTotal: numberValue(b?.serviceTotal),
    discountPercent: b?.discountPercent ?? null,
    discountTotal: numberValue(b?.discountTotal),
    dueTotal: numberValue(b?.dueTotal),
  });
}

export function syncOperationalFinance({ source = null, workplace = '', client = null, items = [], discountPercent = 0, status = 'active', now = new Date() } = {}) {
  if (!source?.type || !source?.id) return null;
  const state = readState();
  const key = sourceKey(source);
  const index = state.operational.findIndex((item) => sourceKey(item?.source) === key);
  const current = index >= 0 ? state.operational[index] : null;
  const calculated = calculateFinancialSnapshot(items, { discountPercent });
  const next = {
    id: current?.id || globalThis.crypto?.randomUUID?.() || `dds-operational-${Date.now()}`,
    source: { type: String(source.type), id: String(source.id) },
    workplace: String(workplace || ''),
    client: client ? { ...client } : null,
    status: String(status || 'active'),
    ...calculated,
    createdAt: current?.createdAt || now.toISOString(),
    updatedAt: now.toISOString(),
  };
  if (current && sameOperational(current, next)) return current;
  if (index >= 0) state.operational[index] = next;
  else state.operational.push(next);
  writeState(state);
  notifyDDSChanged({ action: 'operational', source: next.source, dueTotal: next.dueTotal });
  return next;
}

export function setOperationalFinanceStatus(type, id, status = 'active') {
  const state = readState();
  const key = `${String(type || '')}:${String(id || '')}`;
  const index = state.operational.findIndex((item) => sourceKey(item?.source) === key);
  if (index < 0) return null;
  const current = state.operational[index];
  const next = { ...current, status: String(status || 'active'), updatedAt: new Date().toISOString() };
  state.operational[index] = next;
  writeState(state);
  notifyDDSChanged({ action: 'operational-status', source: next.source, status: next.status });
  return next;
}

export function getOperationalFinanceForSource(type, id) {
  const key = `${String(type || '')}:${String(id || '')}`;
  return readState().operational.find((item) => sourceKey(item?.source) === key) || null;
}

function refundTotal(state, paymentId) {
  return state.expense
    .filter((item) => item?.status === 'refund' && String(item?.originalPaymentId || '') === String(paymentId || ''))
    .reduce((sum, item) => sum + Math.max(0, numberValue(item?.total)), 0);
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

function activePaymentForSource(state, source = null) {
  const key = sourceKey(source);
  if (key === ':') return null;
  const matches = state.income.filter((payment) => payment?.status === 'completed'
    && sourceKey(payment?.source) === key
    && Math.max(0, numberValue(payment.total) - refundTotal(state, payment.id)) > 0.009);
  return matches.length ? matches[matches.length - 1] : null;
}

export function paymentTotal(items = []) {
  return calculateFinancialSnapshot(items).dueTotal;
}

export function createPaymentDraft({ source = null, workplace = '', client = null, items = [], now = new Date() } = {}) {
  const moment = paymentMoment(now);
  const finance = calculateFinancialSnapshot(items);
  return {
    id: globalThis.crypto?.randomUUID?.() || `payment-${Date.now()}`,
    status: 'draft',
    source,
    workplace: String(workplace || ''),
    client: client ? { ...client } : null,
    date: moment.date,
    time: moment.time,
    createdAt: moment.createdAt,
    items: finance.items,
    total: finance.dueTotal,
    finance,
  };
}

export function completePayment(draft, { walletId = '', walletName = '', items = [], total = 0 } = {}) {
  if (!draft?.id || !walletId) return null;
  return completeSplitPayment(draft, { allocations: [{ walletId, walletName, amount: total }], items, total });
}

export function completeSplitPayment(draft, { allocations = [], items = [], total = 0 } = {}) {
  if (!draft?.id) return null;
  const state = readState();
  if (activePaymentForSource(state, draft.source)) return null;

  const finance = calculateFinancialSnapshot(Array.isArray(items) && items.length ? items : draft.items);
  const requestedTotal = Math.max(0, numberValue(total));
  if (Math.abs(finance.dueTotal - requestedTotal) > 0.009) return null;

  const preparedAllocations = (Array.isArray(allocations) ? allocations : [])
    .map((item) => ({
      id: globalThis.crypto?.randomUUID?.() || `allocation-${Date.now()}-${Math.random()}`,
      walletId: String(item?.walletId || ''),
      walletName: String(item?.walletName || ''),
      amount: Math.max(0, numberValue(item?.amount)),
    }))
    .filter((item) => item.walletId && item.amount > 0);
  const allocated = preparedAllocations.reduce((sum, item) => sum + item.amount, 0);
  if (!preparedAllocations.length || Math.abs(allocated - finance.dueTotal) > 0.009) return null;

  const operational = syncOperationalFinance({
    source: draft.source,
    workplace: draft.workplace,
    client: draft.client,
    items: finance.items,
  });
  const payment = {
    ...draft,
    id: globalThis.crypto?.randomUUID?.() || `payment-${Date.now()}`,
    status: 'completed',
    allocations: preparedAllocations,
    walletId: preparedAllocations.length === 1 ? preparedAllocations[0].walletId : '',
    walletName: preparedAllocations.length === 1 ? preparedAllocations[0].walletName : '',
    items: finance.items,
    total: finance.dueTotal,
    finance: operational || finance,
    paidAt: new Date().toISOString(),
  };
  const latest = readState();
  latest.income.push(payment);
  writeState(latest);
  notifyDDSChanged({ action: 'complete', paymentId: payment.id, total: payment.total, source: payment.source || null });
  return payment;
}

export function refundPayment(paymentId, { reason = '', amount = null, walletId = '', walletName = '', now = new Date() } = {}) {
  const id = String(paymentId || '');
  const state = readState();
  const original = state.income.find((payment) => String(payment?.id || '') === id && payment?.status === 'completed');
  if (!original) return null;
  const alreadyRefunded = refundTotal(state, id);
  const remaining = Math.max(0, numberValue(original.total) - alreadyRefunded);
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
    expenseType: 'refund',
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
  state.expense.push(refund);
  writeState(state);
  notifyDDSChanged({
    action: refundAmount >= remaining - 0.009 ? 'refund-full' : 'refund-partial',
    paymentId: refund.id,
    originalPaymentId: original.id,
    total: refund.total,
    source: refund.source || null,
  });
  return refund;
}

export function getPayments() {
  const state = readState();
  return [...state.income, ...state.expense]
    .sort((a, b) => String(a?.createdAt || '').localeCompare(String(b?.createdAt || '')));
}

export function getPaymentRemaining(paymentId) {
  const state = readState();
  const payment = state.income.find((item) => String(item?.id || '') === String(paymentId || '') && item?.status === 'completed');
  if (!payment) return 0;
  return Math.max(0, numberValue(payment.total) - refundTotal(state, payment.id));
}

export function getPaymentsForWallet(walletId) {
  const id = String(walletId || '');
  const state = readState();
  const entries = [];

  state.income.forEach((payment) => {
    if (payment?.status !== 'completed') return;
    normalizedAllocations(payment)
      .filter((allocation) => allocation.walletId === id)
      .forEach((allocation) => entries.push({
        ...payment,
        ledgerType: 'payment',
        walletId: allocation.walletId,
        walletName: allocation.walletName,
        total: allocation.amount,
      }));
  });

  state.expense.forEach((expense) => {
    if (expense?.status === 'refund' && String(expense?.walletId || '') === id) {
      entries.push({ ...expense, ledgerType: 'refund', total: -Math.max(0, numberValue(expense.total)) });
    }
  });

  return entries.sort((a, b) => String(a?.createdAt || '').localeCompare(String(b?.createdAt || '')));
}

export function getRefundedPayments() {
  return readState().expense.filter((item) => item?.status === 'refund');
}

export function getRefundsForPayment(paymentId) {
  return readState().expense.filter((item) => item?.status === 'refund' && String(item?.originalPaymentId || '') === String(paymentId || ''));
}

export function getCompletedPaymentForSource(type, id) {
  const source = { type: String(type || ''), id: String(id || '') };
  if (!source.type || !source.id) return null;
  return activePaymentForSource(readState(), source);
}

export function getFinanceForSource(type, id) {
  const state = readState();
  const source = { type: String(type || ''), id: String(id || '') };
  const operational = state.operational.find((item) => sourceKey(item?.source) === sourceKey(source));
  if (!operational) return null;
  const payments = state.income.filter((item) => item?.status === 'completed' && sourceKey(item?.source) === sourceKey(source));
  const paymentIds = new Set(payments.map((item) => String(item.id || '')));
  const paidTotal = payments.reduce((sum, item) => sum + Math.max(0, numberValue(item.total)), 0);
  const refundedTotal = state.expense
    .filter((item) => item?.status === 'refund' && paymentIds.has(String(item?.originalPaymentId || '')))
    .reduce((sum, item) => sum + Math.max(0, numberValue(item.total)), 0);
  return {
    ...operational,
    paidTotal,
    refundedTotal,
    netPaidTotal: Math.max(0, paidTotal - refundedTotal),
  };
}

export function recordDueTotal(record = null) {
  const stored = numberValue(record?.finance?.dueTotal);
  if (record?.finance && Number.isFinite(Number(record.finance.dueTotal))) return Math.max(0, stored);
  const source = record?.id ? getOperationalFinanceForSource('record', record.id) : null;
  if (source) return Math.max(0, numberValue(source.dueTotal));
  return calculateFinancialSnapshot(record?.procedures || [], { discountPercent: record?.clientDiscountPercent || 0 }).dueTotal;
}
