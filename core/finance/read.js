import { readFinanceState } from './data.js';
import { financialNumber, normalizedAllocations } from './rules.js';

function sourceKey(source = null) {
  return `${String(source?.type || '')}:${String(source?.id || '')}`;
}

function refundsForPayment(state, paymentId) {
  return state.expense.filter((item) => item?.expenseType === 'refund'
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

export function getWalletDDSMovements(walletId) {
  const id = String(walletId || '');
  const state = readFinanceState();
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
      total: -Math.max(0, financialNumber(expense.total)),
    });
  });

  return entries.sort((a, b) => String(a?.createdAt || '').localeCompare(String(b?.createdAt || '')));
}

export function getRefundsForPayment(paymentId) {
  return refundsForPayment(readFinanceState(), paymentId).map((item) => ({ ...item }));
}

export function getPaymentRemaining(paymentId) {
  const state = readFinanceState();
  const payment = state.income.find((item) => String(item?.id || '') === String(paymentId || ''));
  if (!payment) return 0;
  const refunded = refundsForPayment(state, payment.id)
    .reduce((sum, item) => sum + Math.max(0, financialNumber(item?.total)), 0);
  return Math.max(0, financialNumber(payment.total) - refunded);
}
