import { createTimeRange, rangesOverlap, timeToMinutes, minutesToTime, isValidRange } from './time.js';

const TIMETABLE_STATE_KEY = 'book:timetable-state';

function readState() {
  try {
    const value = JSON.parse(localStorage.getItem(TIMETABLE_STATE_KEY) || '{}');
    return value && typeof value === 'object' ? value : {};
  } catch { return {}; }
}
function writeState(state) { localStorage.setItem(TIMETABLE_STATE_KEY, JSON.stringify(state || { workingDays: [] })); }
function dateValue(value) { return String(value || '').slice(0, 10); }

export function getDays() { const state = readState(); return Array.isArray(state.workingDays) ? state.workingDays : []; }
export function saveDays(days) { writeState({ workingDays: Array.isArray(days) ? days : [] }); }
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
  const range = createTimeRange(workplace.from, workplace.to); day.from = range.from; day.to = range.to; return range;
}
export function normalizeDay(day, workplaces = []) { if (!day) return null; const time = getDayTime(day, workplaces); return time ? { ...day, from: time.from, to: time.to } : { ...day }; }
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
  if (!Array.isArray(days)) return false;
  const key = dateValue(date), before = days.length;
  for (let index = days.length - 1; index >= 0; index -= 1) if (String(days[index]?.workplaceId || '') === String(workplaceId || '') && dateValue(days[index]?.date) === key) days.splice(index, 1);
  return days.length !== before;
}
export function hasScheduleConflict(days, { workplaceId, date, from, to, excludeWorkplaceId = '', excludeDate = '' } = {}) {
  if (!isValidRange(from, to)) return true;
  return getDaysForDate(days, date).some((day) => {
    if (String(day?.workplaceId || '') === String(workplaceId || '')) return false;
    if (excludeWorkplaceId && String(day?.workplaceId || '') === String(excludeWorkplaceId) && dateValue(day?.date) === dateValue(excludeDate || date)) return false;
    return day?.from && day?.to && rangesOverlap(from, to, day.from, day.to);
  });
}
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
export function migrateDaysToCanonical(workplaces = []) {
  const days = getDays(); let changed = false;
  for (const day of days) { const beforeFrom = day?.from, beforeTo = day?.to; normalizeDay(day, workplaces); if (day?.from !== beforeFrom || day?.to !== beforeTo) changed = true; }
  if (changed) saveDays(days);
  return days;
}
