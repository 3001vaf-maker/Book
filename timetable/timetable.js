import { pageHeader, initCalendar, initMultiSelect } from '../ui/ui.js';

export function renderTimetable(root) {
  const workingDates = new Set();
  let startTime = '10:00';
  let endTime = '18:00';

  root.innerHTML = `${pageHeader('График')}<div class="work-time-row"><div class="work-time-row__fields"><label class="field"><span>Начало</span><input type="time" value="${startTime}" data-timetable-start></label><label class="field"><span>Окончание</span><input type="time" value="${endTime}" data-timetable-end></label></div></div><div data-timetable-calendar></div><div class="profile-actions"><button type="button" class="ui-button" data-timetable-apply disabled>Применить: рабочий день</button></div>`;

  const calendarRoot = root.querySelector('[data-timetable-calendar]');
  const applyButton = root.querySelector('[data-timetable-apply]');
  const startInput = root.querySelector('[data-timetable-start]');
  const endInput = root.querySelector('[data-timetable-end]');

  const selection = initMultiSelect(calendarRoot, {
    onChange: (dates) => {
      const firstDate = dates[0];
      const targetWorking = firstDate ? !workingDates.has(firstDate) : true;
      applyButton.disabled = dates.length === 0;
      applyButton.textContent = `Применить: ${targetWorking ? 'рабочий день' : 'выходной'}`;
    },
  });

  initCalendar(calendarRoot, {
    workingDates: [...workingDates],
    renderDateContent: () => '',
    onDateSelect: () => {},
  });

  const syncCalendarStatus = () => {
    calendarRoot.querySelectorAll('[data-calendar-date]').forEach((button) => {
      const key = button.dataset.calendarDate || '';
      button.classList.toggle('is-working', workingDates.has(key));
    });
  };

  applyButton.addEventListener('click', () => {
    const dates = selection.getSelectedDates();
    if (!dates.length) return;

    const targetWorking = !workingDates.has(dates[0]);
    dates.forEach((dateKey) => {
      if (targetWorking) workingDates.add(dateKey);
      else workingDates.delete(dateKey);
    });

    startTime = startInput.value || startTime;
    endTime = endInput.value || endTime;
    syncCalendarStatus();

    const nextTargetWorking = !workingDates.has(dates[0]);
    applyButton.textContent = `Применить: ${nextTargetWorking ? 'рабочий день' : 'выходной'}`;
  });

  return { selection };
}
