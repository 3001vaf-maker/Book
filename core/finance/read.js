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

export function getLedgerEntries() {
  return readFinanceState().ledger.map((entry) => ({ ...entry }));
}

export function getLedgerEntriesForSource(type, id) {
  const key = `${String(type || '')}:${String(id || '')}`;
  return getLedgerEntries().filter((entry) => sourceKey(entry?.source) === key);
}

export function getWalletDDSMovements(walletId) {
  const id = String(walletId || '');
  const state = readFinanceState();
  const operationById = new Map(state.operations.map((operation) => [String(operation?.operationId || ''), operation]));
  return state.ledger
    .filter((entry) => String(entry?.walletId || '') === id)
    .map((entry) => {
      const operation = operationById.get(String(entry?.operationId || '')) || null;
      const data = operation?.data && typeof operation.data === 'object' ? operation.data : {};
      const amount = Math.max(0, financialNumber(entry?.amount));
      return {
        ...entry,
        ledgerType: entry?.economicType || operation?.kind || 'ledger',
        movementType: entry?.direction === 'OUT' ? 'expense' : 'income',
        total: entry?.direction === 'OUT' ? -amount : amount,
        createdAt: entry?.occurredAt || operation?.occurredAt || '',
        person: data?.person || null,
        workplace: data?.workplace || '',
        source: entry?.source || operation?.source || null,
      };
    })
    .sort((a, b) => String(a?.createdAt || '').localeCompare(String(b?.createdAt || '')));
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
