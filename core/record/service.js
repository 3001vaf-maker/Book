import { checkTimeAvailability } from '../time/index.js';
import {
  calculateFinancialPlan,
  normalizeRecordFinance,
  recordClientDiscount,
  recordFinancialItems,
  repriceFinancialPlan,
} from '../finance/index.js';
import { deleteRecordRow, insertRecordRow, patchRecordRow } from './data.js';
import { appendRecordEvent, deleteRecordEvents, RECORD_EVENT_TYPES } from './events.js';
import { getRecord } from './read.js';

function notify(name, detail = {}) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(name, { detail }));
}

function normalizeDate(value) {
  return String(value || '').slice(0, 10);
}

function normalizeId(value) {
  return String(value || '');
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function dataPatchFrom(patch = {}) {
  const lifecycleKeys = new Set([
    'status',
    'confirmed',
    'attendance',
    'confirmedAt',
    'attendanceAt',
    'cancelledAt',
    'lifecycleUpdatedAt',
  ]);
  return Object.fromEntries(Object.entries(patch).filter(([key]) => !lifecycleKeys.has(key)));
}

function scheduleChanged(patch = {}) {
  return ['date', 'workplaceId', 'from', 'to'].some((key) => hasOwn(patch, key));
}

function appendLifecyclePatch(record, patch = {}) {
  if (!record?.id) return;
  if (hasOwn(patch, 'confirmed') && Boolean(patch.confirmed) !== Boolean(record.confirmed)) {
    appendRecordEvent(record.id, patch.confirmed ? RECORD_EVENT_TYPES.CONFIRMED : RECORD_EVENT_TYPES.UNCONFIRMED);
  }

  if (hasOwn(patch, 'attendance')) {
    const next = patch.attendance === 'arrived' || patch.attendance === 'no-show' ? patch.attendance : '';
    if (next && next !== record.attendance) {
      appendRecordEvent(record.id, next === 'arrived' ? RECORD_EVENT_TYPES.ARRIVED : RECORD_EVENT_TYPES.NO_SHOW);
    } else if (!next && record.attendance) {
      appendRecordEvent(record.id, RECORD_EVENT_TYPES.ATTENDANCE_CLEARED);
    }
  }
}

export function checkRecordTime({ date, workplaceId, from, to, excludeId = '' } = {}) {
  const result = checkTimeAvailability({ date, workplaceId, from, to, excludeId });
  return { ok: result.ok, reason: result.reason, conflicts: result.conflicts || [] };
}

export function createRecord({
  date,
  workplaceId,
  from,
  to,
  client,
  procedures = [],
  products = [],
  source = 'manual',
  sourceRequestId = '',
} = {}) {
  const normalizedDate = normalizeDate(date);
  const normalizedWorkplaceId = normalizeId(workplaceId);
  if (!checkRecordTime({ date: normalizedDate, workplaceId: normalizedWorkplaceId, from, to }).ok) return null;

  const now = new Date().toISOString();
  const sourceRecord = {
    procedures: Array.isArray(procedures) ? procedures : [],
    products: Array.isArray(products) ? products : [],
  };
  const finance = calculateFinancialPlan(recordFinancialItems(sourceRecord), {
    discountPercent: recordClientDiscount(client),
  });
  const row = {
    id: crypto.randomUUID(),
    date: normalizedDate,
    workplaceId: normalizedWorkplaceId,
    from: String(from || ''),
    to: String(to || ''),
    client: client || null,
    procedures: sourceRecord.procedures,
    products: sourceRecord.products,
    source: String(source || 'manual'),
    sourceRequestId: String(sourceRequestId || ''),
    finance,
    createdAt: now,
    updatedAt: now,
  };

  const stored = insertRecordRow(row);
  if (!stored) return null;
  appendRecordEvent(stored.id, RECORD_EVENT_TYPES.CREATED, { at: now });
  const record = getRecord(stored.id);
  notify('book:records-changed', { action: 'create', recordId: stored.id });
  notify('book:time-usage-changed', {
    action: 'occupy',
    usageId: stored.id,
    sourceId: stored.id,
    date: stored.date,
    workplaceId: stored.workplaceId,
    from: stored.from,
    to: stored.to,
  });
  return record;
}

export function updateRecord(id, patch = {}) {
  const current = getRecord(id);
  if (!current || current.status === 'cancelled') return null;

  const nextDataPatch = dataPatchFrom(patch);
  if (hasOwn(nextDataPatch, 'date')) nextDataPatch.date = normalizeDate(nextDataPatch.date);
  if (hasOwn(nextDataPatch, 'workplaceId')) nextDataPatch.workplaceId = normalizeId(nextDataPatch.workplaceId);
  if (hasOwn(nextDataPatch, 'from')) nextDataPatch.from = String(nextDataPatch.from || '');
  if (hasOwn(nextDataPatch, 'to')) nextDataPatch.to = String(nextDataPatch.to || '');
  if (hasOwn(nextDataPatch, 'procedures')) nextDataPatch.procedures = Array.isArray(nextDataPatch.procedures) ? nextDataPatch.procedures : [];
  if (hasOwn(nextDataPatch, 'products')) nextDataPatch.products = Array.isArray(nextDataPatch.products) ? nextDataPatch.products : [];

  const next = { ...current, ...nextDataPatch };
  if (!checkRecordTime({
    date: next.date,
    workplaceId: next.workplaceId,
    from: next.from,
    to: next.to,
    excludeId: id,
  }).ok) return null;

  const hasExplicitFinance = hasOwn(nextDataPatch, 'finance');
  const serviceChanged = hasOwn(nextDataPatch, 'procedures');
  const productChanged = hasOwn(nextDataPatch, 'products');
  const clientChanged = hasOwn(nextDataPatch, 'client');

  if (hasExplicitFinance) {
    nextDataPatch.finance = normalizeRecordFinance(nextDataPatch.finance);
  } else if (clientChanged) {
    nextDataPatch.finance = calculateFinancialPlan(recordFinancialItems(next), {
      discountPercent: recordClientDiscount(next.client),
    });
  } else if (serviceChanged || productChanged) {
    nextDataPatch.finance = repriceFinancialPlan(recordFinancialItems(next), current.finance);
  }

  if (Object.keys(nextDataPatch).length) {
    nextDataPatch.updatedAt = new Date().toISOString();
    if (!patchRecordRow(id, nextDataPatch)) return null;
  }

  appendLifecyclePatch(current, patch);
  const updated = getRecord(id);
  notify('book:records-changed', { action: 'update', recordId: id });
  if (scheduleChanged(nextDataPatch)) {
    notify('book:time-usage-changed', {
      action: 'change', usageId: id, sourceId: id,
      date: updated?.date, workplaceId: updated?.workplaceId,
      from: updated?.from, to: updated?.to,
    });
  }
  return updated;
}

export function setRecordConfirmed(id, confirmed) {
  return updateRecord(id, { confirmed: Boolean(confirmed) });
}

export function setRecordAttendance(id, attendance) {
  const value = attendance === 'arrived' || attendance === 'no-show' ? attendance : '';
  return updateRecord(id, { attendance: value });
}

export function cancelRecord(id) {
  const current = getRecord(id);
  if (!current || current.status === 'cancelled') return null;
  appendRecordEvent(id, RECORD_EVENT_TYPES.CANCELLED);
  const cancelled = getRecord(id);
  notify('book:records-changed', { action: 'cancel', recordId: id });
  notify('book:time-usage-changed', {
    action: 'release', usageId: id, sourceId: id,
    date: current.date, workplaceId: current.workplaceId,
    from: current.from, to: current.to,
  });
  return cancelled;
}

export function deleteRecord(id) {
  const current = getRecord(id);
  if (!current) return false;
  if (!deleteRecordRow(id)) return false;
  deleteRecordEvents(id);
  notify('book:records-changed', { action: 'delete', recordId: id });
  if (current.status !== 'cancelled') {
    notify('book:time-usage-changed', {
      action: 'release', usageId: id, sourceId: id,
      date: current.date, workplaceId: current.workplaceId,
      from: current.from, to: current.to,
    });
  }
  return true;
}

export function moveRecord(id, { date, workplaceId, from, to } = {}) {
  return updateRecord(id, {
    date: normalizeDate(date),
    workplaceId: normalizeId(workplaceId),
    from: String(from || ''),
    to: String(to || ''),
  });
}

export function removeRecord(id) {
  return Boolean(cancelRecord(id));
}
