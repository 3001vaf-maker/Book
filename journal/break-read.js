import { minutesBetween, timeToMinutes } from '../core/time.js';
import { getBreakRows } from './break-data.js';

export function getJournalBreaks() {
  return getBreakRows();
}

export function getJournalBreaksForDay(breaks = getJournalBreaks(), workplaceId, date) {
  const workplace = String(workplaceId || '');
  const day = String(date || '').slice(0, 10);
  return (Array.isArray(breaks) ? breaks : [])
    .filter((item) => String(item?.workplaceId || '') === workplace
      && String(item?.date || '').slice(0, 10) === day)
    .sort((left, right) => (timeToMinutes(left?.from) ?? 0) - (timeToMinutes(right?.from) ?? 0));
}

export function journalBreakMinutes(item) {
  return minutesBetween(item?.from, item?.to);
}
