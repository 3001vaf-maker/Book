import { initDateNavigator, journalDayTimeline, initJournalDayTimeline, ALL_WORKPLACES_ID } from '../ui/ui.js';
import { getWorkplaces } from '../core/workplace-time.js';
import { getDays, getDay, getDayTime, getDaysForDate, getScheduleConflicts } from '../core/day/index.js';
import { getTimeUsagesForScope } from '../core/time/index.js';
import { getTimeAvailabilityAt } from '../core/time/index.js';
import { getRecordPaymentState, recordAmountDue } from '../core/finance/index.js';

function dateKey(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function withFinancialState(usages = []) {
  return (Array.isArray(usages) ? usages : []).map((usage) => usage?.type === 'record' ? {
    ...usage,
    paid: Boolean(getRecordPaymentState(usage).fullyPaid),
    financialTotal: recordAmountDue(usage),
  } : usage);
}

async function openExistingRecord(record) {
  const { openRecordView } = await import('./record-view.js');
  openRecordView(record);
}

async function openUsage(usage, rerender = () => {}) {
  if (usage?.type === 'record') {
    await openExistingRecord(usage);
    return;
  }
  if (usage?.type === 'break') {
    const { openBreakView } = await import('./break-view.js');
    openBreakView(usage, { onClose: rerender });
  }
}

export function renderJournalDay(root, {
  date = new Date(),
  workplaceId = '',
  onChange = () => {}
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
    initJournalDayTimeline(contentRoot);
    return;
  }

  const workingDay = getDay(getDays(), workplaceId, dayDate);
  if (!workingDay) { contentRoot.innerHTML = '<div class="time-day-state" aria-disabled="true">Выходной день</div>'; return; }
  const time = getDayTime(workingDay, workplaces);
  if (!time) { contentRoot.innerHTML = '<div class="time-day-state" aria-disabled="true">Не задано рабочее время</div>'; return; }
  const usages = withFinancialState(getTimeUsagesForScope({ date: dayDate, workplaceId }));
  const usageById = new Map(usages.map((usage) => [String(usage?.sourceId || usage?.id || ''), usage]));
  const rerender = () => renderJournalDay(root, { date, workplaceId, onChange });

  contentRoot.innerHTML = journalDayTimeline({ from: time.from, to: time.to, usages });
  initJournalDayTimeline(contentRoot, {
    onUsageClick: ({ usageId }) => { void openUsage(usageById.get(String(usageId || '')), rerender); },
    onSlotClick: async ({ from, to }) => {
      const minuteState = getTimeAvailabilityAt({ date: dayDate, workplaceId, time: from });
      if (minuteState.state === 'occupied' && minuteState.usage) {
        const usage = usageById.get(String(minuteState.usage.sourceId || '')) || minuteState.usage;
        await openUsage(usage, rerender);
        return;
      }
      if (minuteState.state !== 'free') return;
      const { openRecordCreation } = await import('./record.js');
      openRecordCreation({ date, workplaceId, from, to });
    },
  });
}
