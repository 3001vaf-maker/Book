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

function minutesBetween(startTime, endTime) {
  const [startHours, startMinutes] = startTime.split(':').map(Number);
  const [endHours, endMinutes] = endTime.split(':').map(Number);
  if (![startHours, startMinutes, endHours, endMinutes].every(Number.isFinite)) return 0;
  const start = startHours * 60 + startMinutes;
  const end = endHours * 60 + endMinutes;
  return end >= start ? end - start : (24 * 60 - start) + end;
}

function monthStats(month, workingDates, startTime, endTime) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const prefix = `${year}-${String(monthIndex + 1).padStart(2, '0')}-`;
  const days = [...workingDates].filter((dateKey) => dateKey.startsWith(prefix)).length;
  const totalMinutes = days * minutesBetween(startTime, endTime);
  return { days, hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
}

function timetableHeaderMeta(stats) {
  return `<div class="page-header__meta-line"><strong>${stats.days}</strong><small>д</small></div><div class="page-header__meta-line"><strong>${stats.hours}</strong><small>ч</small><strong>${stats.minutes}</strong><small>м</small></div>`;
}

export function renderTimetable(root) {
  const savedState = loadState();
  const workingDates = new Set(savedState.workingDates);
  let startTime = savedState.startTime;
  let endTime = savedState.endTime;
  let displayedMonth;

  const renderHeader = (month) => {
    displayedMonth = month;
    const header = root.querySelector('.page-header');
    if (!header) return;
    const stats = monthStats(month, workingDates, startTime, endTime);
    const meta = header.querySelector('.page-header__meta');
    if (meta) meta.innerHTML = timetableHeaderMeta(stats);
  };

  const initialMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const initialStats = monthStats(initialMonth, workingDates, startTime, endTime);

  root.innerHTML = `<div class="timetable-view">${pageHeader('График', '', timetableHeaderMeta(initialStats))}<div data-timetable-calendar></div><div class="cost-range paired-fields">${timeInput({ label: 'Начало', name: 'startTime', value: startTime })}${timeInput({ label: 'Окончание', name: 'endTime', value: endTime })}</div><div class="profile-actions"><button type="button" class="ui-button" data-timetable-apply disabled>Применить: рабочий день</button></div></div>`;

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

  const startSelectionSession = (month) => {
    calendar = initCalendar(calendarRoot, {
      month,
      workingDates: [...workingDates],
      renderDateContent: ({ isCurrentMonth, isWorking }) => {
        if (!isCurrentMonth || !isWorking) return '';
        return `<span>${startTime}</span><span>${endTime}</span>`;
      },
      onDateSelect: () => {},
      onMonthChange: renderHeader,
    });

    selection = initMultiSelect(calendarRoot, {
      onChange: syncApplyButton,
    });
  };

  startSelectionSession(initialMonth);

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
    renderHeader(month);
  });

  return {
    get selection() {
      return selection;
    },
  };
}
