import { checkTimeAvailability } from '../core/time/index.js';
import { isValidRange, normalizeTime } from '../core/time/index.js';
import { notifyTimeUsageChanged } from '../core/time/index.js';
import { deleteBreakRow, deleteBreakRowsForDay, getBreakRow, insertBreakRow, patchBreakRow } from './break-data.js';

function normalizeDate(value) {
  return String(value || '').slice(0, 10);
}

function normalizeWorkplaceId(value) {
  return String(value || '');
}

export function createJournalBreak({ workplaceId, date, from, to } = {}) {
  const workplace = normalizeWorkplaceId(workplaceId);
  const day = normalizeDate(date);
  const start = normalizeTime(from, '');
  const end = normalizeTime(to, '');
  if (!workplace || !day || !isValidRange(start, end)) return null;
  if (!checkTimeAvailability({ date: day, workplaceId: workplace, from: start, to: end }).ok) return null;

  const item = {
    id: crypto.randomUUID(),
    workplaceId: workplace,
    date: day,
    from: start,
    to: end,
    createdAt: new Date().toISOString(),
  };
  const stored = insertBreakRow(item);
  if (!stored) return null;
  notifyTimeUsageChanged({ action: 'occupy', usageId: stored.id, sourceId: stored.id, date: stored.date, workplaceId: stored.workplaceId, from: stored.from, to: stored.to });
  return stored;
}

export function moveJournalBreak(id, { from, to } = {}) {
  const current = getBreakRow(id);
  const start = normalizeTime(from, '');
  const end = normalizeTime(to, '');
  if (!current || !isValidRange(start, end)) return null;
  if (!checkTimeAvailability({
    date: current.date,
    workplaceId: current.workplaceId,
    from: start,
    to: end,
    excludeId: current.id,
  }).ok) return null;

  const updated = patchBreakRow(current.id, { from: start, to: end, updatedAt: new Date().toISOString() });
  if (!updated) return null;
  notifyTimeUsageChanged({ action: 'release', usageId: current.id, sourceId: current.id, date: current.date, workplaceId: current.workplaceId, from: current.from, to: current.to });
  notifyTimeUsageChanged({ action: 'occupy', usageId: updated.id, sourceId: updated.id, date: updated.date, workplaceId: updated.workplaceId, from: updated.from, to: updated.to });
  return updated;
}

export function removeJournalBreak(id) {
  const removed = deleteBreakRow(id);
  if (!removed) return false;
  notifyTimeUsageChanged({ action: 'release', usageId: removed.id, sourceId: removed.id, date: removed.date, workplaceId: removed.workplaceId, from: removed.from, to: removed.to });
  return true;
}

export function removeJournalBreaksForDay(workplaceId, date) {
  const removed = deleteBreakRowsForDay(workplaceId, date);
  removed.forEach((item) => notifyTimeUsageChanged({ action: 'release', usageId: item.id, sourceId: item.id, date: item.date, workplaceId: item.workplaceId, from: item.from, to: item.to }));
  return removed.length;
}
