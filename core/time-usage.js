// Neutral occupancy contract between business owners and Core time mechanisms.
// This module does not own WorkPlan, Record, Break, or UI state.
import { containsRange, isValidRange, rangesOverlap, timeToMinutes } from './time.js';

export { timeToMinutes, rangesOverlap };

let timeUsageSource = () => [];
let softTimeUsageReleaseSource = () => 0;

export function configureTimeUsageSource(source) {
  timeUsageSource = typeof source === 'function' ? source : () => [];
}

export function configureSoftTimeUsageReleaseSource(source) {
  softTimeUsageReleaseSource = typeof source === 'function' ? source : () => 0;
}

export function normalizeTimeUsage(usage = {}) {
  const from = String(usage?.from || '');
  const to = String(usage?.to || '');
  if (!isValidRange(from, to)) return null;
  return {
    ...usage,
    type: String(usage?.type || 'usage'),
    rigidity: usage?.rigidity === 'hard' ? 'hard' : 'soft',
    sourceId: String(usage?.sourceId ?? usage?.id ?? ''),
    from,
    to,
  };
}

export function getTimeUsagesForScope(options = {}) {
  const values = timeUsageSource(options);
  return (Array.isArray(values) ? values : []).map(normalizeTimeUsage).filter(Boolean);
}

export function getWorkingTimeUsageConflicts({ operation = 'resize', from, to, ...scope } = {}) {
  const usages = getTimeUsagesForScope(scope);
  if (operation === 'remove') return usages.filter((usage) => usage.rigidity === 'hard');
  if (!isValidRange(from, to)) return [];
  return usages.filter((usage) => !containsRange(from, to, usage.from, usage.to));
}

export function releaseWorkingTimeSoftUsages(options = {}) {
  const released = Number(softTimeUsageReleaseSource(options));
  return Number.isFinite(released) && released > 0 ? released : 0;
}

export function isTimeRangeAvailable({ from, to, usages = [], excludeId = '' } = {}) {
  const excluded = String(excludeId || '');
  return !(Array.isArray(usages) ? usages : []).some((usage) => {
    const normalized = normalizeTimeUsage(usage);
    if (!normalized || (excluded && normalized.sourceId === excluded)) return false;
    return rangesOverlap(from, to, normalized.from, normalized.to);
  });
}

// Transitional generic assembler for callers that already own Record/Break collections.
// No availability decision is made here.
export function getTimeUsages({ records = [], breaks = [] } = {}) {
  return [
    ...(Array.isArray(records) ? records : [])
      .filter((record) => record?.status !== 'cancelled')
      .map((record) => ({ ...record, type: 'record', rigidity: 'hard', sourceId: record.id })),
    ...(Array.isArray(breaks) ? breaks : [])
      .map((item) => ({ ...item, type: 'break', rigidity: 'soft', sourceId: item.id })),
  ].map(normalizeTimeUsage).filter(Boolean);
}

export function notifyTimeUsageChanged(detail = {}) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('book:time-usage-changed', { detail }));
}

export function getUsageAtTime(usages, from) {
  const point = timeToMinutes(from);
  if (point == null) return null;
  return (Array.isArray(usages) ? usages : []).map(normalizeTimeUsage).filter(Boolean).find((usage) => {
    const start = timeToMinutes(usage.from);
    const end = timeToMinutes(usage.to);
    return start != null && end != null && point >= start && point < end;
  }) || null;
}
