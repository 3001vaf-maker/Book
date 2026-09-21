// Browser Finance read cache only.
// Canonical persistence is server FinanceSettlement + FinanceOperation + FinanceLedgerEntry.
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
  return { version: VERSION, articles: [], settlements: [], operations: [], ledger: [], income: [], expense: [] };
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

function normalizeSettlementRow(row = {}) {
  const source = row?.source && typeof row.source === 'object' ? row.source : {};
  const settlement = normalizeSettlementSnapshot(row?.settlement ?? row?.data);
  if (!source?.type || !source?.id || !settlement) return null;
  return {
    source: { type: String(source.type), id: String(source.id) },
    settlement,
  };
}

function normalizeOperation(row = {}) {
  return {
    operationId: String(row?.operationId || row?.id || ''),
    kind: String(row?.kind || ''),
    status: String(row?.status || 'completed'),
    source: row?.source && typeof row.source === 'object' ? { ...row.source } : null,
    originalOperationId: String(row?.originalOperationId || ''),
    occurredAt: String(row?.occurredAt || ''),
    recordedAt: String(row?.recordedAt || row?.createdAt || ''),
    data: row?.data && typeof row.data === 'object' ? clone(row.data) : {},
  };
}

function normalizeLedgerEntry(row = {}) {
  return {
    entryId: String(row?.entryId || row?.id || ''),
    operationId: String(row?.operationId || ''),
    walletId: String(row?.walletId || ''),
    walletName: String(row?.walletName || ''),
    direction: String(row?.direction || ''),
    economicType: String(row?.economicType || ''),
    amount: Math.max(0, numberValue(row?.amount)),
    occurredAt: String(row?.occurredAt || ''),
    recordedAt: String(row?.recordedAt || row?.createdAt || ''),
    source: row?.source && typeof row.source === 'object' ? { ...row.source } : null,
    component: String(row?.component || ''),
    relatedOperationId: String(row?.relatedOperationId || ''),
    articleId: String(row?.articleId || ''),
    articleName: String(row?.articleName || ''),
    lineName: String(row?.lineName || ''),
    quantity: row?.quantity == null ? null : numberValue(row.quantity),
    unitPrice: row?.unitPrice == null ? null : Math.max(0, numberValue(row.unitPrice)),
    note: String(row?.note || ''),
  };
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
      if (legacy) entry.finance = normalizeSettlementSnapshot(legacy);
    });
  }
  return {
    version: VERSION,
    articles: (Array.isArray(value.articles) ? value.articles : []).map((row) => ({
      articleId: String(row?.articleId || ''),
      parentArticleId: String(row?.parentArticleId || ''),
      name: String(row?.name || ''),
      direction: String(row?.direction || ''),
      economicType: String(row?.economicType || ''),
      systemKey: String(row?.systemKey || ''),
      position: Number(row?.position) || 0,
      archivedAt: String(row?.archivedAt || ''),
    })).filter((row) => row.articleId && row.name),
    settlements: (Array.isArray(value.settlements) ? value.settlements : []).map(normalizeSettlementRow).filter(Boolean),
    operations: (Array.isArray(value.operations) ? value.operations : []).map(normalizeOperation),
    ledger: (Array.isArray(value.ledger) ? value.ledger : []).map(normalizeLedgerEntry),
    income,
    expense,
  };
}

export function hydrateFinanceFromServer(value = null) {
  financeState = normalizedState(value) || emptyState();
  return clone(financeState);
}

export function replaceFinanceState(value = null) {
  financeState = normalizedState(value) || emptyState();
  return clone(financeState);
}

export function readFinanceState() {
  return clone(financeState);
}

export function getStoredSettlement(type, id) {
  const key = `${String(type || '')}:${String(id || '')}`;
  const row = financeState.settlements.find((item) => sourceKey(item?.source) === key);
  return row?.settlement ? clone(row.settlement) : null;
}


export function getFinanceArticles() {
  return clone(financeState.articles || []);
}
