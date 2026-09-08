import { initCalendar } from '../ui/ui.js?v=schedule-indicators-20260908';
import { getWorkplaces, getWorkingDays, getWorkingDates, getWorkingDayIndicators } from '../core/workplace-time.js?v=schedule-indicators-20260908';

export function renderJournalMonth(root, { workplaceId = '', onDateSelect = () => {} } = {}) {
  const render = (month = new Date(new Date().getFullYear(), new Date().getMonth(), 1)) => {
    root.innerHTML = '<div data-journal-month-calendar></div>';
    const workingDays = getWorkingDays();
    const workplaces = getWorkplaces();
    initCalendar(root.querySelector('[data-journal-month-calendar]'), {
      month,
      workingDates: getWorkingDates(workingDays, workplaceId, month),
      renderDateContent: () => '',
      resolveDateIndicators: ({ dateKey, isCurrentMonth }) => isCurrentMonth
        ? getWorkingDayIndicators(workingDays, workplaces, dateKey, { excludeWorkplaceId: workplaceId })
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
