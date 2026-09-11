// Finance persistence only. Business meaning belongs to rules/model/service.
const STORAGE_KEY = 'book.dds';
const LEGACY_PAYMENT_KEY = 'book.payments';
const VERSION = 5;

function numberValue(value) {
  const number = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(number) ? number : 0;
}

function sourceKey(source = null) {
  return `${String(source?.type || '')}:${String(source?.id || '')}`;
}

function clone(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

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
    finance: normalizeFinancialSnapshot(currentFinance || legacyFinancialSnapshot(item)),
  };
}

function normalizeExpense(item = {}) {
  const { finance: currentFinance, ...rest } = item;
  delete rest['business'];
  const total = Math.max(0, numberValue(item.total));
  const tips = Math.max(0, Math.min(total, numberValue(item.tips)));
  const serviceAmount = Math.max(0, Math.min(total, numberValue(item.serviceAmount ?? (total - tips))));
  return {
    ...rest,
    status: item.status === 'refund' ? 'refund' : (item.status || 'expense'),
    movementType: 'expense',
    expenseType: item.expenseType || (item.status === 'refund' ? 'refund' : 'other'),
    source: item.source || null,
    total,
    serviceAmount,
    tips,
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

export function writeFinanceState(state) {
  const normalized = normalizedState(state) || emptyState();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return clone(normalized);
}

export function readFinanceState() {
  try {
    const storedRaw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    const stored = normalizedState(storedRaw);
    if (stored) {
      const hasLegacySnapshot = [...(storedRaw?.income || []), ...(storedRaw?.expense || [])].some((item) => item?.['business']);
      if (storedRaw?.version !== VERSION || Array.isArray(storedRaw?.operational) || hasLegacySnapshot) writeFinanceState(stored);
      return clone(stored);
    }
  } catch {}
  const migrated = migrateLegacyPayments();
  if (migrated.income.length || migrated.expense.length) writeFinanceState(migrated);
  return clone(migrated);
}
