// Financial Model builds plan/fact projections from source facts and pure rules.
// Low-level arithmetic lives in rules.js; money persistence lives in data/service.
import { getActiveDDSMovements, getActiveDDSMovementsForSource } from './read.js';
import {
  calculateFinancialFact,
  calculateFinancialItemFact,
  calculateFinancialPlan,
  calculateRecordPaymentState,
  clampFinancialPercent,
  financialNumber,
  isStoredFinancialPlan,
  normalizeStoredFinancialPlan,
  recordFinancialItems,
} from './rules.js';

function latestHistoricalPlanForSource(type, id) {
  const movements = getActiveDDSMovementsForSource(type, id)
    .filter((movement) => movement?.finance && isStoredFinancialPlan(movement.finance))
    .sort((a, b) => String(a?.createdAt || '').localeCompare(String(b?.createdAt || '')));
  if (!movements.length) return null;
  return normalizeStoredFinancialPlan(movements[movements.length - 1].finance);
}

export function resolveRecordFinancialPlan(record = null, { discountPercent = 0 } = {}) {
  const stored = normalizeStoredFinancialPlan(record?.finance);
  if (stored) return stored;
  if (record?.id) {
    const historical = latestHistoricalPlanForSource('record', record.id);
    if (historical) return historical;
  }
  return calculateFinancialPlan(recordFinancialItems(record), { discountPercent });
}

export function getRecordFinancialPlanFact(record = null, { discountPercent = 0 } = {}) {
  const plan = resolveRecordFinancialPlan(record, { discountPercent });
  if (!record?.id) return calculateFinancialFact(plan, []);
  return calculateFinancialFact(plan, getActiveDDSMovementsForSource('record', record.id));
}

export function getRecordPaymentState(record = null, { discountPercent = 0 } = {}) {
  const plan = resolveRecordFinancialPlan(record, { discountPercent });
  const movements = record?.id ? getActiveDDSMovementsForSource('record', record.id) : [];
  return calculateRecordPaymentState(plan, movements);
}

export function getFinancialFactForRecords(recordIds = []) {
  const ids = new Set((Array.isArray(recordIds) ? recordIds : []).map((id) => String(id || '')).filter(Boolean));
  const movements = getActiveDDSMovements().filter((movement) => movement?.source?.type === 'record' && ids.has(String(movement?.source?.id || '')));
  return calculateFinancialFact(null, movements);
}

export function getFinancialItemFact(sourceTypeValue, sourceIdValue) {
  return calculateFinancialItemFact(getActiveDDSMovements(), sourceTypeValue, sourceIdValue);
}

export function recordPlanTotal(record = null) {
  return resolveRecordFinancialPlan(record).planTotal;
}

export function recordClientDiscount(client = null) {
  return clampFinancialPercent(client?.discountPercent ?? 0);
}

export function normalizeRecordFinance(value = null) {
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

export function hydrateRecordFinance(record = null) {
  if (!record?.id) return record;
  const discountPercent = record?.clientDiscountPercent == null
    ? recordClientDiscount(record?.client)
    : clampFinancialPercent(record.clientDiscountPercent);
  const { clientDiscountPercent: _legacyDiscount, ...cleanRecord } = record;
  const normalizedRecord = {
    ...cleanRecord,
    procedures: Array.isArray(cleanRecord.procedures) ? cleanRecord.procedures : [],
    products: Array.isArray(cleanRecord.products) ? cleanRecord.products : [],
  };
  const storedPlan = resolveRecordFinancialPlan(normalizedRecord, { discountPercent });
  const finance = getRecordFinancialPlanFact({ ...normalizedRecord, finance: storedPlan }, { discountPercent });
  return { ...normalizedRecord, finance: normalizeRecordFinance(finance) };
}
