// Shared business concept: Time.
// This is domain logic, not a UI component and not a property owned by Timetable.

export function normalizeTime(value, fallback = '00:00') {
  const match = String(value ?? '').match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return fallback;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return fallback;
  }

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function createTimeRange(from = '00:00', to = '00:00') {
  return Object.freeze({
    from: normalizeTime(from),
    to: normalizeTime(to),
  });
}

export function minutesBetween(from, to) {
  const start = normalizeTime(from);
  const end = normalizeTime(to);
  const [startHours, startMinutes] = start.split(':').map(Number);
  const [endHours, endMinutes] = end.split(':').map(Number);
  const startTotal = startHours * 60 + startMinutes;
  const endTotal = endHours * 60 + endMinutes;
  return endTotal >= startTotal ? endTotal - startTotal : 24 * 60 - startTotal + endTotal;
}

export function resolveTime(base, override = null) {
  const source = override || base || {};
  return createTimeRange(source.from, source.to);
}
