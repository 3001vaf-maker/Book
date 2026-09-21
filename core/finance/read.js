import { readFinanceState } from './data.js';
import { financialNumber } from './rules.js';

function sourceKey(source = null) {
  return `${String(source?.type || '')}:${String(source?.id || '')}`;
}

function isActiveMovement(item = null) {
  return item?.status !== 'cancelled';
}

function refundsForPayment(state, paymentId) {
  return state.expense.filter((item) => isActiveMovement(item)
    && item?.expenseType === 'refund'
    && String(item?.originalPaymentId || '') === String(paymentId || ''));
}

export function getDDSIncome() {
  return readFinanceState().income.map((item) => ({ ...item }));
}

export function getDDSExpenses() {
  return readFinanceState().expense.map((item) => ({ ...item }));
}

export function getDDSMovements() {
  const state = readFinanceState();
  return [...state.income, ...state.expense]
    .sort((a, b) => String(a?.createdAt || '').localeCompare(String(b?.createdAt || '')));
}

export function getDDSMovementsForSource(type, id) {
  const key = `${String(type || '')}:${String(id || '')}`;
  return getDDSMovements().filter((item) => sourceKey(item?.source) === key);
}

export function getActiveDDSMovements() {
  return getDDSMovements().filter(isActiveMovement);
}

export function getActiveDDSMovementsForSource(type, id) {
  const key = `${String(type || '')}:${String(id || '')}`;
  return getActiveDDSMovements().filter((item) => sourceKey(item?.source) === key);
}

function projectLedgerEntry(state, entry) {
  const operation = state.operations.find((item) => String(item?.operationId || '') === String(entry?.operationId || '')) || null;
  const data = operation?.data && typeof operation.data === 'object' ? operation.data : {};
  const amount = Math.max(0, financialNumber(entry?.amount));
  return {
    ...entry,
    operationKind: operation?.kind || '',
    operationStatus: operation?.status || 'completed',
    ledgerType: entry?.economicType || operation?.kind || 'ledger',
    movementType: entry?.direction === 'OUT' ? 'expense' : 'income',
    total: entry?.direction === 'OUT' ? -amount : amount,
    createdAt: entry?.occurredAt || operation?.occurredAt || '',
    person: data?.person || null,
    workplace: data?.workplace || '',
    source: entry?.source || operation?.source || null,
  };
}

export function getLedgerEntries() {
  const state = readFinanceState();
  return state.ledger
    .map((entry) => projectLedgerEntry(state, entry))
    .sort((a, b) => String(a?.createdAt || '').localeCompare(String(b?.createdAt || '')));
}

export function getLedgerEntriesForSource(type, id) {
  const key = `${String(type || '')}:${String(id || '')}`;
  return getLedgerEntries().filter((entry) => sourceKey(entry?.source) === key);
}

export function getWalletDDSMovements(walletId) {
  const id = String(walletId || '');
  return getLedgerEntries().filter((entry) => String(entry?.walletId || '') === id);
}

export function getRefundsForPayment(paymentId) {
  return refundsForPayment(readFinanceState(), paymentId).map((item) => ({ ...item }));
}

export function getPaymentRemaining(paymentId) {
  const state = readFinanceState();
  const payment = state.income.find((item) => String(item?.id || '') === String(paymentId || ''));
  if (!payment || !isActiveMovement(payment)) return 0;
  const refunded = refundsForPayment(state, payment.id)
    .reduce((sum, item) => sum + Math.max(0, financialNumber(item?.total)), 0);
  return Math.max(0, financialNumber(payment.total) - refunded);
}


function reportBoundary(value, fallback) {
  if (value instanceof Date) return value.getTime();
  if (value == null || value === '') return fallback;
  const time = new Date(String(value)).getTime();
  return Number.isFinite(time) ? time : fallback;
}

function addBreakdown(map, key, label, direction, amount) {
  const id = String(key || 'unknown');
  const current = map.get(id) || { id, label: String(label || key || 'Без значения'), incoming: 0, outgoing: 0, net: 0 };
  if (direction === 'OUT') current.outgoing += amount;
  else current.incoming += amount;
  current.net = current.incoming - current.outgoing;
  map.set(id, current);
}

export function getZReport({ from = null, to = null } = {}) {
  const fromMs = reportBoundary(from, Number.NEGATIVE_INFINITY);
  const toMs = reportBoundary(to, Number.POSITIVE_INFINITY);
  const entries = getLedgerEntries().filter((entry) => {
    const time = new Date(String(entry?.createdAt || entry?.occurredAt || '')).getTime();
    return Number.isFinite(time) && time >= fromMs && time <= toMs;
  });

  const walletMap = new Map();
  const articleMap = new Map();
  const economicMap = new Map();
  const totals = {
    incoming: 0,
    outgoing: 0,
    netCash: 0,
    serviceRevenue: 0,
    operatingRevenue: 0,
    productRevenue: 0,
    operatingExpense: 0,
    tax: 0,
    tips: 0,
    refunds: 0,
    loanReceived: 0,
    loanRepaid: 0,
    investmentReceived: 0,
    investmentReturned: 0,
    transferIn: 0,
    transferOut: 0,
    reversalsIn: 0,
    reversalsOut: 0,
  };

  for (const entry of entries) {
    const amount = Math.max(0, financialNumber(entry?.amount));
    const direction = String(entry?.direction || '');
    const economicType = String(entry?.economicType || '');
    if (direction === 'OUT') totals.outgoing += amount;
    else totals.incoming += amount;

    addBreakdown(walletMap, entry?.walletId, entry?.walletName || entry?.walletId, direction, amount);
    addBreakdown(articleMap, entry?.articleId || economicType, entry?.articleName || economicType, direction, amount);
    addBreakdown(economicMap, economicType, economicType, direction, amount);

    if (economicType === 'SERVICE_REVENUE') totals.serviceRevenue += direction === 'OUT' ? -amount : amount;
    else if (economicType === 'OPERATING_REVENUE') totals.operatingRevenue += direction === 'OUT' ? -amount : amount;
    else if (economicType === 'PRODUCT_REVENUE') totals.productRevenue += direction === 'OUT' ? -amount : amount;
    else if (economicType === 'OPERATING_EXPENSE') totals.operatingExpense += direction === 'IN' ? -amount : amount;
    else if (economicType === 'TAX') totals.tax += direction === 'IN' ? -amount : amount;
    else if (economicType === 'TIPS') totals.tips += direction === 'OUT' ? -amount : amount;
    else if (economicType === 'SERVICE_REFUND' || economicType === 'TIPS_REFUND' || economicType === 'REFUND') totals.refunds += direction === 'IN' ? -amount : amount;
    else if (economicType === 'LOAN_RECEIVED') totals.loanReceived += direction === 'OUT' ? -amount : amount;
    else if (economicType === 'LOAN_REPAYMENT') totals.loanRepaid += direction === 'IN' ? -amount : amount;
    else if (economicType === 'INVESTMENT_RECEIVED') totals.investmentReceived += direction === 'OUT' ? -amount : amount;
    else if (economicType === 'INVESTMENT_RETURN') totals.investmentReturned += direction === 'IN' ? -amount : amount;
    else if (economicType === 'TRANSFER') {
      if (direction === 'OUT') totals.transferOut += amount;
      else totals.transferIn += amount;
    } else if (economicType === 'REVERSAL') {
      if (direction === 'OUT') totals.reversalsOut += amount;
      else totals.reversalsIn += amount;
    }
  }

  totals.incoming = Math.round(totals.incoming * 100) / 100;
  totals.outgoing = Math.round(totals.outgoing * 100) / 100;
  totals.netCash = Math.round((totals.incoming - totals.outgoing) * 100) / 100;

  const normalizeRows = (map) => [...map.values()]
    .map((row) => ({
      ...row,
      incoming: Math.round(row.incoming * 100) / 100,
      outgoing: Math.round(row.outgoing * 100) / 100,
      net: Math.round(row.net * 100) / 100,
    }))
    .sort((a, b) => String(a.label).localeCompare(String(b.label), 'ru'));

  return {
    from: Number.isFinite(fromMs) ? new Date(fromMs).toISOString() : '',
    to: Number.isFinite(toMs) ? new Date(toMs).toISOString() : '',
    entries,
    totals,
    byWallet: normalizeRows(walletMap),
    byArticle: normalizeRows(articleMap),
    byEconomicType: normalizeRows(economicMap),
  };
}
