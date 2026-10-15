import { getTimeGridRangeState, minutesToTime, timeToMinutes } from '../time/index.js';

function candidateMinutes(grid) {
  const start = timeToMinutes(grid?.plan?.from);
  const end = timeToMinutes(grid?.plan?.to);
  if (start == null || end == null || end <= start) return [];

  const values = new Set();

  // Until a configurable booking step exists, the neutral baseline is one exact clock hour.
  for (let minute = Math.ceil(start / 60) * 60; minute < end; minute += 60) values.add(minute);

  // A real occupied interval can create an additional natural start when it ends.
  // Example: a record ending at 12:30 exposes 12:30, then the next baseline is 13:00.
  (Array.isArray(grid?.usages) ? grid.usages : []).forEach((usage) => {
    const usageEnd = timeToMinutes(usage?.to);
    if (usageEnd != null && usageEnd > start && usageEnd < end) values.add(usageEnd);
  });

  return [...values].sort((left, right) => left - right);
}

export function buildPersonRecordTimeRows(grid, duration) {
  const minutes = Math.max(0, Number(duration) || 0);
  if (minutes <= 0) return [];

  return candidateMinutes(grid).map((minute) => {
    const from = minutesToTime(minute);
    const to = minutesToTime(minute + minutes);
    const availability = from && to
      ? getTimeGridRangeState(grid, { from, to })
      : { ok: false, reason: 'outside-working-time' };
    return {
      value: from || '',
      label: from || '',
      available: Boolean(availability.ok),
      occupied: availability.reason === 'occupied',
      disabled: !availability.ok,
      state: availability.ok ? 'free' : availability.reason === 'occupied' ? 'occupied' : 'unavailable',
      emphasized: true,
    };
  }).filter((row) => row.value);
}
