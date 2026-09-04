// Compatibility bridge for the existing timetable UI.
// The Day is the canonical owner of concrete working time. This module no longer owns state.
import { createTimeRange } from './time.js';
import { getDays, saveDays, getDay, getDayTime, createDay, updateDayTime } from './day.js';

export function createTimeWork({ workplaceId, date, time } = {}) {
  if (!workplaceId || !date || !time) return null;
  const range = createTimeRange(time.from, time.to);
  return { id: `${String(workplaceId)}:${String(date)}`, workplaceId: String(workplaceId), date: String(date), from: range.from, to: range.to, corrections: [] };
}

// Legacy reads are retained only so old callers do not fail while the application migrates.
export function getTimeWorks() {
  try {
    const value = JSON.parse(localStorage.getItem('book.timeWorks') || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

// Canonical Day state is authoritative; the legacy TimeWork store is deliberately not written anymore.
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
  if (!workplaceId || !date) return null;
  const days = getDays();
  let day = getDay(days, workplaceId, date);
  if (!day) {
    day = createDay({ workplaceId, date, from: time?.from, to: time?.to });
    if (!day) return null;
    days.push(day);
    saveDays(days);
  } else {
    const dayTime = getDayTime(day, []);
    if (!dayTime && time?.from && time?.to) {
      updateDayTime(days, workplaceId, date, time.from, time.to);
      saveDays(days);
    }
  }
  const resolved = getDayTime(day, []);
  return resolved ? { id: `${String(workplaceId)}:${String(date)}`, workplaceId: String(workplaceId), date: String(date), from: resolved.from, to: resolved.to, corrections: [] } : null;
}

export function correctTimeWork(timeWork, from, to, source = 'timetable') {
  if (!timeWork) return null;
  const days = getDays();
  const day = getDay(days, timeWork.workplaceId, timeWork.date);
  if (!day) return null;
  const updated = updateDayTime(days, timeWork.workplaceId, timeWork.date, from, to);
  if (!updated) return null;
  if (!Array.isArray(updated.corrections)) updated.corrections = [];
  updated.corrections.push({ source, from: updated.from, to: updated.to, at: new Date().toISOString() });
  saveDays(days);
  timeWork.from = updated.from;
  timeWork.to = updated.to;
  return timeWork;
}

export function resolveTimeWork(timeWork, fallbackTime = null) {
  if (!timeWork && !fallbackTime) return null;
  return timeWork ? createTimeRange(timeWork.from, timeWork.to) : createTimeRange(fallbackTime.from, fallbackTime.to);
}
