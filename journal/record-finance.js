import { getRecordFinancialPlanFact, resolveRecordFinancialPlan } from '../core/financial-model.js';
import { getAllClients } from '../main/clients/data.js';

function numberValue(value) {
  const number = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(number) ? number : 0;
}

function percent(value) {
  return Math.max(0, Math.min(100, numberValue(value)));
}

export function recordClientDiscount(client = null) {
  if (!client) return 0;
  const people = getAllClients();
  const person = people.find((item) => String(item?.key || '') === String(client?.key || ''))
    || people.find((item) => String(item?.id || '') === String(client?.id || ''));
  return percent(person?.discountPercent ?? client?.discountPercent ?? 0);
}

export function normalizeRecordFinance(value = null) {
  if (!value || typeof value !== 'object') return null;
  return {
    items: Array.isArray(value.items) ? value.items.map((item) => ({ ...item })) : [],
    serviceTotal: Math.max(0, numberValue(value.serviceTotal)),
    discountPercent: value.discountPercent == null ? null : percent(value.discountPercent),
    discountTotal: Math.max(0, numberValue(value.discountTotal)),
    planTotal: Math.max(0, numberValue(value.planTotal ?? value.dueTotal)),
    factIncome: Math.max(0, numberValue(value.factIncome ?? value.paidTotal)),
    factExpense: Math.max(0, numberValue(value.factExpense ?? value.refundedTotal)),
    factTotal: numberValue(value.factTotal ?? value.netPaidTotal),
  };
}

export function hydrateRecordFinance(record = null) {
  if (!record?.id) return record;
  const discountPercent = record?.clientDiscountPercent == null
    ? recordClientDiscount(record?.client)
    : percent(record.clientDiscountPercent);
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
