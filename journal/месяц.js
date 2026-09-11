import { initCalendar, ALL_WORKPLACES_ID } from '../ui/ui.js';
import { getRecordPaymentState } from '../core/finance/index.js';
import { minutesBetween } from '../core/time/index.js';
import { getWorkplaces, getWorkingDays, getWorkingDates, getAllWorkingDates, getWorkingDayIndicators, getWorkingDay, getWorkingDayTotalMinutes, resolveWorkingDayTime } from '../core/workplace-time.js';
import { getRecordsForDay } from '../core/record/index.js';
import { recordVisualState } from '../core/record/index.js';

const RECORD_COLOR = '#EFFFBB';
const PAID_COLOR = '#DDE8D7';
const NO_SHOW_COLOR = '#F1DADA';

function recordMinutes(record) {
  return Math.max(0, minutesBetween(String(record?.from || ''), String(record?.to || '')) || 0);
}

function dayCapacityMinutes(workingDays, workplaces, workplaceId, dateKey, allMode) {
  if (allMode) return Math.max(0, getWorkingDayTotalMinutes(workingDays, workplaces, dateKey));
  const workingDay = getWorkingDay(workingDays, workplaceId, dateKey);
  const time = resolveWorkingDayTime(workplaces, workingDay);
  return time ? Math.max(0, minutesBetween(time.from, time.to)) : 0;
}

function dayRecordData({ dateKey, workplaceId, allMode, workingDays, workplaces }) {
  const records = getRecordsForDay(dateKey, allMode ? '' : workplaceId)
    .filter((record) => record?.status !== 'cancelled');
  const capacity = dayCapacityMinutes(workingDays, workplaces, workplaceId, dateKey, allMode);
  const minutes = { paid: 0, active: 0, noShow: 0 };

  records.forEach((record) => {
    const duration = recordMinutes(record);
    const paid = Boolean(getRecordPaymentState(record).fullyPaid);
    const state = recordVisualState(record, { paid });
    if (state === 'paid') minutes.paid += duration;
    else if (state === 'no-show') minutes.noShow += duration;
    else minutes.active += duration;
  });

  return { count: records.length, capacity, minutes };
}

function usageGradient({ capacity, minutes }) {
  if (!(capacity > 0)) return '';
  const values = [
    { color: PAID_COLOR, minutes: minutes.paid },
    { color: RECORD_COLOR, minutes: minutes.active },
    { color: NO_SHOW_COLOR, minutes: minutes.noShow },
  ];
  let cursor = 0;
  const stops = [];

  values.forEach((item) => {
    if (!(item.minutes > 0) || cursor >= 100) return;
    const width = Math.min(100 - cursor, (item.minutes / capacity) * 100);
    const end = cursor + width;
    stops.push(`${item.color} ${cursor.toFixed(2)}%`, `${item.color} ${end.toFixed(2)}%`);
    cursor = end;
  });

  if (!stops.length) return '';
  stops.push(`transparent ${cursor.toFixed(2)}%`, 'transparent 100%');
  return `linear-gradient(90deg,${stops.join(',')})`;
}

function dateContent(data) {
  const gradient = usageGradient(data);
  const fill = gradient ? `<span class="calendar__date-fill" style="--calendar-date-fill:${gradient}" aria-hidden="true"></span>` : '';
  const count = data.count ? `<span class="calendar__date-count">${data.count} зап.</span>` : '';
  return `${fill}${count}`;
}

export function renderJournalMonth(root, { workplaceId = '', onDateSelect = () => {} } = {}) {
  const render = (month = new Date(new Date().getFullYear(), new Date().getMonth(), 1)) => {
    root.innerHTML = '<div data-journal-month-calendar></div>';
    const workingDays = getWorkingDays();
    const workplaces = getWorkplaces();
    const allMode = workplaceId === ALL_WORKPLACES_ID;
    initCalendar(root.querySelector('[data-journal-month-calendar]'), {
      month,
      workingDates: allMode ? getAllWorkingDates(workingDays, month) : getWorkingDates(workingDays, workplaceId, month),
      renderDateContent: ({ dateKey, isCurrentMonth }) => {
        if (!isCurrentMonth) return '';
        return dateContent(dayRecordData({ dateKey, workplaceId, allMode, workingDays, workplaces }));
      },
      resolveDateIndicators: ({ dateKey, isCurrentMonth }) => isCurrentMonth
        ? getWorkingDayIndicators(workingDays, workplaces, dateKey, { excludeWorkplaceId: allMode ? '' : workplaceId })
        : [],
      onDateSelect: (dateKey) => {
        const [year, monthNumber, day] = String(dateKey).split('-').map(Number);
        if (!year || !monthNumber || !day) return;
        onDateSelect(new Date(year, monthNumber - 1, day));
      },
      onMonthChange: (nextMonth) => render(nextMonth),
    });
  };

  render();
}
