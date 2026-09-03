import { getTimeUsages, isTimeRangeAvailable } from './time-usage.js';

const KEY = 'book.records';
function read() { try { const value = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } }
function write(records) { localStorage.setItem(KEY, JSON.stringify(records)); }
function readBreaks() { try { const value = JSON.parse(localStorage.getItem('book.journalBreaks') || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } }
export function getRecords() { return read(); }
export function getRecordsForDay(date, workplaceId = '') { const key = String(date || ''); return read().filter((record) => record.date === key && (!workplaceId || record.workplaceId === workplaceId)); }
export function createRecord({ date, workplaceId, from, to, client, procedures = [] } = {}) {
  const normalizedDate = String(date || ''), normalizedWorkplaceId = String(workplaceId || ''), normalizedFrom = String(from || ''), normalizedTo = String(to || '');
  const dayRecords = getRecordsForDay(normalizedDate, normalizedWorkplaceId);
  const dayBreaks = readBreaks().filter((item) => item?.date === normalizedDate && item?.workplaceId === normalizedWorkplaceId);
  if (!isTimeRangeAvailable({ from: normalizedFrom, to: normalizedTo, usages: getTimeUsages({ records: dayRecords, breaks: dayBreaks }) })) return null;
  const record = { id: crypto.randomUUID(), date: normalizedDate, workplaceId: normalizedWorkplaceId, from: normalizedFrom, to: normalizedTo, client: client || null, procedures: Array.isArray(procedures) ? procedures : [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  const records = read(); records.push(record); write(records); return record;
}
export function updateRecord(id, patch = {}) {
  const records = read(), index = records.findIndex((record) => record.id === id); if (index < 0) return null;
  const current = records[index], next = { ...current, ...patch };
  const dayRecords = records.filter((record) => record.date === next.date && record.workplaceId === next.workplaceId);
  const dayBreaks = readBreaks().filter((item) => item?.date === next.date && item?.workplaceId === next.workplaceId);
  if (!isTimeRangeAvailable({ from: next.from, to: next.to, usages: getTimeUsages({ records: dayRecords, breaks: dayBreaks }), excludeId: id })) return null;
  records[index] = { ...next, updatedAt: new Date().toISOString() }; write(records); return records[index];
}
export function removeRecord(id) { const records = read(), next = records.filter((record) => record.id !== id); write(next); return next.length !== records.length; }
