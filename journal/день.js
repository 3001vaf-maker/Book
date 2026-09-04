import { initDateNavigator, journalDayTimeline, initJournalDayTimeline } from '../ui/ui.js?v=journal-day-timeline-20260903';
import { getWorkplaces, getWorkingDays, getWorkingDay, resolveWorkingDayTime } from '../core/workplace-time.js?v=day-worktime-20260904';
import { getRecordsForDay } from '../core/record.js';
import { getJournalBreaksForDay, getJournalBreaks } from '../core/journal-breaks.js';
import { getTimeUsages } from '../core/time-usage.js';
import { openRecordCreation, openRecordView } from './record.js';

function dateKey(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }

export function renderJournalDay(root, { date = new Date(), workplaceId = '', onChange = () => {} } = {}) {
  root.innerHTML = '<div data-journal-day-navigator></div><div data-journal-day-content></div>';
  initDateNavigator(root.querySelector('[data-journal-day-navigator]'), { date, onChange });
  const contentRoot = root.querySelector('[data-journal-day-content]');
  const workplaces = getWorkplaces();
  const workingDays = getWorkingDays();
  const workingDay = getWorkingDay(workingDays, workplaceId, dateKey(date));
  if (!workingDay) { contentRoot.innerHTML = '<div class="time-day-state" aria-disabled="true">Выходной день</div>'; return; }

  const time = resolveWorkingDayTime(workplaces, workingDay);
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
