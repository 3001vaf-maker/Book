import { pageHeader, initCalendar, initMultiSelect } from '../ui/ui.js?v=graph-day-domain-20260903';

const STORAGE_KEY = 'book:timetable-state';

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { workingDates: [] };
    const parsed = JSON.parse(raw);
    return {
      workingDates: Array.isArray(parsed.workingDates) ? parsed.workingDates : [],
    };
  } catch {
    return { workingDates: [] };
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function monthStats(month, workingDates) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const prefix = `${year}-${String(monthIndex + 1).padStart(2, '0')}-`;
  return {
    days: [...workingDates].filter((dateKey) => dateKey.startsWith(prefix)).length,
  };
}

function timetableHeaderMeta(stats) {
  return `<div class="page-header__meta-line"><strong>${stats.days}</strong><small>д</small></div>`;
}

export function renderTimetable(root) {
  const savedState = loadState();
  const workingDates = new Set(savedState.workingDates);

  const renderHeader = (month) => {
    const header = root.querySelector('.page-header');
    if (!header) return;
    const meta = header.querySelector('.page-header__meta');
    if (meta) meta.innerHTML = timetableHeaderMeta(monthStats(month, workingDates));
  };

  const initialMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const initialStats = monthStats(initialMonth, workingDates);

  root.innerHTML = `<div class="timetable-view">${pageHeader('График', '', timetableHeaderMeta(initialStats))}<div data-timetable-calendar></div><div class="profile-actions"><button type="button" class="ui-button" data-timetable-apply disabled>Применить: рабочий день</button></div></div>`;

  const calendarRoot = root.querySelector('[data-timetable-calendar]');
  const applyButton = root.querySelector('[data-timetable-apply]');

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
      renderDateContent: () => '',
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

    saveState({ workingDates: [...workingDates] });

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
