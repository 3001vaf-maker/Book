import { initCalendar } from '../ui/ui.js?v=journal-month-worktime-20260903';
import { getWorkingDays, getWorkingDates } from '../core/workplace-time.js?v=journal-worktime-20260903';

export function renderJournalMonth(root, { workplaceId = '' } = {}) {
  const render = (month = new Date(new Date().getFullYear(), new Date().getMonth(), 1)) => {
    root.innerHTML = '<div data-journal-month-calendar></div>';
    const workingDays = getWorkingDays();
    initCalendar(root.querySelector('[data-journal-month-calendar]'), {
      month,
      workingDates: getWorkingDates(workingDays, workplaceId, month),
      renderDateContent: () => '',
      onDateSelect: () => {},
      onMonthChange: (nextMonth) => render(nextMonth),
    });
  };

  render();
}
