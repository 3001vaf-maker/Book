// Unified time-resource layer for Journal-owned consumption inside an existing TimeWork.
// TimeWork defines the available working interval; this module determines how Journal consumes it.

function toMinutes(value) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function timeToMinutes(value) {
  return toMinutes(value);
}

export function rangesOverlap(fromA, toA, fromB, toB) {
  const a = toMinutes(fromA);
  const b = toMinutes(toA);
  const c = toMinutes(fromB);
  const d = toMinutes(toB);
  if ([a, b, c, d].some((value) => value == null)) return false;
  return a < d && c < b;
}

export function isTimeRangeAvailable({ from, to, usages = [], excludeId = '' } = {}) {
  return !usages.some((usage) => usage?.id !== excludeId && rangesOverlap(from, to, usage.from, usage.to));
}

export function getTimeUsages({ records = [], breaks = [] } = {}) {
  return [
    ...(Array.isArray(records) ? records : []).map((record) => ({ ...record, type: 'record' })),
    ...(Array.isArray(breaks) ? breaks : []).map((item) => ({ ...item, type: 'break' })),
  ].filter((item) => item?.from && item?.to);
}

export function getUsageAtTime(usages, from) {
  const point = toMinutes(from);
  if (point == null) return null;
  return (Array.isArray(usages) ? usages : []).find((usage) => {
    const start = toMinutes(usage.from);
    const end = toMinutes(usage.to);
    return start != null && end != null && point >= start && point < end;
  }) || null;
}
