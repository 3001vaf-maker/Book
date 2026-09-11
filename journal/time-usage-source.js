import { containsRange, isValidRange } from '../core/time.js';
import { getJournalBreaks, getJournalBreaksForDay, removeJournalBreaksForDay } from './break-data.js';
import { getRecordsForDay } from './record-data.js';

function journalUsagesForDay(date, workplaceId) {
  const day = String(date || '').slice(0, 10);
  const workplace = String(workplaceId || '');
  const records = getRecordsForDay(day, workplace)
    .filter((record) => record?.status !== 'cancelled')
    .map((record) => ({
      type: 'record',
      rigidity: 'hard',
      sourceId: String(record?.id || ''),
      from: String(record?.from || ''),
      to: String(record?.to || ''),
    }));
  const breaks = getJournalBreaksForDay(getJournalBreaks(), workplace, day)
    .map((item) => ({
      type: 'break',
      rigidity: 'soft',
      sourceId: String(item?.id || ''),
      from: String(item?.from || ''),
      to: String(item?.to || ''),
    }));
  return [...records, ...breaks];
}

export function getJournalWorkingTimeConflicts({ date, workplaceId, from, to, operation = 'resize' } = {}) {
  const usages = journalUsagesForDay(date, workplaceId);
  if (operation === 'remove') return usages.filter((usage) => usage.rigidity === 'hard');
  if (!isValidRange(from, to)) return [];
  return usages.filter((usage) => isValidRange(usage.from, usage.to) && !containsRange(from, to, usage.from, usage.to));
}

export function releaseJournalSoftWorkingTimeUsages({ date, workplaceId, operation = 'remove' } = {}) {
  if (operation !== 'remove') return 0;
  return removeJournalBreaksForDay(workplaceId, date);
}
