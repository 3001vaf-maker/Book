import { pageHeader, initCalendar } from '../ui/ui.js';

export function renderTimetable(root) {
  root.innerHTML = `${pageHeader('График')}<div data-timetable-calendar></div>`;
  initCalendar(root.querySelector('[data-timetable-calendar]'), {
    workingDates: [],
    renderDateContent: () => '',
    onDateSelect: () => {},
  });
}
