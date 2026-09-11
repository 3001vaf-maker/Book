// Append-only lifecycle facts for Record.
// Record data does not own cancellation / confirmation / attendance history.
const KEY = 'book.recordEvents';

function readEvents() {
  try {
    const values = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(values) ? values : [];
  } catch {
    return [];
  }
}

function writeEvents(values) {
  localStorage.setItem(KEY, JSON.stringify(Array.isArray(values) ? values : []));
}

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
  return readEvents().map((event) => ({ ...event, payload: event?.payload && typeof event.payload === 'object' ? { ...event.payload } : {} }));
}

export function getRecordEvents(recordId) {
  const id = normalizeRecordId(recordId);
  return getAllRecordEvents()
    .filter((event) => normalizeRecordId(event?.recordId) === id)
    .sort((left, right) => Date.parse(left?.at || '') - Date.parse(right?.at || ''));
}

export function appendRecordEvent(recordId, type, { at = '', payload = {} } = {}) {
  const id = normalizeRecordId(recordId);
  const eventType = String(type || '');
  if (!id || !Object.values(RECORD_EVENT_TYPES).includes(eventType)) return null;
  const event = Object.freeze({
    id: crypto.randomUUID(),
    recordId: id,
    type: eventType,
    at: normalizeAt(at),
    payload: payload && typeof payload === 'object' ? { ...payload } : {},
  });
  const events = readEvents();
  events.push(event);
  writeEvents(events);
  return { ...event, payload: { ...event.payload } };
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
  const id = normalizeRecordId(recordId);
  if (!id) return 0;
  const events = readEvents();
  const next = events.filter((event) => normalizeRecordId(event?.recordId) !== id);
  const removed = events.length - next.length;
  if (removed) writeEvents(next);
  return removed;
}
