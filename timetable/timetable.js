import { pageHeader, initCalendar, initMultiSelect, timeInput } from '../ui/ui.js?v=graph-time-20260903';

const STORAGE_KEY = 'book:timetable-state';

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { workingDates: [], startTime: '10:00', endTime: '20:00' };
    const parsed = JSON.parse(raw);
    return {
      workingDates: Array.isArray(parsed.workingDates) ? parsed.workingDates : [],
      startTime: typeof parsed.startTime === 'string' && parsed.startTime ? parsed.startTime : '10:00',
      endTime: typeof parsed.endTime === 'string' && parsed.endTime ? parsed.endTime : '20:00',
    };
  } catch {
    return { workingDates: [], startTime: '10:00', endTime: '20:00' };
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function renderWorkTimeIndicator(startTime, endTime) {
  return `<span class="calendar__work-time" aria-label="Рабочее время">${startTime}–${endTime}</span>`;
}

export function renderTimetable(root) {
  const savedState = loadState();
  const workingDates = new Set(savedState.workingDates);
  let startTime = savedState.startTime;
  let endTime = savedState.endTime;

  root.innerHTML = `${pageHeader('График')}<div class="work-time-row"><div class="work-time-row__fields"><div class="work-time-row__field">${timeInput({ label: 'Начало', name: 'startTime', value: startTime })}</div><div class="work-time-row__field">${timeInput({ label: 'Окончание', name: 'endTime', value: endTime })}</div></div></div><div data-timetable-calendar></div><div class="profile-actions"><button type="button" class="ui-button" data-timetable-apply disabled>Применить: рабочий день</button></div>`;

  const calendarRoot = root.querySelector('[data-timetable-calendar]');
  const applyButton = root.querySelector('[data-timetable-apply]');
  const startInput = root.querySelector('[name="startTime"]');
  const endInput = root.querySelector('[name="endTime"]');

  let calendar;
  let selection;

  const syncApplyButton = (dates) => {
    const firstDate = dates[0];
    const targetWorking = firstDate ? !workingDates.has(firstDate) : true;
    applyButton.disabled = dates.length === 0;
    applyButton.textContent = `Применить: ${targetWorking ? 'рабочий день' : 'выходной'}`;
  };

  const syncCalendarStatus = () => {
    calendarRoot.querySelectorAll('[data-calendar-date]').forEach((button) => {
      const key = button.dataset.calendarDate || '';
      button.classList.toggle('is-working', workingDates.has(key));
      const indicator = button.querySelector('[data-calendar-work-time]');
      if (workingDates.has(key)) {
        if (!indicator) button.insertAdjacentHTML('beforeend', `<span data-calendar-work-time class="calendar__work-time" aria-hidden="true">${startTime}–${endTime}</span>`);
        else indicator.textContent = `${startTime}–${endTime}`;
      } else if (indicator) {
        indicator.remove();
      }
    });
  };

  const startSelectionSession = (month) => {
    calendar = initCalendar(calendarRoot, {
      month,
      workingDates: [...workingDates],
      renderDateContent: () => '',
      onDateSelect: () => {},
    });

    selection = initMultiSelect(calendarRoot, {
      onChange: syncApplyButton,
    });

    syncCalendarStatus();
  };

  startSelectionSession();

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
    saveState({ workingDates: [...workingDates], startTime, endTime });

    const month = calendar.getDisplayedMonth();
    selection.destroy();
    startSelectionSession(month);
  });

  return {
    get selection() {
      return selection;
    },
  };
}
