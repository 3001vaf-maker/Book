// Compatibility bridge for the existing timetable UI.
// Day is the canonical owner of concrete working time. This module owns no state.
import { createTimeRange } from './time.js';
import { getDays, saveDays, getDay, getDayTime, createDay, updateDayTime, hasScheduleConflict } from './day.js';

export function createTimeWork({ workplaceId, date, time } = {}) {
  if (!workplaceId || !date || !time) return null;
  const range = createTimeRange(time.from, time.to);
  return { id: `${String(workplaceId)}:${String(date)}`, workplaceId: String(workplaceId), date: String(date), from: range.from, to: range.to, corrections: [] };
}
export function getTimeWorks() {
  try { const value = JSON.parse(localStorage.getItem('book.timeWorks') || '[]'); return Array.isArray(value) ? value : []; } catch { return []; }
}
export function saveTimeWorks() {}
export function getTimeWork(timeWorks, workplaceId, date) {
  const day = getDay(getDays(), workplaceId, date);
  if (day) {
    const time = getDayTime(day, []);
    return time ? { id: `${String(workplaceId)}:${String(date)}`, workplaceId: String(workplaceId), date: String(date), from: time.from, to: time.to, corrections: [] } : null;
  }
  return (Array.isArray(timeWorks) ? timeWorks : []).find((item) => item?.workplaceId === workplaceId && item?.date === date) || null;
}
export function ensureTimeWork(timeWorks, { workplaceId, date, time } = {}) {
  if (!workplaceId || !date || !time?.from || !time?.to) return null;
  const days = getDays();
  let day = getDay(days, workplaceId, date);
  if (!day) {
    if (hasScheduleConflict(days, { workplaceId, date, from: time.from, to: time.to })) return null;
    day = createDay({ workplaceId, date, from: time.from, to: time.to });
    if (!day) return null;
    days.push(day); saveDays(days);
  } else if (!getDayTime(day, [])) {
    if (hasScheduleConflict(days, { workplaceId, date, from: time.from, to: time.to })) return null;
    updateDayTime(days, workplaceId, date, time.from, time.to); saveDays(days);
  }
  const resolved = getDayTime(day, []);
  return resolved ? { id: `${String(workplaceId)}:${String(date)}`, workplaceId: String(workplaceId), date: String(date), from: resolved.from, to: resolved.to, corrections: [] } : null;
}
export function correctTimeWork(timeWork, from, to, source = 'timetable') {
  if (!timeWork) return null;
  const days = getDays(), day = getDay(days, timeWork.workplaceId, timeWork.date);
  if (!day || hasScheduleConflict(days, { workplaceId: timeWork.workplaceId, date: timeWork.date, from, to, excludeWorkplaceId: timeWork.workplaceId, excludeDate: timeWork.date })) return null;
  const updated = updateDayTime(days, timeWork.workplaceId, timeWork.date, from, to);
  if (!updated) return null;
  if (!Array.isArray(updated.corrections)) updated.corrections = [];
  updated.corrections.push({ source, from: updated.from, to: updated.to, at: new Date().toISOString() });
  saveDays(days); timeWork.from = updated.from; timeWork.to = updated.to; return timeWork;
}
export function resolveTimeWork(timeWork, fallbackTime = null) {
  if (!timeWork && !fallbackTime) return null;
  return timeWork ? createTimeRange(timeWork.from, timeWork.to) : createTimeRange(fallbackTime.from, fallbackTime.to);
}
