import { apiRequest } from '../auth.js';
import { flushBusinessPersistence } from '../business-persistence.js';
import { refreshLoyaltyState } from '../loyalty/runtime.js';
import { getFinanceOperation, hydrateFinanceFromServer } from './data.js';
import { financialNumber } from './rules.js';
import { getDDSExpenses, getDDSIncome } from './read.js';

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

function operationProjection(operation = null) {
  if (!operation) return null;
  const data = operation?.data && typeof operation.data === 'object' ? operation.data : {};
  return {
    id: String(operation?.operationId || ''),
    operationId: String(operation?.operationId || ''),
    operationKind: String(operation?.kind || ''),
    operationStatus: String(operation?.status || ''),
    source: operation?.source ? { ...operation.source } : null,
    originalPaymentId: String(operation?.originalOperationId || ''),
    occurredAt: String(operation?.occurredAt || ''),
    recordedAt: String(operation?.recordedAt || ''),
    ...data,
  };
}

async function refreshLoyaltyAfterFinance() {
  await refreshLoyaltyState().catch(() => null);
}

export async function canPermanentlyDeleteFinanceData() {
  const response = await apiRequest('/saas-admin/me');
  return response.ok;
}

export async function hardDeleteFinanceWallet(walletId) {
  const id = String(walletId || '').trim();
  if (!id) return null;
  const response = await apiRequest(`/finance/wallets/${encodeURIComponent(id)}/hard`, {
    method: 'DELETE',
  });
  const state = await applyServerState(response, 'Не удалось полностью удалить кассу');
  await refreshLoyaltyAfterFinance();
  notifyFinanceChanged({ action: 'wallet-hard-delete', walletId: id });
  return state;
}

export async function refreshFinanceState() {
  const response = await apiRequest('/finance');
  return applyServerState(response, 'Не удалось обновить Финансы');
}

export async function getSettlementSources(personKey) {
  const key = String(personKey || '').trim();
  if (!key) return { account: null, deposits: [] };
  const response = await apiRequest(`/settlement/sources/${encodeURIComponent(key)}`);
  return responseJson(response, 'Не удалось загрузить источники оплаты');
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
  notifyFinanceChanged({ action: 'article-archived' });
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
  if (payload?.financeEntityId) await flushBusinessPersistence();
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
  personKey = '',
  settlement = null,
  allocations = [],
  settlementMovements = [],
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
  const preparedMovements = (Array.isArray(settlementMovements) ? settlementMovements : [])
    .map((item) => ({
      movementId: String(item?.movementId || ''),
      nominal: String(item?.nominal || ''),
      sourceType: String(item?.sourceType || ''),
      sourceId: String(item?.sourceId || ''),
      sourceName: String(item?.sourceName || ''),
      amount: Math.max(0, financialNumber(item?.amount)),
    }))
    .filter((item) => item.sourceId && item.amount > 0);
  const allocated = preparedAllocations.reduce((sum, item) => sum + item.amount, 0);
  const tipsTotal = Math.max(0, financialNumber(tips));
  const cashService = Math.max(0, financialNumber(serviceAmount == null ? allocated - tipsTotal : serviceAmount));
  const nonCashApplied = preparedMovements.reduce((sum, item) => sum + item.amount, 0);
  const serviceApplied = cashService + nonCashApplied;
  if (serviceApplied <= 0 && tipsTotal <= 0) return null;
  if (maxAmount != null && serviceApplied > Math.max(0, financialNumber(maxAmount)) + 0.009) return null;
  if (Math.abs(allocated - cashService - tipsTotal) > 0.009) return null;

  const response = await apiRequest('/settlement/operations/payment', {
    method: 'POST',
    body: JSON.stringify({
      source,
      workplace,
      person,
      personKey: String(personKey || person?.key || ''),
      settlement,
      allocations: preparedAllocations,
      settlementMovements: preparedMovements,
      serviceAmount: cashService,
      tips: tipsTotal,
      occurredAt: occurredAt instanceof Date ? occurredAt.toISOString() : occurredAt,
    }),
  });
  const state = await applyServerState(response, 'Не удалось провести оплату');
  await refreshLoyaltyAfterFinance();
  const operation = [...state.operations].reverse().find((item) => item?.kind === 'payment' && sourceMatch(item, source)) || null;
  const payment = operationProjection(operation);
  if (!payment) return null;
  notifyFinanceChanged({
    action: 'income',
    paymentId: payment.id,
    total: payment.total,
    serviceAmount: payment.serviceAmount,
    settlementMovements: payment.settlementMovements,
    tips: payment.tips,
    source: payment.source,
  });
  return payment;
}

export async function correctFinanceOperation(operationId, payload = {}) {
  const id = String(operationId || '').trim();
  if (!id) return null;
  const response = await apiRequest(`/settlement/operations/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify({
      ...payload,
      occurredAt: payload?.occurredAt instanceof Date ? payload.occurredAt.toISOString() : payload?.occurredAt,
    }),
  });
  const state = await applyServerState(response, 'Не удалось скорректировать операцию');
  await refreshLoyaltyAfterFinance();
  const operation = state.operations.find((item) => String(item?.operationId || '') === id) || null;
  notifyFinanceChanged({ action: 'operation-corrected', operationId: id, source: operation?.source || null });
  return operation;
}

export async function hardDeleteFinanceOperation(operationId) {
  const id = String(operationId || '').trim();
  if (!id) return null;
  const response = await apiRequest(`/settlement/operations/${encodeURIComponent(id)}/hard`, {
    method: 'DELETE',
  });
  const state = await applyServerState(response, 'Не удалось полностью удалить операцию');
  await refreshLoyaltyAfterFinance();
  notifyFinanceChanged({ action: 'operation-hard-delete', operationId: id });
  return state;
}

export async function cancelFinanceOperation(operationId, { reason = 'incorrect-entry', occurredAt = null } = {}) {
  const id = String(operationId || '');
  if (!id || !occurredAt) return null;
  const response = await apiRequest(`/settlement/operations/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
    body: JSON.stringify({
      reason,
      occurredAt: occurredAt instanceof Date ? occurredAt.toISOString() : occurredAt,
    }),
  });
  const state = await applyServerState(response, 'Не удалось отменить операцию');
  await refreshLoyaltyAfterFinance();
  const operation = state.operations.find((item) => String(item?.operationId || '') === id) || null;
  if (!operation) return null;
  notifyFinanceChanged({ action: 'operation-cancelled', operationId: id, source: operation.source || null });
  return operation;
}

export async function cancelPaymentOperation(paymentId, options = {}) {
  const id = String(paymentId || '');
  const operation = await cancelFinanceOperation(id, options);
  if (!operation) return null;
  return operationProjection(getFinanceOperation(id))
    || getDDSIncome().find((payment) => String(payment?.id || '') === id)
    || getDDSExpenses().find((expense) => String(expense?.id || '') === id)
    || null;
}

export async function recordRefundExpense(
  paymentId,
  {
    reason = '',
    amount = null,
    settlementMovements = [],
    walletId = '',
    walletName = '',
    occurredAt = null,
  } = {},
) {
  const id = String(paymentId || '');
  if (!id || !occurredAt) return null;
  const response = await apiRequest(`/settlement/operations/${encodeURIComponent(id)}/refund`, {
    method: 'POST',
    body: JSON.stringify({
      reason,
      amount,
      settlementMovements,
      walletId,
      walletName,
      occurredAt: occurredAt instanceof Date ? occurredAt.toISOString() : occurredAt,
    }),
  });
  const state = await applyServerState(response, 'Не удалось выполнить возврат');
  await refreshLoyaltyAfterFinance();
  const operation = [...state.operations].reverse().find((item) => item?.kind === 'refund'
    && String(item?.originalOperationId || '') === id) || null;
  const refund = operationProjection(operation);
  if (!refund) return null;
  notifyFinanceChanged({
    action: 'refund',
    paymentId: refund.id,
    originalPaymentId: id,
    total: refund.total,
    serviceAmount: refund.serviceAmount,
    settlementMovements: refund.settlementMovements,
    tips: refund.tips,
    source: refund.source || null,
  });
  return refund;
}
