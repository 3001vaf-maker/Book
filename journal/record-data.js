import { containsRange, isValidRange, rangesOverlap } from '../core/time.js';
import { getDays, getDay, getDayTime } from '../core/day.js';
import { getWorkplaces } from '../core/workplace-time.js';

const KEY = 'book.records';
const BREAKS_KEY = 'book.journalBreaks';

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
function usagesForDay(date, workplaceId, records = readList(KEY), breaks = readList(BREAKS_KEY)) {
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

export function getRecords() { return readList(KEY); }
export function getRecordsForDay(date, workplaceId = '') {
  const day = normalizeDate(date), workplace = normalizeId(workplaceId);
  return getRecords().filter((record) => record?.date === day && (!workplace || normalizeId(record?.workplaceId) === workplace));
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
  const record = { id: crypto.randomUUID(), status: 'active', date: normalizedDate, workplaceId: normalizedWorkplaceId, from: String(from), to: String(to), client: client || null, procedures: Array.isArray(procedures) ? procedures : [], createdAt: now, updatedAt: now };
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
  records[index] = { ...next, updatedAt: new Date().toISOString() }; writeList(KEY, records);
  notify('book:records-changed', { action: 'update', recordId: id });
  notify('book:time-usage-changed', { action: 'change', usageId: id, sourceId: id, date: records[index].date, workplaceId: records[index].workplaceId, from: records[index].from, to: records[index].to });
  return records[index];
}
export function cancelRecord(id) {
  const records = getRecords(), index = records.findIndex((record) => record?.id === id);
  if (index < 0 || records[index].status === 'cancelled') return null;
  const previous = records[index]; records[index] = { ...previous, status: 'cancelled', cancelledAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; writeList(KEY, records);
  notify('book:records-changed', { action: 'cancel', recordId: id });
  notify('book:time-usage-changed', { action: 'release', usageId: id, sourceId: id, date: previous.date, workplaceId: previous.workplaceId, from: previous.from, to: previous.to });
  return records[index];
}
export function deleteRecord(id) {
  const records = getRecords(), index = records.findIndex((record) => record?.id === id);
  if (index < 0) return false;
  const removed = records[index]; records.splice(index, 1); writeList(KEY, records);
  notify('book:records-changed', { action: 'delete', recordId: id });
  notify('book:time-usage-changed', { action: 'release', usageId: id, sourceId: id, date: removed.date, workplaceId: removed.workplaceId, from: removed.from, to: removed.to });
  return true;
}
export function moveRecord(id, { date, workplaceId, from, to } = {}) { return updateRecord(id, { date: normalizeDate(date), workplaceId: normalizeId(workplaceId), from: String(from || ''), to: String(to || '') }); }
export function removeRecord(id) { return Boolean(cancelRecord(id)); }
