// Technical interval helpers for Journal rendering and collision checks.
// This module does not own working time or Record state.
import { timeToMinutes, rangesOverlap } from './time.js';

export { timeToMinutes, rangesOverlap };

export function isTimeRangeAvailable({ from, to, usages = [], excludeId = '' } = {}) {
  return !usages.some((usage) => usage?.sourceId !== excludeId && usage?.id !== excludeId && rangesOverlap(from, to, usage?.from, usage?.to));
}

export function getTimeUsages({ records = [], breaks = [] } = {}) {
  return [
    ...(Array.isArray(records) ? records : [])
      .filter((record) => record?.status !== 'cancelled')
      .map((record) => ({ ...record, type: 'record', sourceId: record.id })),
    ...(Array.isArray(breaks) ? breaks : [])
      .map((item) => ({ ...item, type: 'break', sourceId: item.id })),
  ].filter((item) => item?.from && item?.to);
}

export function notifyTimeUsageChanged(detail = {}) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('book:time-usage-changed', { detail }));
}

export function getUsageAtTime(usages, from) {
  const point = timeToMinutes(from);
  if (point == null) return null;
  return (Array.isArray(usages) ? usages : []).find((usage) => {
    const start = timeToMinutes(usage?.from);
    const end = timeToMinutes(usage?.to);
    return start != null && end != null && point >= start && point < end;
  }) || null;
}
