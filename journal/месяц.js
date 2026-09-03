import { initCalendar } from '../ui/ui.js?v=journal-month-worktime-20260903';
import { getWorkingDays, getWorkingDates } from '../core/workplace-time.js?v=journal-worktime-20260903';

export function renderJournalMonth(root, { workplaceId = '', onDateSelect = () => {} } = {}) {
  const render = (month = new Date(new Date().getFullYear(), new Date().getMonth(), 1)) => {
    root.innerHTML = '<div data-journal-month-calendar></div>';
    const workingDays = getWorkingDays();
    initCalendar(root.querySelector('[data-journal-month-calendar]'), {
      month,
      workingDates: getWorkingDates(workingDays, workplaceId, month),
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
