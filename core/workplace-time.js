import { resolveTime } from './time.js';

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

// Domain bridge: resolves the effective Time for one WorkingDay.
// A day override, when present, wins over the workplace base time.
// Without an override the day inherits the selected workplace time.
export function resolveWorkingDayTime(workplaces, workingDay) {
  if (!workingDay?.workplaceId) return null;
  const baseTime = resolveWorkplaceTime(workplaces, workingDay.workplaceId);
  if (!baseTime) return null;
  return resolveTime(baseTime, workingDay.timeOverride || null);
}
