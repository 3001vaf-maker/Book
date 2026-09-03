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

// Domain bridge: resolves the Time belonging to the selected workplace for use by another domain.
export function resolveWorkplaceTime(workplaces, workplaceId) {
  const workplace = getWorkplace(workplaces, workplaceId);
  if (!workplace) return null;
  return resolveTime(workplace.from, workplace.to);
}
