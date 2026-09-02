import { initCalendar } from '../ui/ui.js';

export function renderJournalMonth(root) {
  root.innerHTML = '<div data-journal-month-calendar></div>';
  initCalendar(root.querySelector('[data-journal-month-calendar]'), {
    workingDates: [],
    renderDateContent: () => '',
    onDateSelect: () => {},
  });
}
