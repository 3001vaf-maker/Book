import { queueAuxiliaryDataset } from '../business-persistence.js';

// Finance persistence only. Business meaning belongs to rules/settlement/service.
const VERSION = 6;
let financeState = emptyState();

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
  return { version: VERSION, settlements: {}, income: [], expense: [] };
}

function normalizeSettlementSnapshot(value = null) {
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
    status: item.status === 'cancelled' ? 'cancelled' : 'completed',
    movementType: 'income',
    incomeType: item.incomeType || 'payment',
    source: item.source || null,
    total,
    serviceAmount,
    tips,
    allocations: Array.isArray(item.allocations) ? item.allocations.map((entry) => ({ ...entry })) : [],
    finance: normalizeSettlementSnapshot(currentFinance || legacyFinancialSnapshot(item)),
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
    status: item.status === 'cancelled' ? 'cancelled' : (item.status === 'refund' ? 'refund' : (item.status || 'expense')),
    movementType: 'expense',
    expenseType: item.expenseType || (item.status === 'refund' ? 'refund' : 'other'),
    source: item.source || null,
    total,
    serviceAmount,
    tips,
    finance: normalizeSettlementSnapshot(currentFinance || legacyFinancialSnapshot(item)),
  };
}

function normalizeSettlements(value = null) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value)
    .map(([key, settlement]) => [String(key || ''), normalizeSettlementSnapshot(settlement)])
    .filter(([key, settlement]) => key && settlement));
}

function normalizedState(value) {
  if (!value || typeof value !== 'object') return null;
  const legacyOperational = Array.isArray(value.operational) ? value.operational : [];
  const settlements = normalizeSettlements(value.settlements);
  const income = Array.isArray(value.income) ? value.income.map(normalizeIncome) : [];
  const expense = Array.isArray(value.expense) ? value.expense.map(normalizeExpense) : [];
  if (legacyOperational.length) {
    const bySource = new Map(legacyOperational.map((entry) => [sourceKey(entry?.source), entry]));
    income.forEach((entry) => {
      if (entry.finance) return;
      const legacy = bySource.get(sourceKey(entry?.source));
      if (legacy) entry.finance = normalizeSettlementSnapshot(legacy);
    });
  }
  return { version: VERSION, settlements, income, expense };
}

export function hydrateFinanceFromServer(value = null) {
  financeState = normalizedState(value) || emptyState();
  return clone(financeState);
}

export function writeFinanceState(state) {
  financeState = normalizedState(state) || emptyState();
  void queueAuxiliaryDataset('finance', financeState);
  return clone(financeState);
}

export function readFinanceState() {
  return clone(financeState);
}


export function readStoredSettlement(source = null) {
  const key = sourceKey(source);
  if (!key || key === ':') return null;
  return clone(financeState.settlements?.[key] || null);
}

export function storeSettlement(source = null, settlement = null, { persist = true } = {}) {
  const key = sourceKey(source);
  const snapshot = normalizeSettlementSnapshot(settlement);
  if (!key || key === ':' || !snapshot) return null;
  const next = normalizedState(financeState) || emptyState();
  next.settlements[key] = snapshot;
  financeState = next;
  if (persist) void queueAuxiliaryDataset('finance', financeState);
  return clone(snapshot);
}

export function migrateLegacyRecordSettlements(records = []) {
  const rows = Array.isArray(records) ? records : [];
  const next = normalizedState(financeState) || emptyState();
  let changed = false;
  rows.forEach((record) => {
    const id = String(record?.id || '');
    const snapshot = normalizeSettlementSnapshot(record?.finance);
    if (!id || !snapshot) return;
    const key = sourceKey({ type: 'record', id });
    if (next.settlements[key]) return;
    next.settlements[key] = snapshot;
    changed = true;
  });
  if (!changed) return { changed: false, migrated: 0 };
  financeState = next;
  void queueAuxiliaryDataset('finance', financeState);
  return {
    changed: true,
    migrated: rows.filter((record) => record?.id && record?.finance).length,
  };
}
