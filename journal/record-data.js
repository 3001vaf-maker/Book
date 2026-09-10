import { containsRange, isValidRange, rangesOverlap } from '../core/time.js';
import { getDays, getDay, getDayTime } from '../core/day.js';
import { getWorkplaces } from '../core/workplace-time.js';
import { calculateBusinessPlan, getRecordBusinessPlanFact, resolveRecordBusinessPlan } from '../core/business-model.js';
import { getAllClients } from '../main/clients/data.js';
import { getJournalBreaks } from './break-data.js';

const KEY = 'book.records';

function readList(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}
function writeList(key, value) { localStorage.setItem(key, JSON.stringify(Array.isArray(value) ? value : [])); }
function notify(name, detail = {}) { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(name, { detail })); }
function normalizeDate(value) { return String(value || '').slice(0, 10); }
function normalizeId(value) { return String(value || ''); }
function numberValue(value) {
  const number = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(number) ? number : 0;
}
function percent(value) { return Math.max(0, Math.min(100, numberValue(value))); }
function usagesForDay(date, workplaceId, records = readList(KEY), breaks = getJournalBreaks()) {
  const day = normalizeDate(date), workplace = normalizeId(workplaceId);
  return [
    ...records.filter((item) => item?.date === day && normalizeId(item?.workplaceId) === workplace && item?.status !== 'cancelled').map((item) => ({ ...item, type: 'record', sourceId: item.id })),
    ...breaks.filter((item) => item?.date === day && normalizeId(item?.workplaceId) === workplace).map((item) => ({ ...item, type: 'break', sourceId: item.id })),
  ];
}
function dayAllows({ date, workplaceId, from, to }) {
  const day = getDay(getDays(), workplaceId, date);
  if (!day) return { ok: false, reason: 'day-not-working', day: null, time: null };
  const time = getDayTime(day, getWorkplaces());
  if (!time || !containsRange(time.from, time.to, from, to)) return { ok: false, reason: 'outside-working-time', day, time };
  return { ok: true, reason: '', day, time };
}
function hasUsageConflict({ date, workplaceId, from, to, excludeId = '' }) {
  return usagesForDay(date, workplaceId).some((usage) => usage?.sourceId !== excludeId && rangesOverlap(from, to, usage.from, usage.to));
}

function clientDiscount(client = null) {
  if (!client) return 0;
  const people = getAllClients();
  const person = people.find((item) => String(item?.key || '') === String(client?.key || ''))
    || people.find((item) => String(item?.id || '') === String(client?.id || ''));
  return percent(person?.discountPercent ?? client?.discountPercent ?? 0);
}

function normalizeFinance(value = null) {
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

function storedRecordFinance(record) {
  const legacyDiscount = record?.clientDiscountPercent == null ? clientDiscount(record?.client) : percent(record.clientDiscountPercent);
  return resolveRecordBusinessPlan(record, { discountPercent: legacyDiscount });
}

function hydrateRecord(record) {
  if (!record?.id) return record;
  const legacyDiscount = record?.clientDiscountPercent == null ? clientDiscount(record?.client) : percent(record.clientDiscountPercent);
  const { clientDiscountPercent: _legacyDiscount, ...cleanRecord } = record;
  const finance = getRecordBusinessPlanFact({ ...cleanRecord, finance: storedRecordFinance(record) }, { discountPercent: legacyDiscount });
  return { ...cleanRecord, finance: normalizeFinance(finance) };
}

function repriceBusinessPlan(procedures = [], currentFinance = null) {
  const priorItems = Array.isArray(currentFinance?.items) ? currentFinance.items : [];
  const bySource = new Map(priorItems.map((item) => [String(item?.sourceId || ''), item]));
  const defaultDiscount = currentFinance?.discountPercent == null ? 0 : percent(currentFinance.discountPercent);
  const items = (Array.isArray(procedures) ? procedures : []).map((procedure, index) => {
    const prior = bySource.get(String(procedure?.id || '')) || priorItems[index] || null;
    const base = {
      sourceType: 'procedure',
      sourceId: String(procedure?.id || ''),
      name: String(procedure?.name || ''),
      price: Math.max(0, numberValue(procedure?.cost)),
    };
    if (!prior) return { ...base, discountMode: defaultDiscount > 0 ? 'percent' : 'none', discountPercent: defaultDiscount };
    if (prior.discountMode === 'money') return { ...base, discountMode: 'money', discountMoney: prior.discountMoney };
    if (prior.discountMode === 'percent' || numberValue(prior.discountPercent) > 0) {
      return { ...base, discountMode: 'percent', discountPercent: prior.discountPercent };
    }
    return { ...base, discountMode: 'none' };
  });
  return calculateBusinessPlan(items, { discountPercent: defaultDiscount });
}

export function getRecords() {
  const stored = readList(KEY);
  let changed = false;
  const records = stored.map((record) => {
    const next = hydrateRecord(record);
    if (JSON.stringify(next) !== JSON.stringify(record)) changed = true;
    return next;
  });
  if (changed) writeList(KEY, records);
  return records;
}
export function getRecordsForDay(date, workplaceId = '') {
  const day = normalizeDate(date), workplace = normalizeId(workplaceId);
  return getRecords().filter((record) => record?.date === day && (!workplace || normalizeId(record?.workplaceId) === workplace));
}
export function getActiveRecordCountForDay(date, workplaceId = '') {
  return getRecordsForDay(date, workplaceId).filter((record) => record?.status !== 'cancelled').length;
}

export function getWorkingTimeRecordConflicts({ date, workplaceId, from, to, operation = 'resize' } = {}) {
  const activeRecords = getRecordsForDay(date, workplaceId).filter((record) => record?.status !== 'cancelled');
  if (operation === 'remove') {
    return activeRecords.map((record) => ({ type: 'record', from: String(record?.from || ''), to: String(record?.to || '') }));
  }
  if (!isValidRange(from, to)) return [];
  return activeRecords
    .filter((record) => isValidRange(record?.from, record?.to) && !containsRange(from, to, record.from, record.to))
    .map((record) => ({ type: 'record', from: String(record.from), to: String(record.to) }));
}

export function checkRecordTime({ date, workplaceId, from, to, excludeId = '' } = {}) {
  if (!isValidRange(from, to)) return { ok: false, reason: 'invalid-time' };
  const day = dayAllows({ date, workplaceId, from, to });
  if (!day.ok) return day;
  if (hasUsageConflict({ date, workplaceId, from, to, excludeId })) return { ok: false, reason: 'occupied', day: day.day, time: day.time };
  return day;
}

export function createRecord({ date, workplaceId, from, to, client, procedures = [] } = {}) {
  const normalizedDate = normalizeDate(date), normalizedWorkplaceId = normalizeId(workplaceId);
  if (!checkRecordTime({ date: normalizedDate, workplaceId: normalizedWorkplaceId, from, to }).ok) return null;
  const now = new Date().toISOString();
  const finance = calculateBusinessPlan(procedures, { discountPercent: clientDiscount(client) });
  const record = hydrateRecord({
    id: crypto.randomUUID(),
    status: 'active',
    confirmed: false,
    attendance: '',
    date: normalizedDate,
    workplaceId: normalizedWorkplaceId,
    from: String(from),
    to: String(to),
    client: client || null,
    procedures: Array.isArray(procedures) ? procedures : [],
    finance,
    createdAt: now,
    updatedAt: now,
  });
  const records = getRecords(); records.push(record); writeList(KEY, records);
  notify('book:records-changed', { action: 'create', recordId: record.id });
  notify('book:time-usage-changed', { action: 'occupy', usageId: record.id, sourceId: record.id, date: record.date, workplaceId: record.workplaceId, from: record.from, to: record.to });
  return record;
}

export function updateRecord(id, patch = {}) {
  const records = getRecords(), index = records.findIndex((record) => record?.id === id);
  if (index < 0) return null;
  const current = records[index];
  if (current.status === 'cancelled' && patch.status !== 'active') return null;
  const next = { ...current, ...patch };
  if (next.status !== 'cancelled' && !checkRecordTime({ date: next.date, workplaceId: next.workplaceId, from: next.from, to: next.to, excludeId: id }).ok) return null;

  const hasExplicitFinance = Object.prototype.hasOwnProperty.call(patch, 'finance');
  const serviceChanged = Object.prototype.hasOwnProperty.call(patch, 'procedures');
  const clientChanged = Object.prototype.hasOwnProperty.call(patch, 'client');
  if (hasExplicitFinance) {
    next.finance = normalizeFinance(patch.finance);
  } else if (clientChanged) {
    next.finance = calculateBusinessPlan(next.procedures || [], { discountPercent: clientDiscount(next.client) });
  } else if (serviceChanged) {
    next.finance = repriceBusinessPlan(next.procedures || [], current.finance);
  } else {
    next.finance = current.finance;
  }

  records[index] = hydrateRecord({ ...next, updatedAt: new Date().toISOString() });
  writeList(KEY, records);
  notify('book:records-changed', { action: 'update', recordId: id });
  notify('book:time-usage-changed', { action: 'change', usageId: id, sourceId: id, date: records[index].date, workplaceId: records[index].workplaceId, from: records[index].from, to: records[index].to });
  return records[index];
}

export function cancelRecord(id) {
  const records = getRecords(), index = records.findIndex((record) => record?.id === id);
  if (index < 0 || records[index].status === 'cancelled') return null;
  const previous = records[index];
  records[index] = hydrateRecord({ ...previous, status: 'cancelled', cancelledAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  writeList(KEY, records);
  notify('book:records-changed', { action: 'cancel', recordId: id });
  notify('book:time-usage-changed', { action: 'release', usageId: id, sourceId: id, date: previous.date, workplaceId: previous.workplaceId, from: previous.from, to: previous.to });
  return records[index];
}

export function deleteRecord(id) {
  const records = getRecords(), index = records.findIndex((record) => record?.id === id);
  if (index < 0) return false;
  const removed = records[index];
  records.splice(index, 1); writeList(KEY, records);
  notify('book:records-changed', { action: 'delete', recordId: id });
  notify('book:time-usage-changed', { action: 'release', usageId: id, sourceId: id, date: removed.date, workplaceId: removed.workplaceId, from: removed.from, to: removed.to });
  return true;
}
export function moveRecord(id, { date, workplaceId, from, to } = {}) { return updateRecord(id, { date: normalizeDate(date), workplaceId: normalizeId(workplaceId), from: String(from || ''), to: String(to || '') }); }
export function removeRecord(id) { return Boolean(cancelRecord(id)); }
