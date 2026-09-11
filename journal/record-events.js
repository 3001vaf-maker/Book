// Append-only lifecycle facts for Record.
// This module owns lifecycle event meaning; record-data.js owns physical persistence only.
import { deleteRecordEventRows, getRecordEventRows, insertRecordEventRow } from './record-data.js';

function normalizeRecordId(value) {
  return String(value || '');
}

function normalizeAt(value) {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

export const RECORD_EVENT_TYPES = Object.freeze({
  CREATED: 'created',
  CONFIRMED: 'confirmed',
  UNCONFIRMED: 'unconfirmed',
  ARRIVED: 'arrived',
  NO_SHOW: 'no-show',
  ATTENDANCE_CLEARED: 'attendance-cleared',
  CANCELLED: 'cancelled',
});

export function getAllRecordEvents() {
  return getRecordEventRows().map((event) => ({
    ...event,
    payload: event?.payload && typeof event.payload === 'object' ? { ...event.payload } : {},
  }));
}

export function getRecordEvents(recordId) {
  const id = normalizeRecordId(recordId);
  return getRecordEventRows(id)
    .map((event) => ({
      ...event,
      payload: event?.payload && typeof event.payload === 'object' ? { ...event.payload } : {},
    }))
    .sort((left, right) => Date.parse(left?.at || '') - Date.parse(right?.at || ''));
}

export function appendRecordEvent(recordId, type, { at = '', payload = {} } = {}) {
  const id = normalizeRecordId(recordId);
  const eventType = String(type || '');
  if (!id || !Object.values(RECORD_EVENT_TYPES).includes(eventType)) return null;
  const event = {
    id: crypto.randomUUID(),
    recordId: id,
    type: eventType,
    at: normalizeAt(at),
    payload: payload && typeof payload === 'object' ? { ...payload } : {},
  };
  const stored = insertRecordEventRow(event);
  return stored ? { ...stored, payload: { ...(stored.payload || {}) } } : null;
}

export function hasRecordEvent(recordId, type) {
  return getRecordEvents(recordId).some((event) => event.type === type);
}

export function ensureLegacyRecordEvents(record = {}) {
  const recordId = normalizeRecordId(record?.id);
  if (!recordId) return [];
  const existing = getRecordEvents(recordId);
  const types = new Set(existing.map((event) => event.type));
  const createdAt = record?.createdAt || record?.updatedAt || '';

  if (!types.has(RECORD_EVENT_TYPES.CREATED)) {
    appendRecordEvent(recordId, RECORD_EVENT_TYPES.CREATED, { at: createdAt });
  }
  if (record?.confirmed && !types.has(RECORD_EVENT_TYPES.CONFIRMED)) {
    appendRecordEvent(recordId, RECORD_EVENT_TYPES.CONFIRMED, { at: record?.updatedAt || createdAt });
  }
  if (record?.attendance === 'arrived' && !types.has(RECORD_EVENT_TYPES.ARRIVED)) {
    appendRecordEvent(recordId, RECORD_EVENT_TYPES.ARRIVED, { at: record?.updatedAt || createdAt });
  }
  if (record?.attendance === 'no-show' && !types.has(RECORD_EVENT_TYPES.NO_SHOW)) {
    appendRecordEvent(recordId, RECORD_EVENT_TYPES.NO_SHOW, { at: record?.updatedAt || createdAt });
  }
  if (record?.status === 'cancelled' && !types.has(RECORD_EVENT_TYPES.CANCELLED)) {
    appendRecordEvent(recordId, RECORD_EVENT_TYPES.CANCELLED, { at: record?.cancelledAt || record?.updatedAt || createdAt });
  }
  return getRecordEvents(recordId);
}

export function deleteRecordEvents(recordId) {
  return deleteRecordEventRows(recordId);
}
