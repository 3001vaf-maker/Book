// Persistence gateway for Record facts.
// Runtime reads are synchronous from an in-memory cache hydrated from the server.
import {
  queueRecordDelete,
  queueRecordEventUpsert,
  queueRecordEventsDelete,
  queueRecordUpsert,
} from '../business-persistence.js';

let recordRowsState = [];
let eventRowsState = [];
let legacySettlementRowsState = [];

function clone(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

function normalizeId(value) {
  return String(value || '');
}

function sanitizeRecordRow(row = null) {
  if (!row || typeof row !== 'object') return row;
  const { finance: _legacyFinance, payment: _legacyPayment, ...rest } = clone(row);
  return rest;
}

export function hydrateRecordStateFromServer({ records = [], recordEvents = [] } = {}) {
  const sourceRecords = Array.isArray(records) ? records : [];
  legacySettlementRowsState = sourceRecords
    .filter((row) => row?.id && row?.finance && typeof row.finance === 'object')
    .map((row) => ({ id: String(row.id), finance: clone(row.finance) }));
  recordRowsState = sourceRecords.map((row) => sanitizeRecordRow(row));
  eventRowsState = (Array.isArray(recordEvents) ? recordEvents : []).map((row) => clone(row));
  return { records: clone(recordRowsState), recordEvents: clone(eventRowsState) };
}

export function getRecordRows() {
  return clone(recordRowsState);
}

export function getRecordRow(id) {
  const recordId = normalizeId(id);
  const row = recordRowsState.find((item) => normalizeId(item?.id) === recordId) || null;
  return clone(row);
}

export function insertRecordRow(row = null) {
  if (!row?.id || getRecordRow(row.id)) return null;
  const stored = sanitizeRecordRow(row);
  recordRowsState.push(stored);
  void queueRecordUpsert(stored, recordRowsState.length - 1);
  return clone(stored);
}

export function patchRecordRow(id, patch = {}) {
  const recordId = normalizeId(id);
  const index = recordRowsState.findIndex((item) => normalizeId(item?.id) === recordId);
  if (index < 0) return null;
  recordRowsState[index] = sanitizeRecordRow({ ...recordRowsState[index], ...clone(patch) });
  void queueRecordUpsert(recordRowsState[index], index);
  return clone(recordRowsState[index]);
}

export function deleteRecordRow(id) {
  const recordId = normalizeId(id);
  const index = recordRowsState.findIndex((item) => normalizeId(item?.id) === recordId);
  if (index < 0) return null;
  const [removed] = recordRowsState.splice(index, 1);
  void queueRecordDelete(recordId);
  return clone(removed);
}

export function getRecordEventRows(recordId = '') {
  const id = normalizeId(recordId);
  return eventRowsState
    .filter((row) => !id || normalizeId(row?.recordId) === id)
    .map((row) => clone(row));
}

export function insertRecordEventRow(row = null) {
  if (!row?.id || !row?.recordId) return null;
  if (eventRowsState.some((item) => normalizeId(item?.id) === normalizeId(row.id))) return null;
  const stored = clone(row);
  eventRowsState.push(stored);
  void queueRecordEventUpsert(stored, eventRowsState.length - 1);
  return clone(stored);
}

export function deleteRecordEventRows(recordId) {
  const id = normalizeId(recordId);
  if (!id) return 0;
  const next = eventRowsState.filter((row) => normalizeId(row?.recordId) !== id);
  const removed = eventRowsState.length - next.length;
  if (removed) {
    eventRowsState = next;
    void queueRecordEventsDelete(id);
  }
  return removed;
}


export function getLegacyRecordSettlementRows() {
  return clone(legacySettlementRowsState);
}

export function persistSanitizedLegacyRecordRows() {
  const ids = new Set(legacySettlementRowsState.map((row) => normalizeId(row?.id)).filter(Boolean));
  let queued = 0;
  recordRowsState.forEach((row, index) => {
    if (!ids.has(normalizeId(row?.id))) return;
    void queueRecordUpsert(row, index);
    queued += 1;
  });
  legacySettlementRowsState = [];
  return queued;
}
