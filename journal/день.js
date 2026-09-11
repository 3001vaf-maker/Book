import { initDateNavigator, journalDayTimeline, initJournalDayTimeline, ALL_WORKPLACES_ID } from '../ui/ui.js';
import { getWorkplaces } from '../core/workplace-time.js';
import { getDays, getDay, getDayTime, getDaysForDate, getScheduleConflicts } from '../core/day.js';
import { getTimeUsagesForScope } from '../core/time-usage.js';
import { getTimeAvailabilityAt } from '../core/availability.js';
import { getRecordPaymentState, recordPlanTotal } from '../core/financial-model.js';
import { openRecordCreation } from './record.js';
import { openRecordView } from './record-view.js';
import { openRecordPaymentEntry } from './record-payment.js';
import { openBreakView } from './break-view.js';

function dateKey(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function withFinancialState(usages = []) {
  return (Array.isArray(usages) ? usages : []).map((usage) => usage?.type === 'record' ? {
    ...usage,
    paid: Boolean(getRecordPaymentState(usage).fullyPaid),
    financialTotal: recordPlanTotal(usage),
  } : usage);
}

function openExistingRecord(record) {
  let closePayment = () => {};
  openRecordView(record, { onClose: () => closePayment() });
  closePayment = openRecordPaymentEntry(record);
}

function openUsage(usage, rerender = () => {}) {
  if (usage?.type === 'record') {
    openExistingRecord(usage);
    return;
  }
  if (usage?.type === 'break') openBreakView(usage, { onClose: rerender });
}

export function renderJournalDay(root, {
  date = new Date(),
  workplaceId = '',
  onChange = () => {},
  onWorkplaceFieldClick = () => {},
} = {}) {
  root.innerHTML = '<div data-journal-day-navigator></div><div data-journal-day-content></div>';
  initDateNavigator(root.querySelector('[data-journal-day-navigator]'), { date, onChange });
  const contentRoot = root.querySelector('[data-journal-day-content]');
  const workplaces = getWorkplaces();
  const dayDate = dateKey(date);
  const allMode = workplaceId === ALL_WORKPLACES_ID;

  if (allMode) {
    const days = getDaysForDate(getDays(), dayDate);
    if (!days.length) { contentRoot.innerHTML = '<div class="time-day-state" aria-disabled="true">Выходной день</div>'; return; }
    const columns = days.map((day) => {
      const currentId = String(day?.workplaceId || '');
      const workplace = workplaces.find((item) => String(item?.key || '') === currentId) || null;
      const time = getDayTime(day, workplaces);
      if (!currentId || !time) return null;
      return {
        workplaceId: currentId,
        name: workplace?.name || 'Рабочее место',
        from: time.from,
        to: time.to,
        usages: withFinancialState(getTimeUsagesForScope({ date: dayDate, workplaceId: currentId })),
        conflict: getScheduleConflicts(days, {
          workplaceId: currentId,
          date: dayDate,
          from: time.from,
          to: time.to,
        }).length > 0,
      };
    }).filter(Boolean);

    if (!columns.length) { contentRoot.innerHTML = '<div class="time-day-state" aria-disabled="true">Не задано рабочее время</div>'; return; }

    contentRoot.innerHTML = journalDayTimeline({ columns });
    initJournalDayTimeline(contentRoot, {
      onWorkFieldClick: ({ workplaceId: nextWorkplaceId }) => {
        if (nextWorkplaceId) onWorkplaceFieldClick(nextWorkplaceId);
      },
    });
    return;
  }

  const workingDay = getDay(getDays(), workplaceId, dayDate);
  if (!workingDay) { contentRoot.innerHTML = '<div class="time-day-state" aria-disabled="true">Выходной день</div>'; return; }
  const time = getDayTime(workingDay, workplaces);
  if (!time) { contentRoot.innerHTML = '<div class="time-day-state" aria-disabled="true">Не задано рабочее время</div>'; return; }
  const usages = withFinancialState(getTimeUsagesForScope({ date: dayDate, workplaceId }));
  const usageById = new Map(usages.map((usage) => [String(usage?.sourceId || usage?.id || ''), usage]));
  const rerender = () => renderJournalDay(root, { date, workplaceId, onChange, onWorkplaceFieldClick });

  contentRoot.innerHTML = journalDayTimeline({ from: time.from, to: time.to, usages });
  initJournalDayTimeline(contentRoot, {
    onUsageClick: ({ usageId }) => openUsage(usageById.get(String(usageId || '')), rerender),
    onSlotClick: ({ from, to }) => {
      const minuteState = getTimeAvailabilityAt({ date: dayDate, workplaceId, time: from });
      if (minuteState.state === 'occupied' && minuteState.usage) {
        const usage = usageById.get(String(minuteState.usage.sourceId || '')) || minuteState.usage;
        openUsage(usage, rerender);
        return;
      }
      if (minuteState.state !== 'free') return;
      openRecordCreation({ date, workplaceId, from, to });
    },
  });
}
