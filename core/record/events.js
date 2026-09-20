// Append-only history facts for Record.
// Event meaning lives here; data.js owns physical persistence only.
import { deleteRecordEventRows, getRecordEventRows, insertRecordEventRow } from './data.js';

function normalizeRecordId(value) {
  return String(value || '');
}

function normalizeAt(value) {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

function objectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeActor(value = null) {
  const source = objectValue(value);
  return {
    type: String(source.type || ''),
    profileId: String(source.profileId || ''),
    accountId: String(source.accountId || ''),
  };
}

function normalizeSubject(value = null) {
  const source = objectValue(value);
  return {
    personId: String(source.personId || ''),
    personKey: String(source.personKey || ''),
    name: String(source.name || ''),
    surname: String(source.surname || ''),
  };
}

export const RECORD_EVENT_TYPES = Object.freeze({
  CREATED: 'created',
  RESCHEDULED: 'rescheduled',
  CONFIRMED: 'confirmed',
  UNCONFIRMED: 'unconfirmed',
  ARRIVED: 'arrived',
  NO_SHOW: 'no-show',
  ATTENDANCE_CLEARED: 'attendance-cleared',
  CANCELLED: 'cancelled',
});

export const RECORD_EVENT_CATEGORIES = Object.freeze({
  ACTION: 'action',
  STATUS: 'status',
  ATTENDANCE: 'attendance',
});

export function recordEventCategory(type) {
  if ([RECORD_EVENT_TYPES.CREATED, RECORD_EVENT_TYPES.RESCHEDULED, RECORD_EVENT_TYPES.CANCELLED].includes(type)) {
    return RECORD_EVENT_CATEGORIES.ACTION;
  }
  if ([RECORD_EVENT_TYPES.CONFIRMED, RECORD_EVENT_TYPES.UNCONFIRMED].includes(type)) {
    return RECORD_EVENT_CATEGORIES.STATUS;
  }
  if ([RECORD_EVENT_TYPES.ARRIVED, RECORD_EVENT_TYPES.NO_SHOW, RECORD_EVENT_TYPES.ATTENDANCE_CLEARED].includes(type)) {
    return RECORD_EVENT_CATEGORIES.ATTENDANCE;
  }
  return '';
}

function normalizeEvent(event = {}) {
  return {
    ...event,
    category: String(event?.category || recordEventCategory(event?.type)),
    source: String(event?.source || ''),
    actor: normalizeActor(event?.actor),
    subject: normalizeSubject(event?.subject),
    payload: { ...objectValue(event?.payload) },
  };
}

export function getAllRecordEvents() {
  return getRecordEventRows().map(normalizeEvent);
}

export function getRecordEvents(recordId) {
  const id = normalizeRecordId(recordId);
  return getRecordEventRows(id)
    .map(normalizeEvent)
    .sort((left, right) => Date.parse(left?.at || '') - Date.parse(right?.at || ''));
}

export function appendRecordEvent(recordId, type, {
  at = '',
  source = '',
  actor = null,
  subject = null,
  payload = {},
} = {}) {
  const id = normalizeRecordId(recordId);
  const eventType = String(type || '');
  if (!id || !Object.values(RECORD_EVENT_TYPES).includes(eventType)) return null;
  const event = {
    id: crypto.randomUUID(),
    recordId: id,
    type: eventType,
    category: recordEventCategory(eventType),
    at: normalizeAt(at),
    source: String(source || ''),
    actor: normalizeActor(actor),
    subject: normalizeSubject(subject),
    payload: { ...objectValue(payload) },
  };
  const stored = insertRecordEventRow(event);
  return stored ? normalizeEvent(stored) : null;
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

  if (!types.has(RECORD_EVENT_TYPES.CREATED)) appendRecordEvent(recordId, RECORD_EVENT_TYPES.CREATED, { at: createdAt });
  if (record?.confirmed && !types.has(RECORD_EVENT_TYPES.CONFIRMED)) appendRecordEvent(recordId, RECORD_EVENT_TYPES.CONFIRMED, { at: record?.updatedAt || createdAt });
  if (record?.attendance === 'arrived' && !types.has(RECORD_EVENT_TYPES.ARRIVED)) appendRecordEvent(recordId, RECORD_EVENT_TYPES.ARRIVED, { at: record?.updatedAt || createdAt });
  if (record?.attendance === 'no-show' && !types.has(RECORD_EVENT_TYPES.NO_SHOW)) appendRecordEvent(recordId, RECORD_EVENT_TYPES.NO_SHOW, { at: record?.updatedAt || createdAt });
  if (record?.status === 'cancelled' && !types.has(RECORD_EVENT_TYPES.CANCELLED)) appendRecordEvent(recordId, RECORD_EVENT_TYPES.CANCELLED, { at: record?.cancelledAt || record?.updatedAt || createdAt });
  return getRecordEvents(recordId);
}

export function deleteRecordEvents(recordId) {
  return deleteRecordEventRows(recordId);
}
