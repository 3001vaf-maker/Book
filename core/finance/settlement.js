// Settlement projects amount due, paid/refunded totals and outstanding amount for a concrete source.
// This is operational calculation, NOT the reserved future Financial Model.
// Low-level arithmetic lives in rules.js; money persistence lives in data/service.
// Canonical Settlement snapshots live in Finance. Record receives finance only as a read projection.
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

export function resolveRecordSettlement(record = null, { discountPercent = 0 } = {}) {
  if (record?.id) {
    const owned = normalizeStoredSettlement(getStoredSettlement('record', record.id));
    if (owned) return owned;
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
  const state = calculateSettlementPaymentState(settlement, movements);
  const date = String(record?.date || '').slice(0, 10);
  const to = String(record?.to || record?.from || '').slice(0, 5);
  const end = date && /^\d{2}:\d{2}$/.test(to) ? new Date(`${date}T${to}:00`) : null;
  const ended = Boolean(end && Number.isFinite(end.getTime()) && Date.now() >= end.getTime());
  const fullyDiscounted = Number(settlement?.serviceTotal || 0) > 0.009
    && Number(settlement?.planTotal || 0) <= 0.009
    && Number(settlement?.discountTotal || 0) + 0.009 >= Number(settlement?.serviceTotal || 0);
  const discountPaid = fullyDiscounted && ended && record?.attendance !== 'no-show';
  return discountPaid ? {
    ...state,
    fullyPaid: true,
    partiallyPaid: false,
    remaining: 0,
    paidByDiscount: true,
  } : {
    ...state,
    paidByDiscount: false,
  };
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
    planTotal: Math.max(0, financialNumber(value.planTotal)),
    factIncome: Math.max(0, financialNumber(value.factIncome)),
    factExpense: Math.max(0, financialNumber(value.factExpense)),
    factTotal: financialNumber(value.factTotal),
  };
}

export function hydrateRecordSettlement(record = null) {
  if (!record?.id) return record;
  const discountPercent = record?.personDiscountPercent == null
    ? recordSettlementDiscountPercent(record?.person)
    : clampFinancialPercent(record.personDiscountPercent);
  const { personDiscountPercent: _discountProjection, ...cleanRecord } = record;
  const normalizedRecord = {
    ...cleanRecord,
    procedures: Array.isArray(cleanRecord.procedures) ? cleanRecord.procedures : [],
    products: Array.isArray(cleanRecord.products) ? cleanRecord.products : [],
  };
  const projectedSettlement = getRecordSettlement(normalizedRecord, { discountPercent });
  return { ...normalizedRecord, finance: normalizeRecordSettlement(projectedSettlement) };
}
