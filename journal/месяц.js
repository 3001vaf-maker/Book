import { initCalendar, ALL_WORKPLACES_ID } from '../ui/ui.js';
import { getWorkplaces, getWorkingDays, getWorkingDates, getAllWorkingDates, getWorkingDayIndicators } from '../core/workplace-time.js';

export function renderJournalMonth(root, { workplaceId = '', onDateSelect = () => {} } = {}) {
  const render = (month = new Date(new Date().getFullYear(), new Date().getMonth(), 1)) => {
    root.innerHTML = '<div data-journal-month-calendar></div>';
    const workingDays = getWorkingDays();
    const workplaces = getWorkplaces();
    const allMode = workplaceId === ALL_WORKPLACES_ID;
    initCalendar(root.querySelector('[data-journal-month-calendar]'), {
      month,
      workingDates: allMode ? getAllWorkingDates(workingDays, month) : getWorkingDates(workingDays, workplaceId, month),
      renderDateContent: () => '',
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
