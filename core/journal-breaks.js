// Journal Break is a Journal-owned occupied interval for one workplace on one calendar day.
// It never changes WorkTime; it only occupies part of the working interval inside Journal.
const JOURNAL_BREAKS_KEY = 'book.journalBreaks';

function toMinutes(value) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

function formatMinutes(minutes) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function breakId(workplaceId, date, from, to) {
  return `${String(workplaceId)}:${String(date)}:${String(from)}-${String(to)}`;
}

export function getJournalBreaks() {
  try {
    const value = JSON.parse(localStorage.getItem(JOURNAL_BREAKS_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function saveJournalBreaks(breaks) {
  localStorage.setItem(JOURNAL_BREAKS_KEY, JSON.stringify(Array.isArray(breaks) ? breaks : []));
}

export function getJournalBreaksForDay(breaks, workplaceId, date) {
  return (Array.isArray(breaks) ? breaks : [])
    .filter((item) => item?.workplaceId === workplaceId && item?.date === date)
    .sort((a, b) => (toMinutes(a.from) ?? 0) - (toMinutes(b.from) ?? 0));
}

export function addJournalBreak(breaks, { workplaceId, date, from, to } = {}) {
  const start = toMinutes(from);
  const end = toMinutes(to);
  if (!workplaceId || !date || start == null || end == null || end <= start) return null;

  const list = Array.isArray(breaks) ? breaks : [];
  const item = {
    id: breakId(workplaceId, date, formatMinutes(start), formatMinutes(end)),
    workplaceId,
    date,
    from: formatMinutes(start),
    to: formatMinutes(end),
  };
  list.push(item);
  return item;
}

export function removeJournalBreak(breaks, breakIdValue) {
  if (!Array.isArray(breaks) || !breakIdValue) return false;
  const index = breaks.findIndex((item) => item?.id === breakIdValue);
  if (index < 0) return false;
  breaks.splice(index, 1);
  return true;
}

export function journalBreakMinutes(item) {
  const from = toMinutes(item?.from);
  const to = toMinutes(item?.to);
  if (from == null || to == null || to <= from) return 0;
  return to - from;
}
