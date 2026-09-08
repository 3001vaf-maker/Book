import { createDay, getDay, getDayTime, getDays, getDaysForDate, getScheduleConflicts, saveDays, updateDayTime } from './day.js';
import { isValidRange, minutesToTime, timeToMinutes } from './time.js';
import { getWorkingTimeUsageConflicts } from './time-usage.js';
import { getWorkplaces, resolveWorkplaceTime } from './workplace-time.js';

const WORKPLACE_FALLBACK_COLOR = '#212529';

function dateValue(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  return String(value || '').slice(0, 10);
}

function workplaceMap(workplaces = []) {
  return new Map((Array.isArray(workplaces) ? workplaces : []).map((workplace) => [String(workplace?.key || ''), workplace]));
}

function longestFreeInterval(base, occupied = []) {
  const baseStart = timeToMinutes(base?.from);
  const baseEnd = timeToMinutes(base?.to);
  if (baseStart == null || baseEnd == null || baseEnd <= baseStart) return base || null;

  const ranges = (Array.isArray(occupied) ? occupied : [])
    .map((item) => ({ from: timeToMinutes(item?.from), to: timeToMinutes(item?.to) }))
    .filter((item) => item.from != null && item.to != null && item.to > item.from && item.to > baseStart && item.from < baseEnd)
    .map((item) => ({ from: Math.max(baseStart, item.from), to: Math.min(baseEnd, item.to) }))
    .sort((left, right) => left.from - right.from || left.to - right.to);

  if (!ranges.length) return base;

  const merged = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (!last || range.from > last.to) merged.push({ ...range });
    else last.to = Math.max(last.to, range.to);
  }

  const free = [];
  let cursor = baseStart;
  for (const range of merged) {
    if (range.from > cursor) free.push({ from: cursor, to: range.from });
    cursor = Math.max(cursor, range.to);
  }
  if (cursor < baseEnd) free.push({ from: cursor, to: baseEnd });
  if (!free.length) return base;

  const best = free.reduce((current, item) => !current || item.to - item.from > current.to - current.from ? item : current, null);
  return best ? { from: minutesToTime(best.from), to: minutesToTime(best.to) } : base;
}

export function getActiveDayWorkplaces(date, workplaces = getWorkplaces()) {
  const key = dateValue(date);
  const catalog = workplaceMap(workplaces);
  return getDaysForDate(getDays(), key).map((day) => {
    const workplaceId = String(day?.workplaceId || '');
    const time = getDayTime(day, workplaces);
    if (!workplaceId || !time) return null;
    const workplace = catalog.get(workplaceId) || null;
    return {
      workplaceId,
      name: workplace?.name || 'Рабочее место',
      indicatorColor: workplace?.indicatorColor || workplace?.color || WORKPLACE_FALLBACK_COLOR,
      from: time.from,
      to: time.to,
    };
  }).filter(Boolean);
}

export function getAvailableDayWorkplaces(date, workplaces = getWorkplaces()) {
  const active = new Set(getActiveDayWorkplaces(date, workplaces).map((item) => item.workplaceId));
  return (Array.isArray(workplaces) ? workplaces : []).filter((workplace) => {
    const key = String(workplace?.key || '');
    return key && !active.has(key);
  });
}

export function getDayWorkplaceDraft(date, workplaceId, workplaces = getWorkplaces()) {
  const key = dateValue(date);
  const targetId = String(workplaceId || '');
  const days = getDays();
  const existing = getDay(days, targetId, key);
  const existingTime = getDayTime(existing, workplaces);
  const active = getActiveDayWorkplaces(key, workplaces);
  const occupied = active.filter((item) => item.workplaceId !== targetId);
  const base = existingTime || resolveWorkplaceTime(workplaces, targetId);
  if (!base) return null;
  const proposed = existingTime || longestFreeInterval(base, occupied);
  return {
    workplaceId: targetId,
    date: key,
    existing: Boolean(existing),
    from: proposed.from,
    to: proposed.to,
    occupied,
  };
}

export function saveDayWorkplaceTime({ date, workplaceId, from, to } = {}, workplaces = getWorkplaces()) {
  const key = dateValue(date);
  const targetId = String(workplaceId || '');
  if (!key || !targetId || !isValidRange(from, to)) return { ok: false, reason: 'invalid-time', message: 'Проверьте рабочее время.' };

  const days = getDays();
  const scheduleConflicts = getScheduleConflicts(days, { workplaceId: targetId, date: key, from, to });
  if (scheduleConflicts.length) {
    const catalog = workplaceMap(workplaces);
    const conflict = scheduleConflicts[0];
    const name = catalog.get(String(conflict?.workplaceId || ''))?.name || 'другим рабочим местом';
    return {
      ok: false,
      reason: 'schedule-conflict',
      conflicts: scheduleConflicts,
      message: `Это время пересекается с ${name}: ${conflict?.from || ''}–${conflict?.to || ''}.`,
    };
  }

  const usageConflicts = getWorkingTimeUsageConflicts({ date: key, workplaceId: targetId, from, to });
  if (usageConflicts.length) {
    const conflict = usageConflicts[0];
    return {
      ok: false,
      reason: 'usage-conflict',
      conflicts: usageConflicts,
      message: `Запись ${conflict?.from || ''}–${conflict?.to || ''} выходит за рабочее время.`,
    };
  }

  const existing = getDay(days, targetId, key);
  let saved = null;
  if (existing) saved = updateDayTime(days, targetId, key, from, to);
  else {
    saved = createDay({ date: key, workplaceId: targetId, from, to });
    if (saved) days.push(saved);
  }
  if (!saved) return { ok: false, reason: 'save-failed', message: 'Не удалось сохранить рабочее время.' };
  saveDays(days);
  return { ok: true, day: saved };
}
