import { initDateNavigator, journalDayTimeline, initJournalDayTimeline } from '../ui/ui.js?v=journal-day-timeline-20260903';
import { getWorkplaces, getWorkingDays, getWorkingDay, resolveWorkingDayTime } from '../core/workplace-time.js?v=journal-worktime-20260903';
import { getTimeWorks } from '../core/time-work.js?v=journal-worktime-20260903';
import { getRecordsForDay } from '../core/record.js';
import { getJournalBreaksForDay, getJournalBreaks } from '../core/journal-breaks.js';
import { getTimeUsages } from '../core/time-usage.js';
import { openRecordCreation } from './record.js';

function dateKey(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
export function renderJournalDay(root, { date = new Date(), workplaceId = '', onChange = () => {} } = {}) {
  root.innerHTML = '<div data-journal-day-navigator></div><div data-journal-day-content></div>';
  initDateNavigator(root.querySelector('[data-journal-day-navigator]'), { date, onChange });
  const contentRoot = root.querySelector('[data-journal-day-content]'), workplaces = getWorkplaces(), workingDays = getWorkingDays(), workingDay = getWorkingDay(workingDays, workplaceId, dateKey(date));
  if (!workingDay) { contentRoot.innerHTML = '<div class="time-day-state" aria-disabled="true">Выходной день</div>'; return; }
  const time = resolveWorkingDayTime(workplaces, workingDay, getTimeWorks());
  if (!time) { contentRoot.innerHTML = '<div class="time-day-state" aria-disabled="true">Выходной день</div>'; return; }
  const dayDate = dateKey(date);
  const records = getRecordsForDay(dayDate, workplaceId);
  const breaks = getJournalBreaksForDay(getJournalBreaks(), workplaceId, dayDate);
  const usages = getTimeUsages({ records, breaks });
  contentRoot.innerHTML = journalDayTimeline({ from: time.from, to: time.to, records, usages });
  initJournalDayTimeline(contentRoot, { usages, onSlotClick: ({ from, to, usage }) => {
    if (usage) return;
    openRecordCreation({ date, workplaceId, from, to, onCreated: () => renderJournalDay(root, { date, workplaceId, onChange }) });
  } });
}
