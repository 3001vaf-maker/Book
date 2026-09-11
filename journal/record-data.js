// Persistence gateway for Record facts.
// No scheduling, finance, lifecycle, UI, or workflow decisions belong here.
const KEY = 'book.records';

function clone(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

function readRows() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function writeRows(rows) {
  localStorage.setItem(KEY, JSON.stringify(Array.isArray(rows) ? rows : []));
}

function normalizeId(value) {
  return String(value || '');
}

export function getRecordRows() {
  return readRows().map((row) => clone(row));
}

export function getRecordRow(id) {
  const recordId = normalizeId(id);
  const row = readRows().find((item) => normalizeId(item?.id) === recordId) || null;
  return clone(row);
}

export function insertRecordRow(row = null) {
  if (!row?.id || getRecordRow(row.id)) return null;
  const rows = readRows();
  const stored = clone(row);
  rows.push(stored);
  writeRows(rows);
  return clone(stored);
}

export function patchRecordRow(id, patch = {}) {
  const recordId = normalizeId(id);
  const rows = readRows();
  const index = rows.findIndex((item) => normalizeId(item?.id) === recordId);
  if (index < 0) return null;
  rows[index] = { ...rows[index], ...clone(patch) };
  writeRows(rows);
  return clone(rows[index]);
}

export function deleteRecordRow(id) {
  const recordId = normalizeId(id);
  const rows = readRows();
  const index = rows.findIndex((item) => normalizeId(item?.id) === recordId);
  if (index < 0) return null;
  const [removed] = rows.splice(index, 1);
  writeRows(rows);
  return clone(removed);
}
