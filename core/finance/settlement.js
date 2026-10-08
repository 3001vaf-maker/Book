// Settlement projects amount due, paid/refunded totals and outstanding amount for a concrete source.
// Pure arithmetic lives in rules.js; money persistence lives in Finance data/service.
// Canonical Settlement snapshots live in Finance. Record receives finance only as a read projection.
import { getStoredSettlement } from './data.js';
import { getActiveDDSMovements, getActiveDDSMovementsForSource } from './read.js';
import { getPersonDepositPriceConditions } from '../loyalty/deposit/data.js';
import { resolvePersonPriceCondition } from '../loyalty/price-condition.js';
import { getAllPeople } from '../people/data.js';
import {
  calculateSettlementTotals,
  calculateSettlementItemTotals,
  calculateSettlement,
  calculateSettlementPaymentState,
  clampFinancialPercent,
  financialNumber,
  normalizeStoredSettlement,
  recordSettlementItems,
} from './rules.js';

function settlementWithCurrentPricePercent(settlement = null, pricePercent = 0) {
  if (!settlement) return null;
  const percent = clampFinancialPercent(pricePercent);
  const items = (Array.isArray(settlement.items) ? settlement.items : []).map((item) => ({
    ...item,
    pricePercent: percent,
  }));
  return calculateSettlement(items, { pricePercent: percent });
}

export function resolveRecordSettlement(record = null, { pricePercent = null } = {}) {
  const currentPercent = pricePercent == null
    ? recordSettlementPricePercent(record?.person)
    : clampFinancialPercent(pricePercent);
  if (record?.id) {
    const owned = normalizeStoredSettlement(getStoredSettlement('record', record.id));
    if (owned) {
      // A paid Settlement is historical. Before payment, current person/program conditions
      // may change while an explicit manual correction remains saved.
      const movements = getActiveDDSMovementsForSource('record', record.id);
      return movements.length ? owned : settlementWithCurrentPricePercent(owned, currentPercent);
    }
  }
  return calculateSettlement(recordSettlementItems(record), { pricePercent: currentPercent });
}

export function getRecordSettlement(record = null, { pricePercent = null } = {}) {
  const settlement = resolveRecordSettlement(record, { pricePercent });
  if (!record?.id) return calculateSettlementTotals(settlement, []);
  return calculateSettlementTotals(settlement, getActiveDDSMovementsForSource('record', record.id));
}

export function getRecordPaymentState(record = null, { pricePercent = null } = {}) {
  const settlement = resolveRecordSettlement(record, { pricePercent });
  const movements = record?.id ? getActiveDDSMovementsForSource('record', record.id) : [];
  const state = calculateSettlementPaymentState(settlement, movements);
  const date = String(record?.date || '').slice(0, 10);
  const to = String(record?.to || record?.from || '').slice(0, 5);
  const end = date && /^\d{2}:\d{2}$/.test(to) ? new Date(`${date}T${to}:00`) : null;
  const ended = Boolean(end && Number.isFinite(end.getTime()) && Date.now() >= end.getTime());
  const zeroPrice = Number(settlement?.serviceTotal || 0) > 0.009 && Number(settlement?.planTotal || 0) <= 0.009;
  const settledByPriceRules = zeroPrice && ended && record?.attendance !== 'no-show';
  return settledByPriceRules ? {
    ...state,
    fullyPaid: true,
    partiallyPaid: false,
    remaining: 0,
    settledByPriceRules: true,
  } : {
    ...state,
    settledByPriceRules: false,
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

export function getSettlementItemTotalsForRecords(sourceTypeValue, sourceIdValue, recordIds = []) {
  const ids = new Set((Array.isArray(recordIds) ? recordIds : []).map((id) => String(id || '')).filter(Boolean));
  const movements = getActiveDDSMovements().filter((movement) => movement?.source?.type === 'record' && ids.has(String(movement?.source?.id || '')));
  return calculateSettlementItemTotals(movements, sourceTypeValue, sourceIdValue);
}

export function recordAmountDue(record = null) {
  return resolveRecordSettlement(record).planTotal;
}

function currentPerson(person = null) {
  const key = String(person?.key || person?.id || '').trim();
  if (!key) return person || {};
  return getAllPeople().find((item) => String(item?.key || item?.id || '').trim() === key) || person || {};
}

export function recordSettlementPriceCondition(person = null) {
  const owner = currentPerson(person);
  const key = String(owner?.key || owner?.id || person?.key || person?.id || '').trim();
  return resolvePersonPriceCondition(owner, getPersonDepositPriceConditions(key));
}

export function recordSettlementPricePercent(person = null) {
  return recordSettlementPriceCondition(person).percent;
}

export function normalizeRecordSettlement(value = null) {
  if (!value || typeof value !== 'object') return null;
  return {
    items: Array.isArray(value.items) ? value.items.map((item) => ({ ...item })) : [],
    serviceTotal: Math.max(0, financialNumber(value.serviceTotal)),
    pricePercent: value.pricePercent == null ? null : clampFinancialPercent(value.pricePercent),
    correctionTotal: Math.max(0, financialNumber(value.correctionTotal)),
    pricePercentTotal: Math.max(0, financialNumber(value.pricePercentTotal)),
    planTotal: Math.max(0, financialNumber(value.planTotal)),
    factIncome: Math.max(0, financialNumber(value.factIncome)),
    factExpense: Math.max(0, financialNumber(value.factExpense)),
    factTotal: financialNumber(value.factTotal),
  };
}

export function hydrateRecordSettlement(record = null) {
  if (!record?.id) return record;
  const condition = recordSettlementPriceCondition(record?.person);
  const { personDiscountPercent: _priceProjection, ...cleanRecord } = record;
  const normalizedRecord = {
    ...cleanRecord,
    procedures: Array.isArray(cleanRecord.procedures) ? cleanRecord.procedures : [],
    products: Array.isArray(cleanRecord.products) ? cleanRecord.products : [],
  };
  const projectedSettlement = getRecordSettlement(normalizedRecord, { pricePercent: condition.percent });
  return {
    ...normalizedRecord,
    priceCondition: condition,
    finance: normalizeRecordSettlement(projectedSettlement),
  };
}
