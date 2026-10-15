import { getTimeGridRangeState, minutesToTime, timeToMinutes } from '../time/index.js';

export const PERSON_RECORD_TIME_STEP = 5;

export function buildPersonRecordTimeRows(grid, duration, { step = PERSON_RECORD_TIME_STEP } = {}) {
  const start = timeToMinutes(grid?.plan?.from);
  const end = timeToMinutes(grid?.plan?.to);
  const minutes = Math.max(0, Number(duration) || 0);
  const increment = Math.max(1, Number(step) || PERSON_RECORD_TIME_STEP);
  if (start == null || end == null || end <= start || minutes <= 0) return [];

  const rows = [];
  for (let minute = Math.ceil(start / increment) * increment; minute < end; minute += increment) {
    const from = minutesToTime(minute);
    const to = minutesToTime(minute + minutes);
    if (!from) continue;
    const availability = to
      ? getTimeGridRangeState(grid, { from, to })
      : { ok: false, reason: 'outside-working-time' };
    rows.push({
      value: from,
      label: from,
      available: Boolean(availability.ok),
      occupied: availability.reason === 'occupied',
      disabled: !availability.ok,
      state: availability.ok ? 'free' : availability.reason === 'occupied' ? 'occupied' : 'unavailable',
      emphasized: minute % 30 === 0,
    });
  }
  return rows;
}
