// Settlement projects amount due, paid/refunded totals and outstanding amount for a concrete source.
// This is operational calculation, NOT the reserved future Financial Model.
// Low-level arithmetic lives in rules.js; money persistence lives in data/service.
// Canonical Settlement snapshots live in Finance. record.finance is read only as legacy compatibility during migration.
import { getStoredSettlement } from './data.js';
import { getActiveDDSMovements, getActiveDDSMovementsForSource } from './read.js';
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
} from './rules.js';

function latestHistoricalSettlementForSource(type, id) {
  const movements = getActiveDDSMovementsForSource(type, id)
    .filter((movement) => movement?.finance && isStoredSettlement(movement.finance))
    .sort((a, b) => String(a?.createdAt || '').localeCompare(String(b?.createdAt || '')));
  if (!movements.length) return null;
  return normalizeStoredSettlement(movements[movements.length - 1].finance);
}

export function resolveRecordSettlement(record = null, { discountPercent = 0 } = {}) {
  if (record?.id) {
    const owned = normalizeStoredSettlement(getStoredSettlement('record', record.id));
    if (owned) return owned;
  }
  const legacyStored = normalizeStoredSettlement(record?.finance);
  if (legacyStored) return legacyStored;
  if (record?.id) {
    const historical = latestHistoricalSettlementForSource('record', record.id);
    if (historical) return historical;
  }
  return calculateSettlement(recordSettlementItems(record), { discountPercent });
}

export function getRecordSettlement(record = null, { discountPercent = 0 } = {}) {
  const settlement = resolveRecordSettlement(record, { discountPercent });
  if (!record?.id) return calculateSettlementTotals(settlement, []);
  return calculateSettlementTotals(settlement, getActiveDDSMovementsForSource('record', record.id));
}

export function getRecordPaymentState(record = null, { discountPercent = 0 } = {}) {
  const settlement = resolveRecordSettlement(record, { discountPercent });
  const movements = record?.id ? getActiveDDSMovementsForSource('record', record.id) : [];
  return calculateSettlementPaymentState(settlement, movements);
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

export function hydrateRecordSettlement(record = null) {
  if (!record?.id) return record;
  const discountPercent = record?.personDiscountPercent == null
    ? recordSettlementDiscountPercent(record?.person)
    : clampFinancialPercent(record.personDiscountPercent);
  const { personDiscountPercent: _legacyDiscount, ...cleanRecord } = record;
  const normalizedRecord = {
    ...cleanRecord,
    procedures: Array.isArray(cleanRecord.procedures) ? cleanRecord.procedures : [],
    products: Array.isArray(cleanRecord.products) ? cleanRecord.products : [],
  };
  const storedSettlement = resolveRecordSettlement(normalizedRecord, { discountPercent });
  const projectedSettlement = getRecordSettlement({ ...normalizedRecord, finance: storedSettlement }, { discountPercent });
  return { ...normalizedRecord, finance: normalizeRecordSettlement(projectedSettlement) };
}
