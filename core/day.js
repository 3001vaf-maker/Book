import { createTimeRange, rangesOverlap } from './time.js';

const TIMETABLE_STATE_KEY = 'book:timetable-state';
const LEGACY_TIME_WORKS_KEY = 'book.timeWorks';

function readState() {
  try {
    const value = JSON.parse(localStorage.getItem(TIMETABLE_STATE_KEY) || '{}');
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

function writeState(state) {
  localStorage.setItem(TIMETABLE_STATE_KEY, JSON.stringify(state || { workingDays: [] }));
}

function readLegacyTimeWorks() {
  try {
    const value = JSON.parse(localStorage.getItem(LEGACY_TIME_WORKS_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function dateValue(value) {
  return String(value || '').slice(0, 10);
}

export function getDays() {
  const state = readState();
  return Array.isArray(state.workingDays) ? state.workingDays : [];
}

export function saveDays(days) {
  writeState({ workingDays: Array.isArray(days) ? days : [] });
}

export function getDay(days, workplaceId, date) {
  const key = dateValue(date);
  return (Array.isArray(days) ? days : []).find(
    (item) => String(item?.workplaceId || '') === String(workplaceId || '') && dateValue(item?.date) === key,
  ) || null;
}

export function getDaysForDate(days, date) {
  const key = dateValue(date);
  return (Array.isArray(days) ? days : []).filter((item) => dateValue(item?.date) === key);
}

export function getDayTime(day, workplaces = []) {
  if (!day) return null;

  // New canonical representation: the Day owns its concrete working interval.
  if (day.from && day.to) return createTimeRange(day.from, day.to);

  // One-time migration path for the existing TimeWork storage.
  const legacy = readLegacyTimeWorks().find(
    (item) => String(item?.workplaceId || '') === String(day.workplaceId || '') && dateValue(item?.date) === dateValue(day.date),
  );
  if (legacy?.from && legacy?.to) {
    const range = createTimeRange(legacy.from, legacy.to);
    day.from = range.from;
    day.to = range.to;
    return range;
  }

  const workplace = (Array.isArray(workplaces) ? workplaces : []).find(
    (item) => String(item?.key || '') === String(day.workplaceId || ''),
  );
  if (!workplace?.from || !workplace?.to) return null;
  const range = createTimeRange(workplace.from, workplace.to);
  day.from = range.from;
  day.to = range.to;
  return range;
}

export function normalizeDay(day, workplaces = []) {
  if (!day) return null;
  const time = getDayTime(day, workplaces);
  if (!time) return { ...day };
  return { ...day, from: time.from, to: time.to };
}

export function createDay({ date, workplaceId, from, to } = {}) {
  if (!date || !workplaceId) return null;
  const range = createTimeRange(from, to);
  if (range.to <= range.from) return null;
  return {
    date: dateValue(date),
    workplaceId: String(workplaceId),
    from: range.from,
    to: range.to,
  };
}

export function updateDayTime(days, workplaceId, date, from, to) {
  const list = Array.isArray(days) ? days : [];
  const day = getDay(list, workplaceId, date);
  if (!day) return null;
  const range = createTimeRange(from, to);
  if (range.to <= range.from) return null;
  day.from = range.from;
  day.to = range.to;
  return day;
}

export function removeDay(days, workplaceId, date) {
  if (!Array.isArray(days)) return false;
  const key = dateValue(date);
  const before = days.length;
  for (let index = days.length - 1; index >= 0; index -= 1) {
    if (String(days[index]?.workplaceId || '') === String(workplaceId || '') && dateValue(days[index]?.date) === key) days.splice(index, 1);
  }
  return days.length !== before;
}

export function hasScheduleConflict(days, { workplaceId, date, from, to, excludeWorkplaceId = '', excludeDate = '' } = {}) {
  const range = createTimeRange(from, to);
  if (range.to <= range.from) return true;
  return getDaysForDate(days, date).some((day) => {
    if (String(day?.workplaceId || '') === String(workplaceId || '')) return false;
    if (excludeWorkplaceId && String(day?.workplaceId || '') === String(excludeWorkplaceId) && dateValue(day?.date) === dateValue(excludeDate || date)) return false;
    const dayTime = day?.from && day?.to ? createTimeRange(day.from, day.to) : null;
    return dayTime ? rangesOverlap(range.from, range.to, dayTime.from, dayTime.to) : false;
  });
}

export function findSuggestedInterval(days, { workplaceId, date, baseFrom, baseTo } = {}) {
  const base = createTimeRange(baseFrom, baseTo);
  if (base.to <= base.from) return null;
  if (!hasScheduleConflict(days, { workplaceId, date, from: base.from, to: base.to })) return base;

  const occupied = getDaysForDate(days, date)
    .filter((day) => String(day?.workplaceId || '') !== String(workplaceId || '') && day?.from && day?.to)
    .map((day) => createTimeRange(day.from, day.to))
    .sort((a, b) => a.from.localeCompare(b.from));

  let cursor = Number(base.from.slice(0, 2)) * 60 + Number(base.from.slice(3));
  const limit = Number(base.to.slice(0, 2)) * 60 + Number(base.to.slice(3));
  for (const item of occupied) {
    const start = Number(item.from.slice(0, 2)) * 60 + Number(item.from.slice(3));
    const end = Number(item.to.slice(0, 2)) * 60 + Number(item.to.slice(3));
    if (cursor < start && cursor + (limit - Number(base.from.slice(0, 2)) * 60 - Number(base.from.slice(3))) <= start) {
      return createTimeRange(`${String(Math.floor(cursor / 60)).padStart(2, '0')}:${String(cursor % 60).padStart(2, '0')}`, item.from);
    }
    cursor = Math.max(cursor, end);
  }
  if (cursor < limit) return createTimeRange(`${String(Math.floor(cursor / 60)).padStart(2, '0')}:${String(cursor % 60).padStart(2, '0')}`, base.to);
  return null;
}

export function migrateDaysToCanonical(workplaces = []) {
  const days = getDays();
  let changed = false;
  for (const day of days) {
    const beforeFrom = day?.from;
    const beforeTo = day?.to;
    normalizeDay(day, workplaces);
    if (day?.from !== beforeFrom || day?.to !== beforeTo) changed = true;
  }
  if (changed) saveDays(days);
  return days;
}
