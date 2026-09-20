import { migrateLegacyRecordSettlements as migrateLegacySettlements, readFinanceState, storeSettlement, writeFinanceState } from './data.js';
import { getPaymentOperation, getPaymentRemaining, getRefundsForPayment } from './read.js';
import { financialNumber, normalizedAllocations, splitRefund } from './rules.js';

function uid(prefix) {
  return globalThis.crypto?.randomUUID?.() || `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeSettlementSnapshot(value = null) {
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

function ledgerEntry({ operationId, direction, component, economicType, walletId, walletName, amount, source, occurredAt, reversalOfLedgerEntryId = '' }) {
  return {
    id: uid('ledger'),
    operationId,
    direction,
    component,
    economicType,
    articleId: '',
    walletId: String(walletId || ''),
    walletName: String(walletName || ''),
    amount: Math.max(0, financialNumber(amount)),
    source: source ? { type: String(source.type || ''), id: String(source.id || '') } : null,
    occurredAt,
    createdAt: occurredAt,
    reversalOfLedgerEntryId: String(reversalOfLedgerEntryId || ''),
  };
}

function paymentLedgerEntries(operationId, source, allocations, serviceAmount, tips, occurredAt) {
  let remainingService = Math.max(0, financialNumber(serviceAmount));
  let remainingTips = Math.max(0, financialNumber(tips));
  const rows = [];

  allocations.forEach((allocation) => {
    let remaining = Math.max(0, financialNumber(allocation.amount));
    const service = Math.min(remaining, remainingService);
    if (service > 0) {
      rows.push(ledgerEntry({
        operationId,
        direction: 'IN',
        component: 'service',
        economicType: 'SERVICE_REVENUE',
        walletId: allocation.walletId,
        walletName: allocation.walletName,
        amount: service,
        source,
        occurredAt,
      }));
      remaining -= service;
      remainingService -= service;
    }

    const tipsPart = Math.min(remaining, remainingTips);
    if (tipsPart > 0) {
      rows.push(ledgerEntry({
        operationId,
        direction: 'IN',
        component: 'tips',
        economicType: 'TIPS',
        walletId: allocation.walletId,
        walletName: allocation.walletName,
        amount: tipsPart,
        source,
        occurredAt,
      }));
      remainingTips -= tipsPart;
    }
  });

  return rows;
}

function refundLedgerEntries(operationId, source, walletId, walletName, serviceAmount, tips, occurredAt) {
  const rows = [];
  if (serviceAmount > 0) {
    rows.push(ledgerEntry({
      operationId,
      direction: 'OUT',
      component: 'service',
      economicType: 'SERVICE_REFUND',
      walletId,
      walletName,
      amount: serviceAmount,
      source,
      occurredAt,
    }));
  }
  if (tips > 0) {
    rows.push(ledgerEntry({
      operationId,
      direction: 'OUT',
      component: 'tips',
      economicType: 'TIPS_REFUND',
      walletId,
      walletName,
      amount: tips,
      source,
      occurredAt,
    }));
  }
  return rows;
}

function operationEntries(state, operationIds = []) {
  const ids = new Set(operationIds.map((id) => String(id || '')).filter(Boolean));
  return (state.ledger || []).filter((entry) => ids.has(String(entry?.operationId || '')));
}

function operationAlreadyReversed(state, operationId) {
  return (state.operations || []).some((operation) => operation?.operationType === 'cancellation'
    && operation?.status !== 'cancelled'
    && (operation.reversesOperationIds || []).some((id) => String(id || '') === String(operationId || '')));
}

export function recordPaymentIncome({ source = null, workplace = '', person = null, settlement = null, allocations = [], maxAmount = null, serviceAmount = null, tips = 0, now = new Date() } = {}) {
  if (!source?.type || !source?.id) return null;
  const snapshot = normalizeSettlementSnapshot(settlement);
  if (!snapshot || maxAmount == null) return null;
  const limit = Math.max(0, financialNumber(maxAmount));
  if (limit <= 0.009) return null;

  const preparedAllocations = normalizedAllocations({ allocations })
    .map((item) => ({ ...item, amount: Math.max(0, financialNumber(item.amount)) }));
  const allocated = preparedAllocations.reduce((sum, item) => sum + item.amount, 0);
  const tipsTotal = Math.max(0, financialNumber(tips));
  const applied = Math.max(0, financialNumber(serviceAmount == null ? allocated - tipsTotal : serviceAmount));
  if (!preparedAllocations.length || allocated <= 0 || applied <= 0 || applied > limit + 0.009) return null;
  if (Math.abs(allocated - applied - tipsTotal) > 0.009) return null;

  const id = uid('payment');
  const at = now.toISOString();
  const operation = {
    id,
    operationType: 'payment',
    status: 'completed',
    source: { type: String(source.type), id: String(source.id) },
    workplace: String(workplace || ''),
    person: person ? { ...person } : null,
    settlement: snapshot,
    parentOperationId: '',
    reversesOperationIds: [],
    reason: '',
    occurredAt: at,
    createdAt: at,
  };
  const entries = paymentLedgerEntries(id, operation.source, preparedAllocations, applied, tipsTotal, at);
  if (Math.abs(entries.reduce((sum, entry) => sum + entry.amount, 0) - allocated) > 0.009) return null;

  const state = readFinanceState();
  state.settlements = state.settlements && typeof state.settlements === 'object' ? state.settlements : {};
  if (source.type === 'record') state.settlements[`record:${String(source.id)}`] = snapshot;
  state.operations.push(operation);
  state.ledger.push(...entries);
  writeFinanceState(state);

  const payment = {
    id,
    operationId: id,
    operationType: 'payment',
    status: 'completed',
    movementType: 'income',
    incomeType: 'payment',
    source: operation.source,
    workplace: operation.workplace,
    person: operation.person,
    allocations: preparedAllocations,
    walletId: preparedAllocations.length === 1 ? preparedAllocations[0].walletId : '',
    walletName: preparedAllocations.length === 1 ? preparedAllocations[0].walletName : '',
    total: allocated,
    serviceAmount: applied,
    tips: tipsTotal,
    settlement: snapshot,
    createdAt: at,
    paidAt: at,
  };
  notifyFinanceChanged({ action: 'income', paymentId: id, total: allocated, serviceAmount: applied, tips: tipsTotal, source: operation.source });
  return payment;
}

export function recordRefundExpense(paymentId, { reason = '', amount = null, walletId = '', walletName = '', now = new Date() } = {}) {
  const id = String(paymentId || '');
  const original = getPaymentOperation(id);
  if (!original || original.status === 'cancelled') return null;
  const refunds = getRefundsForPayment(id);
  const split = splitRefund(original, refunds, amount);
  if (!split) return null;

  const allocations = normalizedAllocations(original);
  const fallbackAllocation = allocations.length === 1 ? allocations[0] : null;
  const resolvedWalletId = String(walletId || fallbackAllocation?.walletId || '');
  const resolvedWalletName = String(walletName || fallbackAllocation?.walletName || '');
  if (!resolvedWalletId) return null;

  const refundId = uid('refund');
  const at = now.toISOString();
  const operation = {
    id: refundId,
    operationType: 'refund',
    status: 'completed',
    source: original.source || null,
    workplace: original.workplace || '',
    person: original.person || null,
    settlement: original.settlement || null,
    parentOperationId: original.id,
    reversesOperationIds: [],
    reason: String(reason || ''),
    occurredAt: at,
    createdAt: at,
  };
  const entries = refundLedgerEntries(refundId, operation.source, resolvedWalletId, resolvedWalletName, split.serviceAmount, split.tips, at);
  if (!entries.length) return null;

  const state = readFinanceState();
  state.operations.push(operation);
  state.ledger.push(...entries);
  writeFinanceState(state);

  const refund = {
    id: refundId,
    operationId: refundId,
    operationType: 'refund',
    status: 'refund',
    movementType: 'expense',
    expenseType: 'refund',
    originalPaymentId: original.id,
    source: operation.source,
    workplace: operation.workplace,
    person: operation.person,
    walletId: resolvedWalletId,
    walletName: resolvedWalletName,
    total: split.total,
    serviceAmount: split.serviceAmount,
    tips: split.tips,
    reason: operation.reason,
    settlement: operation.settlement,
    createdAt: at,
    refundedAt: at,
  };
  notifyFinanceChanged({
    action: refund.total >= split.remaining - 0.009 ? 'refund-full' : 'refund-partial',
    paymentId: refund.id,
    originalPaymentId: original.id,
    total: refund.total,
    serviceAmount: refund.serviceAmount,
    tips: refund.tips,
    source: refund.source || null,
  });
  return refund;
}

export function cancelPaymentOperation(paymentId, { reason = 'incorrect-entry', now = new Date() } = {}) {
  const id = String(paymentId || '');
  if (!id) return null;
  const payment = getPaymentOperation(id);
  if (!payment || payment.status === 'cancelled') return null;

  const refunds = getRefundsForPayment(id);
  const reverseIds = [payment.id, ...refunds.map((refund) => refund.id)];
  const state = readFinanceState();
  if (operationAlreadyReversed(state, payment.id)) return null;

  const sourceEntries = operationEntries(state, reverseIds)
    .filter((entry) => {
      const operation = (state.operations || []).find((item) => String(item?.id || '') === String(entry?.operationId || ''));
      return operation?.status !== 'cancelled';
    });
  if (!sourceEntries.length) return null;

  const cancellationId = uid('cancellation');
  const at = now.toISOString();
  const operation = {
    id: cancellationId,
    operationType: 'cancellation',
    status: 'completed',
    source: payment.source || null,
    workplace: payment.workplace || '',
    person: payment.person || null,
    settlement: payment.settlement || null,
    parentOperationId: payment.id,
    reversesOperationIds: reverseIds,
    reason: String(reason || 'incorrect-entry'),
    occurredAt: at,
    createdAt: at,
  };
  const reversals = sourceEntries.map((entry) => ledgerEntry({
    operationId: cancellationId,
    direction: entry.direction === 'OUT' ? 'IN' : 'OUT',
    component: entry.component,
    economicType: entry.economicType,
    walletId: entry.walletId,
    walletName: entry.walletName,
    amount: entry.amount,
    source: entry.source || payment.source,
    occurredAt: at,
    reversalOfLedgerEntryId: entry.id,
  }));

  state.operations.push(operation);
  state.ledger.push(...reversals);
  writeFinanceState(state);
  notifyFinanceChanged({ action: 'payment-cancelled', paymentId: id, source: payment.source || null });
  return {
    ...payment,
    status: 'cancelled',
    cancelReason: operation.reason,
    cancelledAt: at,
  };
}

export function saveRecordSettlement(recordId, settlement) {
  const id = String(recordId || '');
  if (!id) return null;
  const saved = storeSettlement({ type: 'record', id }, settlement);
  if (saved) notifyFinanceChanged({ action: 'settlement', source: { type: 'record', id } });
  return saved;
}

export function migrateLegacyRecordSettlements(records = []) {
  return migrateLegacySettlements(records);
}
