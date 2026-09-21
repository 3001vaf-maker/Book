import { apiRequest } from '../auth.js';
import { hydrateFinanceFromServer, readFinanceState } from './data.js';
import { financialNumber } from './rules.js';

function notifyFinanceChanged(detail = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('book:dds-changed', { detail }));
}

async function responseJson(response, fallback) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || fallback);
  return payload;
}

async function applyServerState(response, fallback) {
  const payload = await responseJson(response, fallback);
  return hydrateFinanceFromServer(payload);
}

function sourceMatch(item, source) {
  return String(item?.source?.type || '') === String(source?.type || '')
    && String(item?.source?.id || '') === String(source?.id || '');
}

export async function refreshFinanceState() {
  const response = await apiRequest('/finance');
  return applyServerState(response, 'Не удалось обновить Финансы');
}

export async function saveSettlementSnapshot({ source = null, settlement = null } = {}) {
  if (!source?.type || !source?.id || !settlement) return null;
  const response = await apiRequest(
    `/finance/settlements/${encodeURIComponent(source.type)}/${encodeURIComponent(source.id)}`,
    {
      method: 'PUT',
      body: JSON.stringify({ settlement }),
    },
  );
  const state = await applyServerState(response, 'Не удалось сохранить расчёт');
  notifyFinanceChanged({ action: 'settlement', source: { ...source } });
  return state.settlements?.find((item) => sourceMatch(item, source))?.settlement || settlement;
}

export async function createFinanceArticle(payload = {}) {
  const response = await apiRequest('/finance/articles', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const state = await applyServerState(response, 'Не удалось создать статью');
  notifyFinanceChanged({ action: 'article-created' });
  return state;
}

export async function updateFinanceArticle(articleId, payload = {}) {
  const id = String(articleId || '');
  if (!id) return null;
  const response = await apiRequest(`/finance/articles/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  const state = await applyServerState(response, 'Не удалось изменить статью');
  notifyFinanceChanged({ action: 'article-updated', articleId: id });
  return state;
}

export async function archiveFinanceArticle(articleId) {
  const id = String(articleId || '');
  if (!id) return null;
  const response = await apiRequest(`/finance/articles/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  const state = await applyServerState(response, 'Не удалось удалить статью');
  notifyFinanceChanged({ action: 'article-archived', articleId: id });
  return state;
}

export async function recordManualFinanceOperation({
  direction = '',
  articleId = '',
  walletId = '',
  walletName = '',
  amount = null,
  lines = [],
  note = '',
  occurredAt = null,
} = {}) {
  if (!occurredAt) return null;
  const response = await apiRequest('/finance/operations/manual', {
    method: 'POST',
    body: JSON.stringify({
      direction,
      articleId,
      walletId,
      walletName,
      amount,
      lines,
      note,
      occurredAt: occurredAt instanceof Date ? occurredAt.toISOString() : occurredAt,
    }),
  });
  const state = await applyServerState(response, 'Не удалось сохранить доход или расход');
  notifyFinanceChanged({ action: 'manual-operation', direction });
  return state;
}

export async function recordSpecialFinanceOperation(payload = {}) {
  if (!payload?.occurredAt) return null;
  const response = await apiRequest('/finance/operations/special', {
    method: 'POST',
    body: JSON.stringify({
      ...payload,
      occurredAt: payload?.occurredAt instanceof Date ? payload.occurredAt.toISOString() : payload?.occurredAt,
    }),
  });
  const state = await applyServerState(response, 'Не удалось сохранить финансовую операцию');
  notifyFinanceChanged({ action: 'special-operation', kind: String(payload?.kind || '') });
  return state;
}

export async function recordPaymentIncome({
  source = null,
  workplace = '',
  person = null,
  settlement = null,
  allocations = [],
  maxAmount = null,
  serviceAmount = null,
  tips = 0,
  occurredAt = null,
} = {}) {
  if (!source?.type || !source?.id || !settlement || !occurredAt) return null;
  const preparedAllocations = (Array.isArray(allocations) ? allocations : [])
    .map((item) => ({
      walletId: String(item?.walletId || ''),
      walletName: String(item?.walletName || ''),
      amount: Math.max(0, financialNumber(item?.amount)),
    }))
    .filter((item) => item.walletId && item.amount > 0);
  const allocated = preparedAllocations.reduce((sum, item) => sum + item.amount, 0);
  const tipsTotal = Math.max(0, financialNumber(tips));
  const applied = Math.max(0, financialNumber(serviceAmount == null ? allocated - tipsTotal : serviceAmount));
  if (!preparedAllocations.length || allocated <= 0 || applied <= 0) return null;
  if (maxAmount != null && applied > Math.max(0, financialNumber(maxAmount)) + 0.009) return null;
  if (Math.abs(allocated - applied - tipsTotal) > 0.009) return null;

  const before = new Set(readFinanceState().income.map((item) => String(item?.id || '')));
  const response = await apiRequest('/finance/operations/payment', {
    method: 'POST',
    body: JSON.stringify({
      source,
      workplace,
      person,
      settlement,
      allocations: preparedAllocations,
      serviceAmount: applied,
      tips: tipsTotal,
      occurredAt: occurredAt instanceof Date ? occurredAt.toISOString() : occurredAt,
    }),
  });
  const state = await applyServerState(response, 'Не удалось провести оплату');
  const payment = state.income.find((item) => !before.has(String(item?.id || '')) && sourceMatch(item, source))
    || [...state.income].reverse().find((item) => sourceMatch(item, source));
  if (!payment) return null;
  notifyFinanceChanged({
    action: 'income',
    paymentId: payment.id,
    total: payment.total,
    serviceAmount: payment.serviceAmount,
    tips: payment.tips,
    source: payment.source,
  });
  return payment;
}

export async function cancelPaymentOperation(paymentId, { reason = 'incorrect-entry', occurredAt = null } = {}) {
  const id = String(paymentId || '');
  if (!id || !occurredAt) return null;
  const response = await apiRequest(`/finance/operations/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
    body: JSON.stringify({
      reason,
      occurredAt: occurredAt instanceof Date ? occurredAt.toISOString() : occurredAt,
    }),
  });
  const state = await applyServerState(response, 'Не удалось отменить операцию');
  const cancelled = state.income.find((payment) => String(payment?.id || '') === id)
    || state.expense.find((expense) => String(expense?.id || '') === id)
    || null;
  if (!cancelled) return null;
  notifyFinanceChanged({ action: 'payment-cancelled', paymentId: id, source: cancelled.source || null });
  return cancelled;
}

export async function recordRefundExpense(
  paymentId,
  { reason = '', amount = null, walletId = '', walletName = '', occurredAt = null } = {},
) {
  const id = String(paymentId || '');
  if (!id || !walletId || !occurredAt) return null;
  const before = new Set(readFinanceState().expense.map((item) => String(item?.id || '')));
  const response = await apiRequest(`/finance/operations/${encodeURIComponent(id)}/refund`, {
    method: 'POST',
    body: JSON.stringify({
      reason,
      amount,
      walletId,
      walletName,
      occurredAt: occurredAt instanceof Date ? occurredAt.toISOString() : occurredAt,
    }),
  });
  const state = await applyServerState(response, 'Не удалось выполнить возврат');
  const refund = state.expense.find((item) => !before.has(String(item?.id || ''))
    && String(item?.originalPaymentId || '') === id)
    || [...state.expense].reverse().find((item) => String(item?.originalPaymentId || '') === id);
  if (!refund) return null;
  notifyFinanceChanged({
    action: 'refund',
    paymentId: refund.id,
    originalPaymentId: id,
    total: refund.total,
    serviceAmount: refund.serviceAmount,
    tips: refund.tips,
    source: refund.source || null,
  });
  return refund;
}
