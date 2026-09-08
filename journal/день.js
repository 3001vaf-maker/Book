import { initDateNavigator, journalDayTimeline, initJournalDayTimeline, ALL_WORKPLACES_ID } from '../ui/ui.js?v=journal-all-workplaces-20260908';
import { getWorkplaces } from '../core/workplace-time.js';
import { getDays, getDay, getDayTime, getDaysForDate } from '../core/day.js';
import { rangesOverlap } from '../core/time.js';
import { getRecordsForDay } from './record-data.js';
import { getJournalBreaksForDay, getJournalBreaks } from './break-data.js';
import { getTimeUsages } from '../core/time-usage.js';
import { openRecordCreation } from './record.js?v=journal-architecture-20260908';
import { openRecordView } from './record-view.js?v=journal-architecture-20260908';

function dateKey(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }

export function renderJournalDay(root, { date = new Date(), workplaceId = '', onChange = () => {} } = {}) {
  root.innerHTML = '<div data-journal-day-navigator></div><div data-journal-day-content></div>';
  initDateNavigator(root.querySelector('[data-journal-day-navigator]'), { date, onChange });
  const contentRoot = root.querySelector('[data-journal-day-content]');
  const workplaces = getWorkplaces();
  const dayDate = dateKey(date);
  const allMode = workplaceId === ALL_WORKPLACES_ID;

  if (allMode) {
    const days = getDaysForDate(getDays(), dayDate);
    if (!days.length) { contentRoot.innerHTML = '<div class="time-day-state" aria-disabled="true">Выходной день</div>'; return; }
    const records = getRecordsForDay(dayDate).filter((record) => record?.status !== 'cancelled');
    const breaks = getJournalBreaks();
    const columns = days.map((day) => {
      const currentId = String(day?.workplaceId || '');
      const workplace = workplaces.find((item) => String(item?.key || '') === currentId) || null;
      const time = getDayTime(day, workplaces);
      if (!currentId || !time) return null;
      const columnRecords = records.filter((record) => String(record?.workplaceId || '') === currentId);
      const columnBreaks = getJournalBreaksForDay(breaks, currentId, dayDate);
      return {
        workplaceId: currentId,
        name: workplace?.name || 'Рабочее место',
        from: time.from,
        to: time.to,
        usages: getTimeUsages({ records: columnRecords, breaks: columnBreaks }),
        conflict: false,
      };
    }).filter(Boolean);

    columns.forEach((column, index) => {
      column.conflict = columns.some((other, otherIndex) => otherIndex !== index && rangesOverlap(column.from, column.to, other.from, other.to));
    });
    if (!columns.length) { contentRoot.innerHTML = '<div class="time-day-state" aria-disabled="true">Не задано рабочее время</div>'; return; }

    const usages = columns.flatMap((column) => column.usages);
    contentRoot.innerHTML = journalDayTimeline({ columns });
    initJournalDayTimeline(contentRoot, {
      usages,
      onSlotClick: ({ usage }) => {
        if (usage?.type !== 'record') return;
        const record = records.find((item) => item?.id === usage.sourceId);
        if (record) openRecordView(record, { onClose: () => renderJournalDay(root, { date, workplaceId, onChange }) });
      },
    });
    return;
  }

  const workingDay = getDay(getDays(), workplaceId, dayDate);
  if (!workingDay) { contentRoot.innerHTML = '<div class="time-day-state" aria-disabled="true">Выходной день</div>'; return; }
  const time = getDayTime(workingDay, workplaces);
  if (!time) { contentRoot.innerHTML = '<div class="time-day-state" aria-disabled="true">Не задано рабочее время</div>'; return; }
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
