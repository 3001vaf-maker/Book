const STORAGE_KEY = 'book.dds';
const LEGACY_PAYMENT_KEY = 'book.payments';
const VERSION = 4;

const numberValue = (value) => {
  const number = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(number) ? number : 0;
};

const sourceKey = (source = null) => `${String(source?.type || '')}:${String(source?.id || '')}`;

function emptyState() {
  return { version: VERSION, income: [], expense: [] };
}

function readLegacyPayments() {
  try {
    const value = JSON.parse(localStorage.getItem(LEGACY_PAYMENT_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function normalizeFinancialSnapshot(value = null) {
  if (!value || typeof value !== 'object') return null;
  return {
    items: Array.isArray(value.items) ? value.items.map((item) => ({ ...item })) : [],
    serviceTotal: Math.max(0, numberValue(value.serviceTotal)),
    discountPercent: value.discountPercent == null ? null : Math.max(0, Math.min(100, numberValue(value.discountPercent))),
    discountTotal: Math.max(0, numberValue(value.discountTotal)),
    planTotal: Math.max(0, numberValue(value.planTotal ?? value.dueTotal)),
  };
}

function legacyFinancialSnapshot(item = {}) {
  return item?.['business'] || null;
}

function normalizeIncome(item = {}) {
  const { finance: currentFinance, ...rest } = item;
  delete rest['business'];
  const total = Math.max(0, numberValue(item.total));
  const tips = Math.max(0, Math.min(total, numberValue(item.tips)));
  const serviceAmount = Math.max(0, Math.min(total, numberValue(item.serviceAmount ?? (total - tips))));
  const finance = normalizeFinancialSnapshot(currentFinance || legacyFinancialSnapshot(item));
  return {
    ...rest,
    status: 'completed',
    movementType: 'income',
    incomeType: item.incomeType || 'payment',
    source: item.source || null,
    total,
    serviceAmount,
    tips,
    allocations: Array.isArray(item.allocations) ? item.allocations.map((entry) => ({ ...entry })) : [],
    finance,
  };
}

function normalizeExpense(item = {}) {
  const { finance: currentFinance, ...rest } = item;
  delete rest['business'];
  return {
    ...rest,
    status: item.status === 'refund' ? 'refund' : (item.status || 'expense'),
    movementType: 'expense',
    expenseType: item.expenseType || (item.status === 'refund' ? 'refund' : 'other'),
    source: item.source || null,
    total: Math.max(0, numberValue(item.total)),
    finance: normalizeFinancialSnapshot(currentFinance || legacyFinancialSnapshot(item)),
  };
}

function migrateLegacyPayments() {
  const state = emptyState();
  readLegacyPayments().forEach((item) => {
    if (item?.status === 'completed') state.income.push(normalizeIncome(item));
    else if (item?.status === 'refund' || item?.status === 'refunded') state.expense.push(normalizeExpense({ ...item, status: 'refund', expenseType: 'refund' }));
  });
  return state;
}

function normalizedState(value) {
  if (!value || typeof value !== 'object') return null;
  const legacyOperational = Array.isArray(value.operational) ? value.operational : [];
  const income = Array.isArray(value.income) ? value.income.map(normalizeIncome) : [];
  const expense = Array.isArray(value.expense) ? value.expense.map(normalizeExpense) : [];
  if (legacyOperational.length) {
    const bySource = new Map(legacyOperational.map((entry) => [sourceKey(entry?.source), entry]));
    income.forEach((entry) => {
      if (entry.finance) return;
      const legacy = bySource.get(sourceKey(entry?.source));
      if (legacy) entry.finance = normalizeFinancialSnapshot(legacy);
    });
  }
  return { version: VERSION, income, expense };
}

function writeState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedState(state) || emptyState()));
}

function readState() {
  try {
    const storedRaw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    const stored = normalizedState(storedRaw);
    if (stored) {
      const hasLegacySnapshot = [...(storedRaw?.income || []), ...(storedRaw?.expense || [])].some((item) => item?.['business']);
      if (storedRaw?.version !== VERSION || Array.isArray(storedRaw?.operational) || hasLegacySnapshot) writeState(stored);
      return stored;
    }
  } catch {}
  const migrated = migrateLegacyPayments();
  if (migrated.income.length || migrated.expense.length) writeState(migrated);
  return migrated;
}

function notifyDDSChanged(detail = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('book:dds-changed', { detail }));
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

function refundTotal(state, paymentId) {
  return state.expense
    .filter((item) => item?.expenseType === 'refund' && String(item?.originalPaymentId || '') === String(paymentId || ''))
    .reduce((sum, item) => sum + Math.max(0, numberValue(item?.total)), 0);
}

export function recordPaymentIncome({ source = null, workplace = '', client = null, finance = null, allocations = [], maxAmount = null, serviceAmount = null, tips = 0, now = new Date() } = {}) {
  if (!source?.type || !source?.id) return null;
  const snapshot = normalizeFinancialSnapshot(finance);
  if (!snapshot || maxAmount == null) return null;
  const limit = Math.max(0, numberValue(maxAmount));
  if (limit <= 0.009) return null;

  const preparedAllocations = (Array.isArray(allocations) ? allocations : [])
    .map((item) => ({
      id: globalThis.crypto?.randomUUID?.() || `allocation-${Date.now()}-${Math.random()}`,
      walletId: String(item?.walletId || ''),
      walletName: String(item?.walletName || ''),
      amount: Math.max(0, numberValue(item?.amount)),
    }))
    .filter((item) => item.walletId && item.amount > 0);
  const allocated = preparedAllocations.reduce((sum, item) => sum + item.amount, 0);
  const tipsTotal = Math.max(0, numberValue(tips));
  const applied = Math.max(0, numberValue(serviceAmount == null ? allocated - tipsTotal : serviceAmount));
  if (!preparedAllocations.length || allocated <= 0 || applied <= 0 || applied > limit + 0.009) return null;
  if (Math.abs(allocated - applied - tipsTotal) > 0.009) return null;

  const payment = normalizeIncome({
    id: globalThis.crypto?.randomUUID?.() || `payment-${Date.now()}`,
    source: { type: String(source.type), id: String(source.id) },
    workplace: String(workplace || ''),
    client: client ? { ...client } : null,
    allocations: preparedAllocations,
    walletId: preparedAllocations.length === 1 ? preparedAllocations[0].walletId : '',
    walletName: preparedAllocations.length === 1 ? preparedAllocations[0].walletName : '',
    total: allocated,
    serviceAmount: applied,
    tips: tipsTotal,
    finance: snapshot,
    createdAt: now.toISOString(),
    paidAt: now.toISOString(),
  });
  const state = readState();
  state.income.push(payment);
  writeState(state);
  notifyDDSChanged({ action: 'income', paymentId: payment.id, total: payment.total, serviceAmount: payment.serviceAmount, tips: payment.tips, source: payment.source });
  return payment;
}

export function recordRefundExpense(paymentId, { reason = '', amount = null, walletId = '', walletName = '', now = new Date() } = {}) {
  const id = String(paymentId || '');
  const state = readState();
  const original = state.income.find((payment) => String(payment?.id || '') === id);
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

  const refund = normalizeExpense({
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
    finance: original.finance || null,
    createdAt: now.toISOString(),
    refundedAt: now.toISOString(),
  });
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

export function getDDSIncome() {
  return readState().income.map((item) => ({ ...item }));
}

export function getDDSExpenses() {
  return readState().expense.map((item) => ({ ...item }));
}

export function getDDSMovements() {
  const state = readState();
  return [...state.income, ...state.expense]
    .sort((a, b) => String(a?.createdAt || '').localeCompare(String(b?.createdAt || '')));
}

export function getDDSMovementsForSource(type, id) {
  const key = `${String(type || '')}:${String(id || '')}`;
  return getDDSMovements().filter((item) => sourceKey(item?.source) === key);
}

export function getWalletDDSMovements(walletId) {
  const id = String(walletId || '');
  const state = readState();
  const entries = [];

  state.income.forEach((payment) => {
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
    if (String(expense?.walletId || '') !== id) return;
    entries.push({
      ...expense,
      ledgerType: expense.expenseType || 'expense',
      total: -Math.max(0, numberValue(expense.total)),
    });
  });

  return entries.sort((a, b) => String(a?.createdAt || '').localeCompare(String(b?.createdAt || '')));
}

export function getRefundsForPayment(paymentId) {
  return readState().expense.filter((item) => item?.expenseType === 'refund' && String(item?.originalPaymentId || '') === String(paymentId || ''));
}

export function getPaymentRemaining(paymentId) {
  const state = readState();
  const payment = state.income.find((item) => String(item?.id || '') === String(paymentId || ''));
  if (!payment) return 0;
  return Math.max(0, numberValue(payment.total) - refundTotal(state, payment.id));
}
