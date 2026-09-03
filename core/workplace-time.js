import { resolveTime } from './time.js';
import { getTimeWork, resolveTimeWork } from './time-work.js';

const WORKPLACES_KEY = 'book.workplaces';
const TIMETABLE_STATE_KEY = 'book:timetable-state';

export function getWorkplaces() {
  try {
    const value = JSON.parse(localStorage.getItem(WORKPLACES_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function getWorkplace(workplaces, workplaceId) {
  return workplaces.find((workplace) => workplace?.key === workplaceId) || null;
}

export function getWorkingDays() {
  try {
    const parsed = JSON.parse(localStorage.getItem(TIMETABLE_STATE_KEY) || '{}');
    return Array.isArray(parsed.workingDays) ? parsed.workingDays : [];
  } catch {
    return [];
  }
}

export function getWorkingDay(workingDays, workplaceId, date) {
  return workingDays.find((item) => item?.workplaceId === workplaceId && item?.date === date) || null;
}

export function getWorkingDates(workingDays, workplaceId, month) {
  const prefix = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-`;
  return workingDays
    .filter((item) => item?.workplaceId === workplaceId && item?.date?.startsWith(prefix))
    .map((item) => item.date)
    .filter(Boolean);
}

export function resolveWorkplaceTime(workplaces, workplaceId) {
  const workplace = getWorkplace(workplaces, workplaceId);
  if (!workplace) return null;
  return resolveTime({ from: workplace.from, to: workplace.to });
}

export function resolveWorkingDayTime(workplaces, workingDay, timeWorks = []) {
  if (!workingDay?.workplaceId || !workingDay?.date) return null;
  const baseTime = resolveWorkplaceTime(workplaces, workingDay.workplaceId);
  if (!baseTime) return null;
  const timeWork = getTimeWork(timeWorks, workingDay.workplaceId, workingDay.date);
  return resolveTimeWork(timeWork, baseTime);
}
