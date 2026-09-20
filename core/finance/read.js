import { readFinanceState } from './data.js';
import { financialNumber } from './rules.js';

function sourceKey(source = null) {
  return `${String(source?.type || '')}:${String(source?.id || '')}`;
}

function operationsById(state) {
  return new Map((state.operations || []).map((operation) => [String(operation?.id || ''), operation]));
}

function activeCancellations(state) {
  return (state.operations || []).filter((operation) => operation?.operationType === 'cancellation' && operation?.status !== 'cancelled');
}

function reversedOperationMap(state) {
  const map = new Map();
  activeCancellations(state).forEach((operation) => {
    (operation.reversesOperationIds || []).forEach((id) => map.set(String(id || ''), operation));
  });
  return map;
}

function operationStatus(operation, state) {
  if (!operation || operation.status === 'cancelled') return 'cancelled';
  return reversedOperationMap(state).has(String(operation.id || '')) ? 'cancelled' : 'completed';
}

function ledgerForOperation(state, operationId, { contributingOnly = false } = {}) {
  const operations = operationsById(state);
  return (state.ledger || []).filter((entry) => {
    if (String(entry?.operationId || '') !== String(operationId || '')) return false;
    if (!contributingOnly) return true;
    const operation = operations.get(String(entry.operationId || ''));
    return operation?.status !== 'cancelled';
  });
}

function allocationsForEntries(entries = []) {
  const map = new Map();
  entries.forEach((entry) => {
    const id = String(entry?.walletId || '');
    if (!id) return;
    const current = map.get(id) || { walletId: id, walletName: String(entry?.walletName || ''), amount: 0 };
    current.amount += Math.max(0, financialNumber(entry?.amount));
    if (!current.walletName && entry?.walletName) current.walletName = String(entry.walletName);
    map.set(id, current);
  });
  return [...map.values()].filter((item) => item.amount > 0);
}

function componentTotal(entries, component) {
  return (entries || [])
    .filter((entry) => String(entry?.component || '') === component)
    .reduce((sum, entry) => sum + Math.max(0, financialNumber(entry?.amount)), 0);
}

function projectOperation(operation, state) {
  if (!operation) return null;
  const entries = ledgerForOperation(state, operation.id);
  const allocations = allocationsForEntries(entries);
  const serviceAmount = componentTotal(entries, 'service');
  const tips = componentTotal(entries, 'tips');
  const total = entries.reduce((sum, entry) => sum + Math.max(0, financialNumber(entry?.amount)), 0);
  const status = operationStatus(operation, state);
  const cancellation = reversedOperationMap(state).get(String(operation.id || '')) || null;
  const isExpense = operation.operationType === 'refund' || operation.operationType === 'expense';
  const occurredAt = String(operation?.occurredAt || operation?.createdAt || '');
  return {
    id: String(operation.id || ''),
    operationId: String(operation.id || ''),
    operationType: String(operation.operationType || 'operation'),
    status,
    movementType: isExpense ? 'expense' : 'income',
    incomeType: operation.operationType === 'payment' ? 'payment' : (isExpense ? '' : operation.operationType),
    expenseType: operation.operationType === 'refund' ? 'refund' : (isExpense ? operation.operationType : ''),
    source: operation.source || null,
    workplace: String(operation.workplace || ''),
    person: operation.person ? { ...operation.person } : null,
    allocations,
    walletId: allocations.length === 1 ? allocations[0].walletId : '',
    walletName: allocations.length === 1 ? allocations[0].walletName : '',
    total,
    serviceAmount,
    tips,
    settlement: operation.settlement || null,
    originalPaymentId: String(operation.parentOperationId || ''),
    reason: String(operation.reason || ''),
    createdAt: String(operation.createdAt || occurredAt),
    paidAt: operation.operationType === 'payment' ? occurredAt : '',
    refundedAt: operation.operationType === 'refund' ? occurredAt : '',
    cancelledAt: cancellation ? String(cancellation.occurredAt || cancellation.createdAt || '') : '',
    cancelReason: cancellation ? String(cancellation.reason || 'incorrect-entry') : String(operation.cancelReason || ''),
  };
}

function refundOperationsForPayment(state, paymentId) {
  return (state.operations || [])
    .filter((operation) => operation?.operationType === 'refund'
      && String(operation?.parentOperationId || '') === String(paymentId || ''))
    .map((operation) => projectOperation(operation, state))
    .filter((operation) => operation?.status !== 'cancelled');
}

export function getPaymentOperation(paymentId) {
  const state = readFinanceState();
  const operation = (state.operations || []).find((item) => item?.operationType === 'payment'
    && String(item?.id || '') === String(paymentId || ''));
  return projectOperation(operation, state);
}

export function getPaymentsForSource(type, id) {
  const state = readFinanceState();
  const key = `${String(type || '')}:${String(id || '')}`;
  return (state.operations || [])
    .filter((operation) => operation?.operationType === 'payment' && sourceKey(operation?.source) === key)
    .map((operation) => projectOperation(operation, state))
    .filter((payment) => payment?.status !== 'cancelled' && getPaymentRemaining(payment.id) > 0.009)
    .sort((a, b) => String(a?.createdAt || '').localeCompare(String(b?.createdAt || '')));
}

function projectLedgerEntry(entry, state) {
  const operation = operationsById(state).get(String(entry?.operationId || '')) || null;
  const projectedOperation = operation ? projectOperation(operation, state) : null;
  const amount = Math.max(0, financialNumber(entry?.amount));
  const direction = entry?.direction === 'OUT' ? 'OUT' : 'IN';
  return {
    id: String(entry?.id || ''),
    operationId: String(entry?.operationId || ''),
    operationType: String(operation?.operationType || ''),
    status: projectedOperation?.status || 'completed',
    direction,
    movementType: direction === 'OUT' ? 'expense' : 'income',
    incomeType: direction === 'IN' && operation?.operationType === 'payment' ? 'payment' : '',
    expenseType: direction === 'OUT' && operation?.operationType === 'refund' ? 'refund' : '',
    component: String(entry?.component || 'other'),
    economicType: String(entry?.economicType || ''),
    articleId: String(entry?.articleId || ''),
    source: entry?.source || operation?.source || null,
    workplace: String(operation?.workplace || ''),
    person: operation?.person ? { ...operation.person } : null,
    walletId: String(entry?.walletId || ''),
    walletName: String(entry?.walletName || ''),
    amount,
    total: amount,
    serviceAmount: entry?.component === 'service' ? amount : 0,
    tips: entry?.component === 'tips' ? amount : 0,
    settlement: operation?.settlement || null,
    reversalOfLedgerEntryId: String(entry?.reversalOfLedgerEntryId || ''),
    occurredAt: String(entry?.occurredAt || operation?.occurredAt || ''),
    createdAt: String(entry?.createdAt || operation?.createdAt || ''),
    paidAt: operation?.operationType === 'payment' ? String(operation?.occurredAt || '') : '',
    refundedAt: operation?.operationType === 'refund' ? String(operation?.occurredAt || '') : '',
  };
}

export function getDDSMovements() {
  const state = readFinanceState();
  return (state.ledger || [])
    .map((entry) => projectLedgerEntry(entry, state))
    .sort((a, b) => String(a?.occurredAt || a?.createdAt || '').localeCompare(String(b?.occurredAt || b?.createdAt || '')));
}

export function getDDSIncome() {
  return getDDSMovements().filter((entry) => entry.direction === 'IN');
}

export function getDDSExpenses() {
  return getDDSMovements().filter((entry) => entry.direction === 'OUT');
}

export function getDDSMovementsForSource(type, id) {
  const key = `${String(type || '')}:${String(id || '')}`;
  return getDDSMovements().filter((entry) => sourceKey(entry?.source) === key);
}

export function getActiveDDSMovements() {
  const state = readFinanceState();
  const operations = operationsById(state);
  return getDDSMovements().filter((entry) => operations.get(String(entry.operationId || ''))?.status !== 'cancelled');
}

export function getActiveDDSMovementsForSource(type, id) {
  const key = `${String(type || '')}:${String(id || '')}`;
  return getActiveDDSMovements().filter((entry) => sourceKey(entry?.source) === key);
}

export function getWalletDDSMovements(walletId) {
  const id = String(walletId || '');
  return getActiveDDSMovements()
    .filter((entry) => String(entry?.walletId || '') === id)
    .map((entry) => ({
      ...entry,
      total: entry.direction === 'OUT' ? -Math.max(0, financialNumber(entry.amount)) : Math.max(0, financialNumber(entry.amount)),
    }));
}

export function getRefundsForPayment(paymentId) {
  return refundOperationsForPayment(readFinanceState(), paymentId);
}

export function getPaymentRemaining(paymentId) {
  const payment = getPaymentOperation(paymentId);
  if (!payment || payment.status === 'cancelled') return 0;
  const refunded = getRefundsForPayment(payment.id)
    .reduce((sum, item) => sum + Math.max(0, financialNumber(item?.total)), 0);
  return Math.max(0, financialNumber(payment.total) - refunded);
}
