import { initCalendar } from '../ui/ui.js?v=journal-month-worktime-20260903';
import { getDays } from '../core/day.js';

export function renderJournalMonth(root, { workplaceId = '', onDateSelect = () => {} } = {}) {
  const render = (month = new Date(new Date().getFullYear(), new Date().getMonth(), 1)) => {
    root.innerHTML = '<div data-journal-month-calendar></div>';
    const workingDays = getDays();
    const prefix = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-`;
    const workingDates = workingDays
      .filter((item) => String(item?.workplaceId || '') === String(workplaceId || '') && item?.date?.startsWith(prefix))
      .map((item) => item.date)
      .filter(Boolean);
    initCalendar(root.querySelector('[data-journal-month-calendar]'), {
      month,
      workingDates,
      renderDateContent: () => '',
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
