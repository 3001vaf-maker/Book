// Settlement projects amount due, paid/refunded totals and outstanding amount for a concrete source.
// This is operational calculation, NOT the reserved future Financial Model.
// Low-level arithmetic lives in rules.js; money persistence lives in data/service.
// Legacy record.finance and planTotal/fact* fields remain only as storage compatibility until later migration.
import { readStoredSettlement } from './data.js';
import { getActiveDDSMovements, getActiveDDSMovementsForSource, getPaymentsForSource } from './read.js';
import {
  calculateSettlementTotals,
  calculateSettlementItemTotals,
  calculateSettlement,
  calculateSettlementPaymentState,
  clampFinancialPercent,
  financialNumber,
  isStoredSettlement,
  normalizeStoredSettlement,
  recordSettlementItems,
  repriceSettlement,
} from './rules.js';

function latestHistoricalSettlementForSource(type, id) {
  const movements = getActiveDDSMovementsForSource(type, id)
    .filter((movement) => (movement?.settlement || movement?.finance) && isStoredSettlement(movement?.settlement ?? movement?.finance))
    .sort((a, b) => String(a?.createdAt || '').localeCompare(String(b?.createdAt || '')));
  if (!movements.length) return null;
  return normalizeStoredSettlement(movements[movements.length - 1]?.settlement ?? movements[movements.length - 1]?.finance);
}

export function resolveRecordSettlement(record = null, { discountPercent = null } = {}) {
  const items = recordSettlementItems(record);
  if (record?.id) {
    const owned = normalizeStoredSettlement(readStoredSettlement({ type: 'record', id: record.id }));
    if (owned) return repriceSettlement(items, owned);
  }

  // Migration fallback only. New/updated Record rows must not persist this field.
  const legacyRecordSettlement = normalizeStoredSettlement(record?.finance);
  if (legacyRecordSettlement) return repriceSettlement(items, legacyRecordSettlement);

  if (record?.id) {
    const historical = latestHistoricalSettlementForSource('record', record.id);
    if (historical) return repriceSettlement(items, historical);
  }

  const resolvedDiscount = discountPercent == null
    ? recordSettlementDiscountPercent(record?.person)
    : discountPercent;
  return calculateSettlement(items, { discountPercent: resolvedDiscount });
}

export function getRecordSettlement(record = null, { discountPercent = null } = {}) {
  const settlement = resolveRecordSettlement(record, { discountPercent });
  if (!record?.id) return calculateSettlementTotals(settlement, []);
  return calculateSettlementTotals(settlement, getActiveDDSMovementsForSource('record', record.id));
}

export function getRecordPaymentState(record = null, { discountPercent = null } = {}) {
  const settlement = resolveRecordSettlement(record, { discountPercent });
  const movements = record?.id ? getActiveDDSMovementsForSource('record', record.id) : [];
  const payments = record?.id ? getPaymentsForSource('record', record.id) : [];
  return calculateSettlementPaymentState(settlement, movements, payments);
}

export function getSettlementTotalsForRecords(recordIds = []) {
  const ids = new Set((Array.isArray(recordIds) ? recordIds : []).map((id) => String(id || '')).filter(Boolean));
  const movements = getActiveDDSMovements().filter((movement) => movement?.source?.type === 'record' && ids.has(String(movement?.source?.id || '')));
  return calculateSettlementTotals(null, movements);
}

export function getSettlementItemTotals(sourceTypeValue, sourceIdValue) {
  return calculateSettlementItemTotals(getActiveDDSMovements(), sourceTypeValue, sourceIdValue);
}

export function recordAmountDue(record = null) {
  return resolveRecordSettlement(record).planTotal;
}

export function recordSettlementDiscountPercent(person = null) {
  return clampFinancialPercent(person?.discountPercent ?? 0);
}

export function normalizeRecordSettlement(value = null) {
  if (!value || typeof value !== 'object') return null;
  return {
    items: Array.isArray(value.items) ? value.items.map((item) => ({ ...item })) : [],
    serviceTotal: Math.max(0, financialNumber(value.serviceTotal)),
    discountPercent: value.discountPercent == null ? null : clampFinancialPercent(value.discountPercent),
    discountTotal: Math.max(0, financialNumber(value.discountTotal)),
    planTotal: Math.max(0, financialNumber(value.planTotal ?? value.dueTotal)),
    factIncome: Math.max(0, financialNumber(value.factIncome ?? value.paidTotal)),
    factExpense: Math.max(0, financialNumber(value.factExpense ?? value.refundedTotal)),
    factTotal: financialNumber(value.factTotal ?? value.netPaidTotal),
  };
}

