import { initDateNavigator, journalDayTimeline, initJournalDayTimeline } from '../ui/ui.js';
import { getWorkplaces } from '../core/workplace.js';
import { getDays, getDay, getDayTime } from '../core/day.js';
import { getRecordsForDay } from './record-data.js';
import { getJournalBreaksForDay, getJournalBreaks } from '../core/journal-breaks.js';
import { getTimeUsages } from '../core/time-usage.js';
import { openRecordCreation } from './record.js';
import { openRecordView } from './record-view.js';

function dateKey(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }

export function renderJournalDay(root, { date = new Date(), workplaceId = '', onChange = () => {} } = {}) {
  root.innerHTML = '<div data-journal-day-navigator></div><div data-journal-day-content></div>';
  initDateNavigator(root.querySelector('[data-journal-day-navigator]'), { date, onChange });
  const contentRoot = root.querySelector('[data-journal-day-content]');
  const workplaces = getWorkplaces();
  const workingDay = getDay(getDays(), workplaceId, dateKey(date));
  if (!workingDay) { contentRoot.innerHTML = '<div class="time-day-state" aria-disabled="true">Выходной день</div>'; return; }
  const time = getDayTime(workingDay, workplaces);
  if (!time) { contentRoot.innerHTML = '<div class="time-day-state" aria-disabled="true">Не задано рабочее время</div>'; return; }
  const dayDate = dateKey(date);
  const records = getRecordsForDay(dayDate, workplaceId).filter((record) => record?.status !== 'cancelled');
  const breaks = getJournalBreaksForDay(getJournalBreaks(), workplaceId, dayDate);
  const usages = getTimeUsages({ records, breaks });
  contentRoot.innerHTML = journalDayTimeline({ from: time.from, to: time.to, usages });
  initJournalDayTimeline(contentRoot, {
    usages,
    onSlotClick: ({ from, to, usage }) => {
      if (usage?.type === 'record') {
        const record = records.find((item) => item?.id === usage.sourceId);
        if (record) openRecordView(record, { onClose: () => renderJournalDay(root, { date, workplaceId, onChange }) });
        return;
      }
      if (usage) return;
      openRecordCreation({ date, workplaceId, from, to, onCreated: () => renderJournalDay(root, { date, workplaceId, onChange }) });
    },
  });
}
