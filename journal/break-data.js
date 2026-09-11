// Persistence gateway for Break facts.
// No availability, lifecycle, UI, or workflow decisions belong here.
const KEY = 'book.journalBreaks';

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

export function getBreakRows() {
  return readRows().map((row) => clone(row));
}

export function getBreakRow(id) {
  const breakId = normalizeId(id);
  const row = readRows().find((item) => normalizeId(item?.id) === breakId) || null;
  return clone(row);
}

export function insertBreakRow(row = null) {
  if (!row?.id || getBreakRow(row.id)) return null;
  const rows = readRows();
  const stored = clone(row);
  rows.push(stored);
  writeRows(rows);
  return clone(stored);
}

export function patchBreakRow(id, patch = {}) {
  const breakId = normalizeId(id);
  const rows = readRows();
  const index = rows.findIndex((item) => normalizeId(item?.id) === breakId);
  if (index < 0) return null;
  rows[index] = { ...rows[index], ...clone(patch) };
  writeRows(rows);
  return clone(rows[index]);
}

export function deleteBreakRow(id) {
  const breakId = normalizeId(id);
  const rows = readRows();
  const index = rows.findIndex((item) => normalizeId(item?.id) === breakId);
  if (index < 0) return null;
  const [removed] = rows.splice(index, 1);
  writeRows(rows);
  return clone(removed);
}

export function deleteBreakRowsForDay(workplaceId, date) {
  const workplace = String(workplaceId || '');
  const day = String(date || '').slice(0, 10);
  if (!workplace || !day) return [];
  const rows = readRows();
  const removed = rows.filter((item) => String(item?.workplaceId || '') === workplace
    && String(item?.date || '').slice(0, 10) === day);
  if (!removed.length) return [];
  const kept = rows.filter((item) => !removed.includes(item));
  writeRows(kept);
  return removed.map((item) => clone(item));
}
