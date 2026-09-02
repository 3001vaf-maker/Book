import { pageHeader, initCalendar, initMultiSelect } from '../ui/ui.js';

export function renderTimetable(root) {
  root.innerHTML = `${pageHeader('График')}<div class="timetable-selection" data-timetable-selection><span data-timetable-selection-count>Выбрано: 0</span></div><div data-timetable-calendar></div>`;

  const calendarRoot = root.querySelector('[data-timetable-calendar]');
  const count = root.querySelector('[data-timetable-selection-count]');

  const selection = initMultiSelect(calendarRoot, {
    onChange: (dates) => {
      count.textContent = `Выбрано: ${dates.length}`;
    },
  });

  initCalendar(calendarRoot, {
    workingDates: [],
    renderDateContent: () => '',
    onDateSelect: () => {},
  });

  return { selection };
}
