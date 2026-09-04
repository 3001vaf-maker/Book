import { createTimeRange } from './time.js';
import { getDays, getDay, getDayTime, getDaysForDate, hasScheduleConflict } from './day.js';

const WORKPLACES_KEY = 'book.workplaces';

export function getWorkplaces() {
  try {
    const value = JSON.parse(localStorage.getItem(WORKPLACES_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function getWorkplace(workplaces, workplaceId) {
  return (Array.isArray(workplaces) ? workplaces : []).find((workplace) => String(workplace?.key || '') === String(workplaceId || '')) || null;
}

export function getWorkingDays() {
  return getDays();
}

export function getWorkingDay(workingDays, workplaceId, date) {
  return getDay(workingDays, workplaceId, date);
}

export function getWorkingDates(workingDays, workplaceId, month) {
  const prefix = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-`;
  return (Array.isArray(workingDays) ? workingDays : [])
    .filter((item) => String(item?.workplaceId || '') === String(workplaceId || '') && item?.date?.startsWith(prefix))
    .map((item) => item.date)
    .filter(Boolean);
}

export function resolveWorkplaceTime(workplaces, workplaceId) {
  const workplace = getWorkplace(workplaces, workplaceId);
  if (!workplace?.from || !workplace?.to) return null;
  return createTimeRange(workplace.from, workplace.to);
}

export function resolveWorkingDayTime(workplaces, workingDay) {
  if (!workingDay?.workplaceId || !workingDay?.date) return null;
  return getDayTime(workingDay, workplaces);
}

export function canScheduleWork(days, { workplaceId, date, from, to, excludeWorkplaceId = '', excludeDate = '' } = {}) {
  return !hasScheduleConflict(days, { workplaceId, date, from, to, excludeWorkplaceId, excludeDate });
}

export function getOtherWorkDays(days, date, workplaceId) {
  return getDaysForDate(days, date).filter((day) => String(day?.workplaceId || '') !== String(workplaceId || ''));
}
