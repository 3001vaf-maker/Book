import { resolveTime } from './time.js';
import { getTimeWork, resolveTimeWork } from './time-work.js';

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
  return workplaces.find((workplace) => workplace?.key === workplaceId) || null;
}

// Domain bridge: resolves the base Time belonging to a workplace.
export function resolveWorkplaceTime(workplaces, workplaceId) {
  const workplace = getWorkplace(workplaces, workplaceId);
  if (!workplace) return null;
  return resolveTime({ from: workplace.from, to: workplace.to });
}

// Domain bridge: resolves the concrete TimeWork for one WorkingDay.
// Time remains the workplace-level source; TimeWork owns the day-specific interval.
export function resolveWorkingDayTime(workplaces, workingDay, timeWorks = []) {
  if (!workingDay?.workplaceId || !workingDay?.date) return null;
  const baseTime = resolveWorkplaceTime(workplaces, workingDay.workplaceId);
  if (!baseTime) return null;
  const timeWork = getTimeWork(timeWorks, workingDay.workplaceId, workingDay.date);
  return resolveTimeWork(timeWork, baseTime);
}
