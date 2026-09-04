import { createTimeRange } from './time.js';

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

export function getWorkplaceTime(workplaces, workplaceId) {
  const workplace = getWorkplace(workplaces, workplaceId);
  if (!workplace?.from || !workplace?.to) return null;
  return createTimeRange(workplace.from, workplace.to);
}
