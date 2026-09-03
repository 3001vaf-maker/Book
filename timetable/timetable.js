import { pageHeader, initCalendar, initMultiSelect, select } from '../ui/ui.js?v=graph-workplace-20260903';
import { getWorkplaces, resolveWorkingDayTime } from '../core/workplace-time.js?v=working-day-time-20260903';

const STORAGE_KEY = 'book:timetable-state';

function loadState(workplaces) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { workingDays: [] };
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.workingDays)) return { workingDays: parsed.workingDays };
    if (Array.isArray(parsed.workingDates)) {
      const firstWorkplaceId = workplaces[0]?.key || null;
      return { workingDays: parsed.workingDates.map((date) => ({ date, workplaceId: firstWorkplaceId })) };
    }
    return { workingDays: [] };
  } catch {
    return { workingDays: [] };
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function workplaceOptions(workplaces) {
  return workplaces.map((workplace) => ({
    value: workplace.key,
    label: workplace.name || 'Без названия',
  }));
}

function datesForWorkplace(workingDays, workplaceId) {
  return workingDays
    .filter((item) => item?.workplaceId === workplaceId)
    .map((item) => item.date)
    .filter(Boolean);
}

function workingDayForDate(workingDays, workplaceId, date) {
  return workingDays.find((item) => item?.workplaceId === workplaceId && item?.date === date) || null;
}

function monthStats(month, workingDays, workplaceId) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const prefix = `${year}-${String(monthIndex + 1).padStart(2, '0')}-`;
  const days = datesForWorkplace(workingDays, workplaceId).filter((dateKey) => dateKey.startsWith(prefix)).length;
  return { days };
}

function timetableHeaderMeta(stats) {
  return `<div class="page-header__meta-line"><strong>${stats.days}</strong><small>д</small></div>`;
}

export function renderTimetable(root) {
  const workplaces = getWorkplaces();
  const savedState = loadState(workplaces);
  const workingDays = Array.isArray(savedState.workingDays) ? savedState.workingDays : [];
  let selectedWorkplaceId = workplaces[0]?.key || '';

  const initialMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const initialStats = monthStats(initialMonth, workingDays, selectedWorkplaceId);
  const workplaceSelector = select({
    label: 'Место работы',
    name: 'timetableWorkplace',
    value: selectedWorkplaceId,
    options: workplaceOptions(workplaces),
    data: 'data-timetable-workplace',
  });

  root.innerHTML = `<div class="timetable-view">${pageHeader('График', '', timetableHeaderMeta(initialStats))}${workplaceSelector}<div data-timetable-calendar></div><div class="profile-actions"><button type="button" class="ui-button" data-timetable-apply disabled>Применить: рабочий день</button></div></div>`;

  const calendarRoot = root.querySelector('[data-timetable-calendar]');
  const workplaceSelect = root.querySelector('[data-timetable-workplace]');
  const applyButton = root.querySelector('[data-timetable-apply]');

  let calendar;
  let selection;
  let selectionMode = null;

  const renderHeader = (month) => {
    const header = root.querySelector('.page-header');
    if (!header) return;
    const meta = header.querySelector('.page-header__meta');
    if (meta) meta.innerHTML = timetableHeaderMeta(monthStats(month, workingDays, selectedWorkplaceId));
  };

  const isWorkingDate = (dateKey) => datesForWorkplace(workingDays, selectedWorkplaceId).includes(dateKey);

  const syncApplyButton = (dates) => {
    if (!dates.length) {
      selectionMode = null;
      applyButton.disabled = true;
      applyButton.textContent = 'Применить: рабочий день';
      return;
    }

    const firstIsWorking = isWorkingDate(dates[0]);
    selectionMode = firstIsWorking ? 'make-off' : 'make-working';
    applyButton.disabled = false;
    applyButton.textContent = firstIsWorking
      ? 'Применить: выходной'
      : 'Применить: рабочий день';
  };

  const normalizeSelectionByFirstDate = (dates) => {
    if (!dates.length) {
      syncApplyButton([]);
      return;
    }

    syncApplyButton(dates);
  };

  const handleSelectionGuard = (event) => {
    const button = event.target.closest('[data-calendar-date]');
    if (!button || !calendarRoot.contains(button)) return;

    const dateKey = button.dataset.calendarDate || '';
    if (!dateKey || !selection) return;

    const selected = selection.isSelected(dateKey);
    if (selected) return;

    if (!selectionMode) {
      selectionMode = isWorkingDate(dateKey) ? 'make-off' : 'make-working';
      return;
    }

    const dateMode = isWorkingDate(dateKey) ? 'make-off' : 'make-working';
    if (dateMode !== selectionMode) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };

  calendarRoot.addEventListener('click', handleSelectionGuard, true);

  const resetSelectionForCalendarField = () => {
    selectionMode = null;
    selection?.destroy();
    selection = initMultiSelect(calendarRoot, { onChange: normalizeSelectionByFirstDate });
    syncApplyButton([]);
  };

  const startSelectionSession = (month) => {
    calendar = initCalendar(calendarRoot, {
      month,
      workingDates: datesForWorkplace(workingDays, selectedWorkplaceId),
      renderDateContent: ({ dateKey, isCurrentMonth, isWorking }) => {
        if (!isCurrentMonth || !isWorking) return '';
        const workingDay = workingDayForDate(workingDays, selectedWorkplaceId, dateKey);
        const time = resolveWorkingDayTime(workplaces, workingDay);
        if (!time) return '';
        return `<span>${time.from}</span><span>${time.to}</span>`;
      },
      onDateSelect: () => {},
      onMonthChange: (nextMonth) => {
        resetSelectionForCalendarField();
        renderHeader(nextMonth);
      },
    });
    selection = initMultiSelect(calendarRoot, { onChange: normalizeSelectionByFirstDate });
    syncApplyButton([]);
  };

  if (workplaces.length) {
    startSelectionSession(initialMonth);
  } else {
    calendar = initCalendar(calendarRoot, { month: initialMonth, workingDates: [] });
    applyButton.disabled = true;
  }

  workplaceSelect?.addEventListener('change', () => {
    selectedWorkplaceId = workplaceSelect.value || '';
    selection?.destroy();
    const month = calendar.getDisplayedMonth();
    startSelectionSession(month);
    renderHeader(month);
  });

  applyButton.addEventListener('click', () => {
    if (!selection) return;
    const dates = selection.getSelectedDates();
    if (!dates.length || !selectionMode) return;

    const makeWorking = selectionMode === 'make-working';
    const selected = new Set(dates);
    const nextWorkingDays = makeWorking
      ? [...workingDays, ...dates
          .filter((date) => !workingDays.some((item) => item?.date === date && item?.workplaceId === selectedWorkplaceId))
          .map((date) => ({ date, workplaceId: selectedWorkplaceId, timeOverride: null }))]
      : workingDays.filter((item) => !(item?.workplaceId === selectedWorkplaceId && selected.has(item.date)));

    saveState({ workingDays: nextWorkingDays });
    workingDays.splice(0, workingDays.length, ...nextWorkingDays);

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
