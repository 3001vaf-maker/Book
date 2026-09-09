import { createTimeRange, rangesOverlap, timeToMinutes, minutesToTime, isValidRange } from './time.js';
import { getWorkingTimeUsageConflicts } from './time-usage.js';

const TIMETABLE_STATE_KEY = 'book:timetable-state';

function readState() {
  try {
    const value = JSON.parse(localStorage.getItem(TIMETABLE_STATE_KEY) || '{}');
    return value && typeof value === 'object' ? value : {};
  } catch { return {}; }
}
function writeState(state) { localStorage.setItem(TIMETABLE_STATE_KEY, JSON.stringify(state || { workingDays: [] })); }
function dateValue(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  return String(value || '').slice(0, 10);
}
function dayIdentity(day) { return `${String(day?.workplaceId || '')}::${dateValue(day?.date)}`; }

export function getDays() { const state = readState(); return Array.isArray(state.workingDays) ? state.workingDays : []; }
export function getDayRemovalConflicts(workplaceId, date) {
  const key = dateValue(date), targetId = String(workplaceId || '');
  if (!key || !targetId) return [];
  return getWorkingTimeUsageConflicts({ operation: 'remove', date: key, workplaceId: targetId });
}
export function saveDays(days) {
  const requested = Array.isArray(days) ? days : [];
  const current = getDays();
  const requestedIds = new Set(requested.map(dayIdentity));
  const blocked = current
    .filter((day) => !requestedIds.has(dayIdentity(day)))
    .map((day) => ({ day, conflicts: getDayRemovalConflicts(day?.workplaceId, day?.date) }))
    .filter((entry) => entry.conflicts.length > 0);

  const next = [...requested];
  for (const entry of blocked) if (!next.some((day) => dayIdentity(day) === dayIdentity(entry.day))) next.push(entry.day);

  if (Array.isArray(days) && blocked.length) days.splice(0, days.length, ...next);
  writeState({ workingDays: next });
  return blocked.length
    ? { ok: false, reason: 'usage-conflict', blocked }
    : { ok: true, reason: '', blocked: [] };
}
export function getDay(days, workplaceId, date) {
  const key = dateValue(date);
  return (Array.isArray(days) ? days : []).find((item) => String(item?.workplaceId || '') === String(workplaceId || '') && dateValue(item?.date) === key) || null;
}
export function getDaysForDate(days, date) { const key = dateValue(date); return (Array.isArray(days) ? days : []).filter((item) => dateValue(item?.date) === key); }

export function getDayTime(day, workplaces = []) {
  if (!day) return null;
  if (day.from && day.to && isValidRange(day.from, day.to)) return createTimeRange(day.from, day.to);
  const workplace = (Array.isArray(workplaces) ? workplaces : []).find((item) => String(item?.key || '') === String(day.workplaceId || ''));
  if (!workplace?.from || !workplace?.to || !isValidRange(workplace.from, workplace.to)) return null;
  return createTimeRange(workplace.from, workplace.to);
}
export function createDay({ date, workplaceId, from, to } = {}) {
  if (!date || !workplaceId || !isValidRange(from, to)) return null;
  const range = createTimeRange(from, to);
  return { date: dateValue(date), workplaceId: String(workplaceId), from: range.from, to: range.to };
}
export function updateDayTime(days, workplaceId, date, from, to) {
  const list = Array.isArray(days) ? days : [], day = getDay(list, workplaceId, date);
  if (!day || !isValidRange(from, to)) return null;
  const range = createTimeRange(from, to); day.from = range.from; day.to = range.to; return day;
}
export function removeDay(days, workplaceId, date) {
  if (!Array.isArray(days) || getDayRemovalConflicts(workplaceId, date).length) return false;
  const key = dateValue(date), before = days.length;
  for (let index = days.length - 1; index >= 0; index -= 1) if (String(days[index]?.workplaceId || '') === String(workplaceId || '') && dateValue(days[index]?.date) === key) days.splice(index, 1);
  return days.length !== before;
}
export function getScheduleConflicts(days, { workplaceId, date, from, to, excludeWorkplaceId = '', excludeDate = '' } = {}) {
  if (!isValidRange(from, to)) return [];
  return getDaysForDate(days, date).filter((day) => {
    if (String(day?.workplaceId || '') === String(workplaceId || '')) return false;
    if (excludeWorkplaceId && String(day?.workplaceId || '') === String(excludeWorkplaceId) && dateValue(day?.date) === dateValue(excludeDate || date)) return false;
    return day?.from && day?.to && rangesOverlap(from, to, day.from, day.to);
  });
}
export function hasScheduleConflict(days, options = {}) { return getScheduleConflicts(days, options).length > 0; }
export function findSuggestedInterval(days, { workplaceId, date, baseFrom, baseTo } = {}) {
  if (!isValidRange(baseFrom, baseTo)) return null;
  const baseStart = timeToMinutes(baseFrom), baseEnd = timeToMinutes(baseTo), duration = baseEnd - baseStart;
  if (!hasScheduleConflict(days, { workplaceId, date, from: baseFrom, to: baseTo })) return createTimeRange(baseFrom, baseTo);
  const occupied = getDaysForDate(days, date)
    .filter((day) => String(day?.workplaceId || '') !== String(workplaceId || '') && day?.from && day?.to)
    .map((day) => ({ from: timeToMinutes(day.from), to: timeToMinutes(day.to) }))
    .filter((item) => item.from != null && item.to != null && item.to > item.from)
    .sort((a, b) => a.from - b.from);
  let cursor = baseStart;
  for (const item of occupied) {
    const candidateEnd = cursor + duration;
    if (candidateEnd <= item.from && candidateEnd <= baseEnd) return createTimeRange(minutesToTime(cursor), minutesToTime(candidateEnd));
    cursor = Math.max(cursor, item.to);
    if (cursor + duration > baseEnd) break;
  }
  if (cursor + duration <= baseEnd) return createTimeRange(minutesToTime(cursor), minutesToTime(cursor + duration));
  return null;
}
