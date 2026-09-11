// Persistence gateway for Record facts.
// No scheduling, finance, lifecycle meaning, UI, or workflow decisions belong here.
const RECORDS_KEY = 'book.records';
const EVENTS_KEY = 'book.recordEvents';

function clone(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

function readRows(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function writeRows(key, rows) {
  localStorage.setItem(key, JSON.stringify(Array.isArray(rows) ? rows : []));
}

function normalizeId(value) {
  return String(value || '');
}

export function getRecordRows() {
  return readRows(RECORDS_KEY).map((row) => clone(row));
}

export function getRecordRow(id) {
  const recordId = normalizeId(id);
  const row = readRows(RECORDS_KEY).find((item) => normalizeId(item?.id) === recordId) || null;
  return clone(row);
}

export function insertRecordRow(row = null) {
  if (!row?.id || getRecordRow(row.id)) return null;
  const rows = readRows(RECORDS_KEY);
  const stored = clone(row);
  rows.push(stored);
  writeRows(RECORDS_KEY, rows);
  return clone(stored);
}

export function patchRecordRow(id, patch = {}) {
  const recordId = normalizeId(id);
  const rows = readRows(RECORDS_KEY);
  const index = rows.findIndex((item) => normalizeId(item?.id) === recordId);
  if (index < 0) return null;
  rows[index] = { ...rows[index], ...clone(patch) };
  writeRows(RECORDS_KEY, rows);
  return clone(rows[index]);
}

export function deleteRecordRow(id) {
  const recordId = normalizeId(id);
  const rows = readRows(RECORDS_KEY);
  const index = rows.findIndex((item) => normalizeId(item?.id) === recordId);
  if (index < 0) return null;
  const [removed] = rows.splice(index, 1);
  writeRows(RECORDS_KEY, rows);
  return clone(removed);
}

export function getRecordEventRows(recordId = '') {
  const id = normalizeId(recordId);
  return readRows(EVENTS_KEY)
    .filter((row) => !id || normalizeId(row?.recordId) === id)
    .map((row) => clone(row));
}

export function insertRecordEventRow(row = null) {
  if (!row?.id || !row?.recordId) return null;
  const rows = readRows(EVENTS_KEY);
  if (rows.some((item) => normalizeId(item?.id) === normalizeId(row.id))) return null;
  const stored = clone(row);
  rows.push(stored);
  writeRows(EVENTS_KEY, rows);
  return clone(stored);
}

export function deleteRecordEventRows(recordId) {
  const id = normalizeId(recordId);
  if (!id) return 0;
  const rows = readRows(EVENTS_KEY);
  const next = rows.filter((row) => normalizeId(row?.recordId) !== id);
  const removed = rows.length - next.length;
  if (removed) writeRows(EVENTS_KEY, next);
  return removed;
}
