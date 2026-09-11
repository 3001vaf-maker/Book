import { getRecordRow, getRecordRows } from './record-data.js';
import { getRecordEvents } from './record-events.js';
import { hydrateRecordFinance } from './record-finance.js';
import { projectRecordLifecycle } from './record-state.js';

function normalizeDate(value) {
  return String(value || '').slice(0, 10);
}

function normalizeId(value) {
  return String(value || '');
}

export function readRecord(row = null) {
  if (!row?.id) return null;
  const financed = hydrateRecordFinance(row);
  return projectRecordLifecycle(financed, getRecordEvents(row.id));
}

export function getRecord(id) {
  return readRecord(getRecordRow(id));
}

export function getRecords() {
  return getRecordRows().map(readRecord).filter(Boolean);
}

export function getRecordsForDay(date, workplaceId = '') {
  const day = normalizeDate(date);
  const workplace = normalizeId(workplaceId);
  return getRecords().filter((record) => record?.date === day
    && (!workplace || normalizeId(record?.workplaceId) === workplace));
}

export function getActiveRecordCountForDay(date, workplaceId = '') {
  return getRecordsForDay(date, workplaceId).filter((record) => record?.status !== 'cancelled').length;
}
