import { readFinanceState, writeFinanceState } from './data.js';
import { getRefundsForPayment } from './read.js';
import {
  financialNumber,
  normalizedAllocations,
  splitRefund,
} from './rules.js';

function normalizeFinancialSnapshot(value = null) {
  if (!value || typeof value !== 'object') return null;
  return {
    items: Array.isArray(value.items) ? value.items.map((item) => ({ ...item })) : [],
    serviceTotal: Math.max(0, financialNumber(value.serviceTotal)),
    discountPercent: value.discountPercent == null ? null : Math.max(0, Math.min(100, financialNumber(value.discountPercent))),
    discountTotal: Math.max(0, financialNumber(value.discountTotal)),
    planTotal: Math.max(0, financialNumber(value.planTotal ?? value.dueTotal)),
  };
}

function notifyFinanceChanged(detail = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('book:dds-changed', { detail }));
}

export function recordPaymentIncome({ source = null, workplace = '', client = null, finance = null, allocations = [], maxAmount = null, serviceAmount = null, tips = 0, now = new Date() } = {}) {
  if (!source?.type || !source?.id) return null;
  const snapshot = normalizeFinancialSnapshot(finance);
  if (!snapshot || maxAmount == null) return null;
  const limit = Math.max(0, financialNumber(maxAmount));
  if (limit <= 0.009) return null;

  const preparedAllocations = (Array.isArray(allocations) ? allocations : [])
    .map((item) => ({
      id: globalThis.crypto?.randomUUID?.() || `allocation-${Date.now()}-${Math.random()}`,
      walletId: String(item?.walletId || ''),
      walletName: String(item?.walletName || ''),
      amount: Math.max(0, financialNumber(item?.amount)),
    }))
    .filter((item) => item.walletId && item.amount > 0);
  const allocated = preparedAllocations.reduce((sum, item) => sum + item.amount, 0);
  const tipsTotal = Math.max(0, financialNumber(tips));
  const applied = Math.max(0, financialNumber(serviceAmount == null ? allocated - tipsTotal : serviceAmount));
  if (!preparedAllocations.length || allocated <= 0 || applied <= 0 || applied > limit + 0.009) return null;
  if (Math.abs(allocated - applied - tipsTotal) > 0.009) return null;

  const payment = {
    id: globalThis.crypto?.randomUUID?.() || `payment-${Date.now()}`,
    status: 'completed',
    movementType: 'income',
    incomeType: 'payment',
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
  };
  const state = readFinanceState();
  state.income.push(payment);
  writeFinanceState(state);
  notifyFinanceChanged({ action: 'income', paymentId: payment.id, total: payment.total, serviceAmount: payment.serviceAmount, tips: payment.tips, source: payment.source });
  return { ...payment, allocations: payment.allocations.map((item) => ({ ...item })) };
}

export function recordRefundExpense(paymentId, { reason = '', amount = null, walletId = '', walletName = '', now = new Date() } = {}) {
  const id = String(paymentId || '');
  const state = readFinanceState();
  const original = state.income.find((payment) => String(payment?.id || '') === id);
  if (!original) return null;
  const refunds = getRefundsForPayment(id);
  const split = splitRefund(original, refunds, amount);
  if (!split) return null;

  const allocations = normalizedAllocations(original);
  const fallbackAllocation = allocations.length === 1 ? allocations[0] : null;
  const resolvedWalletId = String(walletId || fallbackAllocation?.walletId || '');
  const resolvedWalletName = String(walletName || fallbackAllocation?.walletName || '');
  if (!resolvedWalletId) return null;

  const refund = {
    id: globalThis.crypto?.randomUUID?.() || `refund-${Date.now()}`,
    status: 'refund',
    movementType: 'expense',
    expenseType: 'refund',
    originalPaymentId: original.id,
    source: original.source || null,
    workplace: original.workplace || '',
    client: original.client || null,
    walletId: resolvedWalletId,
    walletName: resolvedWalletName,
    total: split.total,
    serviceAmount: split.serviceAmount,
    tips: split.tips,
    reason: String(reason || ''),
    finance: original.finance || null,
    createdAt: now.toISOString(),
    refundedAt: now.toISOString(),
  };
  state.expense.push(refund);
  writeFinanceState(state);
  notifyFinanceChanged({
    action: refund.total >= split.remaining - 0.009 ? 'refund-full' : 'refund-partial',
    paymentId: refund.id,
    originalPaymentId: original.id,
    total: refund.total,
    serviceAmount: refund.serviceAmount,
    tips: refund.tips,
    source: refund.source || null,
  });
  return { ...refund };
}
