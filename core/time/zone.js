const DEFAULT_WORKPLACE_TIME_ZONE = 'Europe/Moscow';

function validTimeZone(value) {
  const timeZone = String(value || '').trim();
  if (!timeZone) return DEFAULT_WORKPLACE_TIME_ZONE;
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date(0));
    return timeZone;
  } catch {
    return DEFAULT_WORKPLACE_TIME_ZONE;
  }
}

export function normalizeWorkplaceTimeZone(value) {
  return validTimeZone(value);
}

export function zonedDateTimeParts(value = new Date(), timeZone = DEFAULT_WORKPLACE_TIME_ZONE) {
  const date = value instanceof Date ? value : new Date(value);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: validTimeZone(timeZone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  const hour = Number(parts.hour || 0);
  const minute = Number(parts.minute || 0);
  const second = Number(parts.second || 0);
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    hour,
    minute,
    second,
    minuteOfDay: hour * 60 + minute,
  };
}
