import { pageHeader, initCalendar, initMultiSelect, select } from '../ui/ui.js?v=graph-workplace-20260903';
import { getWorkplaces, resolveWorkplaceTime } from '../core/workplace-time.js';

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

  const renderHeader = (month) => {
    const header = root.querySelector('.page-header');
    if (!header) return;
    const meta = header.querySelector('.page-header__meta');
    if (meta) meta.innerHTML = timetableHeaderMeta(monthStats(month, workingDays, selectedWorkplaceId));
  };

  const syncApplyButton = (dates) => {
    applyButton.disabled = !selectedWorkplaceId || dates.length === 0;
    applyButton.textContent = `Применить: ${dates.length ? 'рабочий день / выходной' : 'рабочий день'}`;
  };

  const startSelectionSession = (month) => {
    const time = resolveWorkplaceTime(workplaces, selectedWorkplaceId);
    calendar = initCalendar(calendarRoot, {
      month,
      workingDates: datesForWorkplace(workingDays, selectedWorkplaceId),
      renderDateContent: ({ isCurrentMonth, isWorking }) => {
        if (!isCurrentMonth || !isWorking || !time) return '';
        return `<span>${time.from}</span><span>${time.to}</span>`;
      },
      onDateSelect: () => {},
      onMonthChange: renderHeader,
    });
    selection = initMultiSelect(calendarRoot, { onChange: syncApplyButton });
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
    if (!selectedWorkplaceId || !selection) return;
    const dates = selection.getSelectedDates();
    if (!dates.length) return;

    const firstDate = dates[0];
    const wasWorking = workingDays.some((item) => item?.date === firstDate && item?.workplaceId === selectedWorkplaceId);
    const selected = new Set(dates);
    const nextWorkingDays = wasWorking
      ? workingDays.filter((item) => !(item?.workplaceId === selectedWorkplaceId && selected.has(item.date)))
      : [...workingDays, ...dates
          .filter((date) => !workingDays.some((item) => item?.date === date && item?.workplaceId === selectedWorkplaceId))
          .map((date) => ({ date, workplaceId: selectedWorkplaceId }))];

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
