import { containsRange, isValidRange, rangesOverlap } from '../core/time.js';
import { getDays, getDay, getDayTime } from '../core/day.js';
import { getWorkplaces } from '../core/workplace-time.js';
import { getFinanceForSource, getOperationalFinanceForSource, setOperationalFinanceStatus, syncOperationalFinance } from '../core/dds.js';
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

function financeSnapshot(finance = null) {
  if (!finance) return null;
  return {
    items: Array.isArray(finance.items) ? finance.items.map((item) => ({ ...item })) : [],
    serviceTotal: Math.max(0, numberValue(finance.serviceTotal)),
    discountPercent: finance.discountPercent == null ? null : percent(finance.discountPercent),
    discountTotal: Math.max(0, numberValue(finance.discountTotal)),
    dueTotal: Math.max(0, numberValue(finance.dueTotal)),
    paidTotal: Math.max(0, numberValue(finance.paidTotal)),
    refundedTotal: Math.max(0, numberValue(finance.refundedTotal)),
    netPaidTotal: Math.max(0, numberValue(finance.netPaidTotal)),
  };
}

function syncRecordFinance(record, { recalculate = false } = {}) {
  if (!record?.id) return record;
  let operational = getOperationalFinanceForSource('record', record.id);
  let clientDiscountPercent = record.clientDiscountPercent == null
    ? clientDiscount(record.client)
    : percent(record.clientDiscountPercent);

  if (recalculate || !operational) {
    operational = syncOperationalFinance({
      source: { type: 'record', id: record.id },
      workplace: record.workplaceId,
      client: record.client,
      items: record.procedures,
      discountPercent: clientDiscountPercent,
      status: record.status || 'active',
    });
  }

  const finance = financeSnapshot(getFinanceForSource('record', record.id));
  if (finance?.discountPercent != null) clientDiscountPercent = finance.discountPercent;
  return { ...record, clientDiscountPercent, finance };
}

export function getRecords() {
  const stored = readList(KEY);
  let changed = false;
  const records = stored.map((record) => {
    const next = syncRecordFinance(record);
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

/**
 * Record owns appointment data. Core asks only whether Records block a
 * proposed working-time change or complete Day removal.
 */
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
export function createRecord({ date, workplaceId, from, to, client, procedures = [], clientDiscountPercent = null } = {}) {
  const normalizedDate = normalizeDate(date), normalizedWorkplaceId = normalizeId(workplaceId);
  if (!checkRecordTime({ date: normalizedDate, workplaceId: normalizedWorkplaceId, from, to }).ok) return null;
  const now = new Date().toISOString();
  const record = syncRecordFinance({
    id: crypto.randomUUID(),
    status: 'active',
    confirmed: false,
    attendance: '',
    date: normalizedDate,
    workplaceId: normalizedWorkplaceId,
    from: String(from),
    to: String(to),
    client: client || null,
    clientDiscountPercent: clientDiscountPercent == null ? clientDiscount(client) : percent(clientDiscountPercent),
    procedures: Array.isArray(procedures) ? procedures : [],
    createdAt: now,
    updatedAt: now,
  }, { recalculate: true });
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
  const financialInputsChanged = Object.prototype.hasOwnProperty.call(patch, 'procedures')
    || Object.prototype.hasOwnProperty.call(patch, 'client')
    || Object.prototype.hasOwnProperty.call(patch, 'clientDiscountPercent');
  const nextDiscount = Object.prototype.hasOwnProperty.call(patch, 'clientDiscountPercent')
    ? percent(patch.clientDiscountPercent)
    : Object.prototype.hasOwnProperty.call(patch, 'client')
      ? clientDiscount(patch.client)
      : percent(current.clientDiscountPercent);
  const next = { ...current, ...patch, clientDiscountPercent: nextDiscount };
  if (next.status !== 'cancelled' && !checkRecordTime({ date: next.date, workplaceId: next.workplaceId, from: next.from, to: next.to, excludeId: id }).ok) return null;
  records[index] = syncRecordFinance({ ...next, updatedAt: new Date().toISOString() }, { recalculate: financialInputsChanged }); writeList(KEY, records);
  notify('book:records-changed', { action: 'update', recordId: id });
  notify('book:time-usage-changed', { action: 'change', usageId: id, sourceId: id, date: records[index].date, workplaceId: records[index].workplaceId, from: records[index].from, to: records[index].to });
  return records[index];
}
export function cancelRecord(id) {
  const records = getRecords(), index = records.findIndex((record) => record?.id === id);
  if (index < 0 || records[index].status === 'cancelled') return null;
  const previous = records[index];
  setOperationalFinanceStatus('record', id, 'cancelled');
  records[index] = syncRecordFinance({ ...previous, status: 'cancelled', cancelledAt: new Date().toISOString(), updatedAt: new Date().toISOString() }); writeList(KEY, records);
  notify('book:records-changed', { action: 'cancel', recordId: id });
  notify('book:time-usage-changed', { action: 'release', usageId: id, sourceId: id, date: previous.date, workplaceId: previous.workplaceId, from: previous.from, to: previous.to });
  return records[index];
}
export function deleteRecord(id) {
  const records = getRecords(), index = records.findIndex((record) => record?.id === id);
  if (index < 0) return false;
  const removed = records[index];
  setOperationalFinanceStatus('record', id, 'deleted');
  records.splice(index, 1); writeList(KEY, records);
  notify('book:records-changed', { action: 'delete', recordId: id });
  notify('book:time-usage-changed', { action: 'release', usageId: id, sourceId: id, date: removed.date, workplaceId: removed.workplaceId, from: removed.from, to: removed.to });
  return true;
}
export function moveRecord(id, { date, workplaceId, from, to } = {}) { return updateRecord(id, { date: normalizeDate(date), workplaceId: normalizeId(workplaceId), from: String(from || ''), to: String(to || '') }); }
export function removeRecord(id) { return Boolean(cancelRecord(id)); }
