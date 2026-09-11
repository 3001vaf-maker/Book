import { getJournalBreaks, getJournalBreaksForDay, removeJournalBreaksForDay } from './break-data.js';
import { getRecordsForDay } from './record-read.js';

export function getJournalTimeUsages({ date, workplaceId } = {}) {
  const day = String(date || '').slice(0, 10);
  const workplace = String(workplaceId || '');
  const records = getRecordsForDay(day, workplace)
    .filter((record) => record?.status !== 'cancelled')
    .map((record) => ({
      ...record,
      type: 'record',
      rigidity: 'hard',
      sourceId: String(record?.id || ''),
      from: String(record?.from || ''),
      to: String(record?.to || ''),
    }));
  const breaks = getJournalBreaksForDay(getJournalBreaks(), workplace, day)
    .map((item) => ({
      ...item,
      type: 'break',
      rigidity: 'soft',
      sourceId: String(item?.id || ''),
      from: String(item?.from || ''),
      to: String(item?.to || ''),
    }));
  return [...records, ...breaks];
}

export function releaseJournalSoftTimeUsages({ date, workplaceId, operation = 'remove' } = {}) {
  if (operation !== 'remove') return 0;
  return removeJournalBreaksForDay(workplaceId, date);
}
