import { isValidRange, minutesBetween, normalizeTime, timeToMinutes } from '../core/time.js';
import { notifyTimeUsageChanged } from '../core/time-usage.js';

const KEY = 'book.journalBreaks';

function readBreaks() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function writeBreaks(values) {
  localStorage.setItem(KEY, JSON.stringify(Array.isArray(values) ? values : []));
}

export function getJournalBreaks() {
  return readBreaks();
}

export function getJournalBreaksForDay(breaks, workplaceId, date) {
  const workplace = String(workplaceId || '');
  const day = String(date || '');
  return (Array.isArray(breaks) ? breaks : [])
    .filter((item) => String(item?.workplaceId || '') === workplace && String(item?.date || '') === day)
    .sort((a, b) => (timeToMinutes(a?.from) ?? 0) - (timeToMinutes(b?.from) ?? 0));
}

export function createJournalBreak({ workplaceId, date, from, to } = {}) {
  const workplace = String(workplaceId || '');
  const day = String(date || '').slice(0, 10);
  const start = normalizeTime(from, '');
  const end = normalizeTime(to, '');
  if (!workplace || !day || !isValidRange(start, end)) return null;

  const item = {
    id: crypto.randomUUID(),
    workplaceId: workplace,
    date: day,
    from: start,
    to: end,
    createdAt: new Date().toISOString(),
  };
  const breaks = getJournalBreaks();
  breaks.push(item);
  writeBreaks(breaks);
  notifyTimeUsageChanged({ action: 'occupy', usageId: item.id, sourceId: item.id, date: item.date, workplaceId: item.workplaceId, from: item.from, to: item.to });
  return item;
}

export function moveJournalBreak(id, { from, to } = {}) {
  const breakId = String(id || '');
  const start = normalizeTime(from, '');
  const end = normalizeTime(to, '');
  if (!breakId || !isValidRange(start, end)) return null;
  const breaks = getJournalBreaks();
  const index = breaks.findIndex((item) => String(item?.id || '') === breakId);
  if (index < 0) return null;
  const previous = breaks[index];
  const updated = { ...previous, from: start, to: end };
  breaks[index] = updated;
  writeBreaks(breaks);
  notifyTimeUsageChanged({ action: 'release', usageId: breakId, sourceId: breakId, date: previous.date, workplaceId: previous.workplaceId, from: previous.from, to: previous.to });
  notifyTimeUsageChanged({ action: 'occupy', usageId: breakId, sourceId: breakId, date: updated.date, workplaceId: updated.workplaceId, from: updated.from, to: updated.to });
  return updated;
}

export function removeJournalBreak(id) {
  const breakId = String(id || '');
  if (!breakId) return false;
  const breaks = getJournalBreaks();
  const index = breaks.findIndex((item) => String(item?.id || '') === breakId);
  if (index < 0) return false;
  const [removed] = breaks.splice(index, 1);
  writeBreaks(breaks);
  notifyTimeUsageChanged({ action: 'release', usageId: breakId, sourceId: breakId, date: removed?.date, workplaceId: removed?.workplaceId, from: removed?.from, to: removed?.to });
  return true;
}

export function removeJournalBreaksForDay(workplaceId, date) {
  const workplace = String(workplaceId || '');
  const day = String(date || '').slice(0, 10);
  if (!workplace || !day) return 0;
  const breaks = getJournalBreaks();
  const removed = breaks.filter((item) => String(item?.workplaceId || '') === workplace && String(item?.date || '').slice(0, 10) === day);
  if (!removed.length) return 0;
  const kept = breaks.filter((item) => !removed.includes(item));
  writeBreaks(kept);
  removed.forEach((item) => notifyTimeUsageChanged({ action: 'release', usageId: item.id, sourceId: item.id, date: item.date, workplaceId: item.workplaceId, from: item.from, to: item.to }));
  return removed.length;
}

export function journalBreakMinutes(item) {
  return minutesBetween(item?.from, item?.to);
}
