import { queueAuxiliaryDataset } from '../business-persistence.js';

// Finance persistence only. Business meaning belongs to rules/settlement/service.
// v7 canonical storage: Finance-owned settlements + economic Operations + flat Ledger rows.
const VERSION = 7;
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
  return { version: VERSION, settlements: {}, operations: [], ledger: [] };
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

function normalizeSettlements(value = null) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value)
    .map(([key, settlement]) => [String(key || ''), normalizeSettlementSnapshot(settlement)])
    .filter(([key, settlement]) => key && settlement));
}

function normalizeSource(value = null) {
  if (!value || typeof value !== 'object') return null;
  const type = String(value.type || '');
  const id = String(value.id || '');
  return type && id ? { type, id } : null;
}

function normalizeOperation(item = {}) {
  const id = String(item?.id || '');
  if (!id) return null;
  return {
    id,
    operationType: String(item?.operationType || item?.type || 'operation'),
    status: item?.status === 'cancelled' ? 'cancelled' : 'completed',
    source: normalizeSource(item?.source),
    workplace: String(item?.workplace || ''),
    person: item?.person && typeof item.person === 'object' ? clone(item.person) : null,
    settlement: normalizeSettlementSnapshot(item?.settlement ?? item?.finance),
    parentOperationId: String(item?.parentOperationId || item?.originalPaymentId || ''),
    reversesOperationIds: Array.isArray(item?.reversesOperationIds)
      ? item.reversesOperationIds.map((value) => String(value || '')).filter(Boolean)
      : [],
    reason: String(item?.reason || ''),
    cancelReason: String(item?.cancelReason || ''),
    occurredAt: String(item?.occurredAt || item?.paidAt || item?.refundedAt || item?.createdAt || ''),
    createdAt: String(item?.createdAt || item?.occurredAt || item?.paidAt || item?.refundedAt || ''),
  };
}

function normalizeLedgerEntry(item = {}) {
  const id = String(item?.id || '');
  const operationId = String(item?.operationId || '');
  const direction = item?.direction === 'OUT' ? 'OUT' : 'IN';
  const amount = Math.max(0, numberValue(item?.amount ?? item?.total));
  if (!id || !operationId || amount <= 0) return null;
  return {
    id,
    operationId,
    direction,
    component: String(item?.component || 'other'),
    economicType: String(item?.economicType || (direction === 'IN' ? 'OTHER_INCOME' : 'OTHER_EXPENSE')),
    articleId: String(item?.articleId || ''),
    walletId: String(item?.walletId || ''),
    walletName: String(item?.walletName || ''),
    amount,
    source: normalizeSource(item?.source),
    occurredAt: String(item?.occurredAt || item?.createdAt || ''),
    createdAt: String(item?.createdAt || item?.occurredAt || ''),
    reversalOfLedgerEntryId: String(item?.reversalOfLedgerEntryId || ''),
  };
}

function legacyFinancialSnapshot(item = {}) {
  return item?.finance || item?.['business'] || null;
}

function legacyAllocations(item = {}) {
  if (Array.isArray(item?.allocations) && item.allocations.length) {
    return item.allocations.map((entry) => ({
      walletId: String(entry?.walletId || ''),
      walletName: String(entry?.walletName || ''),
      amount: Math.max(0, numberValue(entry?.amount)),
    })).filter((entry) => entry.walletId && entry.amount > 0);
  }
  const walletId = String(item?.walletId || '');
  const total = Math.max(0, numberValue(item?.total));
  return walletId && total > 0 ? [{
    walletId,
    walletName: String(item?.walletName || ''),
    amount: total,
  }] : [];
}

function legacyEconomicType(operationType, component, direction) {
  if (operationType === 'payment') return component === 'tips' ? 'TIPS' : 'SERVICE_REVENUE';
  if (operationType === 'refund') return component === 'tips' ? 'TIPS_REFUND' : 'SERVICE_REFUND';
  return direction === 'IN' ? 'OTHER_INCOME' : 'OTHER_EXPENSE';
}

function legacyLedgerRows(item, operation) {
  const direction = operation.operationType === 'refund' || operation.operationType === 'expense' ? 'OUT' : 'IN';
  const total = Math.max(0, numberValue(item?.total));
  const tips = Math.max(0, Math.min(total, numberValue(item?.tips)));
  const serviceAmount = Math.max(0, Math.min(total, numberValue(item?.serviceAmount ?? (total - tips))));
  let remainingService = serviceAmount;
  let remainingTips = tips;
  const rows = [];

  legacyAllocations(item).forEach((allocation, index) => {
    let remaining = allocation.amount;
    const service = Math.min(remaining, remainingService);
    if (service > 0) {
      rows.push(normalizeLedgerEntry({
        id: `${operation.id}:service:${index}`,
        operationId: operation.id,
        direction,
        component: 'service',
        economicType: legacyEconomicType(operation.operationType, 'service', direction),
        walletId: allocation.walletId,
        walletName: allocation.walletName,
        amount: service,
        source: operation.source,
        occurredAt: operation.occurredAt,
        createdAt: operation.createdAt,
      }));
      remaining -= service;
      remainingService -= service;
    }

    const tipsPart = Math.min(remaining, remainingTips);
    if (tipsPart > 0) {
      rows.push(normalizeLedgerEntry({
        id: `${operation.id}:tips:${index}`,
        operationId: operation.id,
        direction,
        component: 'tips',
        economicType: legacyEconomicType(operation.operationType, 'tips', direction),
        walletId: allocation.walletId,
        walletName: allocation.walletName,
        amount: tipsPart,
        source: operation.source,
        occurredAt: operation.occurredAt,
        createdAt: operation.createdAt,
      }));
      remainingTips -= tipsPart;
    }
  });
  return rows.filter(Boolean);
}

function migrateLegacyState(value = {}) {
  const state = emptyState();
  state.settlements = normalizeSettlements(value?.settlements);

  const income = Array.isArray(value?.income) ? value.income : [];
  const expense = Array.isArray(value?.expense) ? value.expense : [];

  for (const item of income) {
    const settlement = normalizeSettlementSnapshot(legacyFinancialSnapshot(item));
    const operation = normalizeOperation({
      ...item,
      operationType: item?.incomeType === 'payment' ? 'payment' : 'income',
      settlement,
      occurredAt: item?.paidAt || item?.createdAt,
    });
    if (!operation) continue;
    state.operations.push(operation);
    state.ledger.push(...legacyLedgerRows(item, operation));
    if (operation.source?.type === 'record' && settlement) {
      const key = sourceKey(operation.source);
      if (!state.settlements[key]) state.settlements[key] = settlement;
    }
  }

  for (const item of expense) {
    const settlement = normalizeSettlementSnapshot(legacyFinancialSnapshot(item));
    const operation = normalizeOperation({
      ...item,
      operationType: item?.expenseType === 'refund' ? 'refund' : 'expense',
      settlement,
      parentOperationId: item?.originalPaymentId,
      occurredAt: item?.refundedAt || item?.createdAt,
    });
    if (!operation) continue;
    state.operations.push(operation);
    state.ledger.push(...legacyLedgerRows(item, operation));
  }

  return state;
}

function normalizedState(value) {
  if (!value || typeof value !== 'object') return null;
  if (!Array.isArray(value.operations) && !Array.isArray(value.ledger)) return migrateLegacyState(value);

  return {
    version: VERSION,
    settlements: normalizeSettlements(value.settlements),
    operations: (Array.isArray(value.operations) ? value.operations : []).map(normalizeOperation).filter(Boolean),
    ledger: (Array.isArray(value.ledger) ? value.ledger : []).map(normalizeLedgerEntry).filter(Boolean),
  };
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
  let migrated = 0;
  rows.forEach((record) => {
    const id = String(record?.id || '');
    const snapshot = normalizeSettlementSnapshot(record?.finance);
    if (!id || !snapshot) return;
    const key = sourceKey({ type: 'record', id });
    if (next.settlements[key]) return;
    next.settlements[key] = snapshot;
    migrated += 1;
  });
  if (!migrated) return { changed: false, migrated: 0 };
  financeState = next;
  void queueAuxiliaryDataset('finance', financeState);
  return { changed: true, migrated };
}
