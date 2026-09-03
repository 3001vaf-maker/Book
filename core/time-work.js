import { createTimeRange, resolveTime } from './time.js';

// TimeWork is the concrete working interval for one workplace on one calendar day.
// Time supplies the base interval; the day supplied by Timetable makes it a TimeWork.
const TIME_WORKS_KEY = 'book.timeWorks';

function timeWorkId(workplaceId, date) {
  return `${String(workplaceId)}:${String(date)}`;
}

export function createTimeWork({ workplaceId, date, time }) {
  if (!workplaceId || !date || !time) return null;
  const range = createTimeRange(time.from, time.to);
  return {
    id: timeWorkId(workplaceId, date),
    workplaceId,
    date,
    from: range.from,
    to: range.to,
    corrections: [],
  };
}

export function getTimeWorks() {
  try {
    const value = JSON.parse(localStorage.getItem(TIME_WORKS_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function saveTimeWorks(timeWorks) {
  localStorage.setItem(TIME_WORKS_KEY, JSON.stringify(Array.isArray(timeWorks) ? timeWorks : []));
}

export function getTimeWork(timeWorks, workplaceId, date) {
  return (Array.isArray(timeWorks) ? timeWorks : []).find(
    (item) => item?.workplaceId === workplaceId && item?.date === date,
  ) || null;
}

// Creates the concrete day from the workplace Time exactly once.
// Existing TimeWork is never overwritten when the base Time changes.
export function ensureTimeWork(timeWorks, { workplaceId, date, time }) {
  const list = Array.isArray(timeWorks) ? timeWorks : [];
  const existing = getTimeWork(list, workplaceId, date);
  if (existing) return existing;
  const created = createTimeWork({ workplaceId, date, time });
  if (!created) return null;
  list.push(created);
  return created;
}

export function correctTimeWork(timeWork, from, to, source = 'timetable') {
  if (!timeWork) return null;
  const next = createTimeRange(from, to);
  timeWork.from = next.from;
  timeWork.to = next.to;
  if (!Array.isArray(timeWork.corrections)) timeWork.corrections = [];
  timeWork.corrections.push({ source, from: next.from, to: next.to, at: new Date().toISOString() });
  return timeWork;
}

export function resolveTimeWork(timeWork, fallbackTime = null) {
  if (!timeWork) return fallbackTime ? resolveTime(fallbackTime) : null;
  return createTimeRange(timeWork.from, timeWork.to);
}
