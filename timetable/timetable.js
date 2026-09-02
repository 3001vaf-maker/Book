import { pageHeader, initCalendar, initMultiSelect, timeInput } from '../ui/ui.js';

export function renderTimetable(root) {
  const workingDates = new Set();
  let startTime = '10:00';
  let endTime = '18:00';

  root.innerHTML = `${pageHeader('График')}<div class="work-time-row"><div class="work-time-row__fields"><div class="work-time-row__field">${timeInput({ label: 'Начало', name: 'startTime', value: startTime })}</div><div class="work-time-row__field">${timeInput({ label: 'Окончание', name: 'endTime', value: endTime })}</div></div></div><div data-timetable-calendar></div><div class="profile-actions"><button type="button" class="ui-button" data-timetable-apply disabled>Применить: рабочий день</button></div>`;

  const calendarRoot = root.querySelector('[data-timetable-calendar]');
  const applyButton = root.querySelector('[data-timetable-apply]');
  const startInput = root.querySelector('[name="startTime"]');
  const endInput = root.querySelector('[name="endTime"]');

  root.querySelectorAll('.work-time-row__field .field').forEach((field) => {
    field.style.gridTemplateColumns = '1fr';
    field.style.alignItems = 'stretch';
  });

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
