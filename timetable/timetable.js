import { pageHeader, initCalendar, initMultiSelect, select, modal, mountModal, timePicker, initTimePickers, escapeHtml } from '../ui/ui.js?v=graph-workplace-header-20260903';
import { getWorkplaces, resolveWorkplaceTime, resolveWorkingDayTime } from '../core/workplace-time.js?v=timework-core-20260903';
import { getTimeWorks, saveTimeWorks, ensureTimeWork, correctTimeWork } from '../core/time-work.js?v=timework-core-20260903';

const STORAGE_KEY = 'book:timetable-state';

function loadState(workplaces) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { workingDays: [] };
    const parsed = JSON.parse(raw);
    const firstWorkplaceId = workplaces[0]?.key || null;
    const workingDays = Array.isArray(parsed.workingDays)
      ? parsed.workingDays
      : Array.isArray(parsed.workingDates)
        ? parsed.workingDates.map((date) => ({ date, workplaceId: firstWorkplaceId }))
        : [];
    return { workingDays };
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

function monthStats(month, workingDays, workplaceId, workplaces, timeWorks) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const prefix = `${year}-${String(monthIndex + 1).padStart(2, '0')}-`;
  const days = datesForWorkplace(workingDays, workplaceId).filter((dateKey) => dateKey.startsWith(prefix));
  const minutes = days.reduce((total, dateKey) => {
    const workingDay = workingDayForDate(workingDays, workplaceId, dateKey);
    const time = resolveWorkingDayTime(workplaces, workingDay, timeWorks);
    if (!time) return total;
    const [fromHour, fromMinute] = time.from.split(':').map(Number);
    const [toHour, toMinute] = time.to.split(':').map(Number);
    return total + Math.max(0, (toHour * 60 + toMinute) - (fromHour * 60 + fromMinute));
  }, 0);

  return { days: days.length, hours: Math.floor(minutes / 60), minutes: minutes % 60 };
}

function timetableCounter(stats) {
  return `<span class="timetable-workplace__days">${stats.days} дней</span><span class="timetable-workplace__time">${stats.hours} ч ${String(stats.minutes).padStart(2, '0')} м</span>`;
}

function workplaceHeaderButton(workplace, stats) {
  const name = workplace?.name || 'Место работы';
  const safeName = escapeHtml(name);
  return `<button type="button" class="timetable-workplace-button ui-button--secondary" data-timetable-workplace-open aria-label="Место работы: ${safeName}"><span class="timetable-workplace-button__name">${safeName}</span>${timetableCounter(stats)}<span class="timetable-workplace-button__arrow" aria-hidden="true">⌄</span></button>`;
}

export function renderTimetable(root) {
  const workplaces = getWorkplaces();
  const savedState = loadState(workplaces);
  const workingDays = Array.isArray(savedState.workingDays) ? savedState.workingDays : [];
  const timeWorks = getTimeWorks();

  // Migrate the previous date-level override representation into the Core TimeWork entity.
  let migrated = false;
  for (const workingDay of workingDays) {
    const baseTime = resolveWorkplaceTime(workplaces, workingDay?.workplaceId);
    if (!baseTime) continue;
    const timeWork = ensureTimeWork(timeWorks, {
      workplaceId: workingDay.workplaceId,
      date: workingDay.date,
      time: baseTime,
    });
    if (workingDay?.timeOverride && timeWork) {
      correctTimeWork(timeWork, workingDay.timeOverride.from, workingDay.timeOverride.to, 'timetable');
      delete workingDay.timeOverride;
      migrated = true;
    }
  }
  if (migrated || timeWorks.length) saveTimeWorks(timeWorks);
  if (migrated) saveState({ workingDays });

  let selectedWorkplaceId = workplaces[0]?.key || '';

  const initialMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const initialStats = monthStats(initialMonth, workingDays, selectedWorkplaceId, workplaces, timeWorks);
  const selectedWorkplace = workplaces.find((workplace) => workplace.key === selectedWorkplaceId) || null;
  const headerControl = workplaceHeaderButton(selectedWorkplace, initialStats);

  root.innerHTML = `<div class="timetable-view">${pageHeader('График', '', headerControl)}<div data-timetable-calendar></div><div class="profile-actions"><button type="button" class="ui-button" data-timetable-apply disabled><span data-timetable-apply-label>Применить: рабочий день</span></button></div></div>`;

  const calendarRoot = root.querySelector('[data-timetable-calendar]');
  const workplaceOpen = root.querySelector('[data-timetable-workplace-open]');
  const applyButton = root.querySelector('[data-timetable-apply]');
  const applyLabel = root.querySelector('[data-timetable-apply-label]');

  let calendar;
  let selection;
  let selectionMode = null;

  const renderHeader = (month) => {
    const header = root.querySelector('.page-header');
    if (!header) return;
    const meta = header.querySelector('.page-header__meta');
    if (!meta) return;
    const workplace = workplaces.find((item) => item.key === selectedWorkplaceId) || null;
    meta.innerHTML = workplaceHeaderButton(workplace, monthStats(month, workingDays, selectedWorkplaceId, workplaces, timeWorks));
    meta.querySelector('[data-timetable-workplace-open]')?.addEventListener('click', openWorkplaceModal);
  };

  const isWorkingDate = (dateKey) => datesForWorkplace(workingDays, selectedWorkplaceId).includes(dateKey);

  const syncApplyButton = (dates) => {
    if (!dates.length) {
      selectionMode = null;
      applyButton.disabled = true;
      if (applyLabel) applyLabel.textContent = 'Применить: рабочий день';
      return;
    }
    const firstIsWorking = isWorkingDate(dates[0]);
    selectionMode = firstIsWorking ? 'make-off' : 'make-working';
    applyButton.disabled = false;
    if (applyLabel) applyLabel.textContent = firstIsWorking ? 'Применить: выходной' : 'Применить: рабочий день';
  };

  const handleSelectionGuard = (event) => {
    const button = event.target.closest('[data-calendar-date]');
    if (!button || !calendarRoot.contains(button) || !selection) return;
    const dateKey = button.dataset.calendarDate || '';
    if (!dateKey || selection.isSelected(dateKey)) return;
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
    selection = initMultiSelect(calendarRoot, { onChange: syncApplyButton });
    syncApplyButton([]);
  };

  const startSelectionSession = (month) => {
    calendar = initCalendar(calendarRoot, {
      month,
      workingDates: datesForWorkplace(workingDays, selectedWorkplaceId),
      renderDateContent: ({ dateKey, isCurrentMonth, isWorking }) => {
        if (!isCurrentMonth || !isWorking) return '';
        const workingDay = workingDayForDate(workingDays, selectedWorkplaceId, dateKey);
        const time = resolveWorkingDayTime(workplaces, workingDay, timeWorks);
        if (!time) return '';
        return `<span>${time.from}</span><span>${time.to}</span>`;
      },
      onDateSelect: () => {},
      onMonthChange: (nextMonth) => {
        resetSelectionForCalendarField();
        renderHeader(nextMonth);
      },
    });
    selection = initMultiSelect(calendarRoot, { onChange: syncApplyButton });
    syncApplyButton([]);
  };

  function openWorkplacePickerModal() {
    const options = workplaceOptions(workplaces);
    const content = `<div class="modal-title"><h2>Выбрать место работы</h2></div>${select({ name: 'timetableWorkplaceModal', label: 'Место работы', value: selectedWorkplaceId, options, data: 'data-timetable-workplace-modal' })}<button type="button" class="ui-button" data-timetable-workplace-save>Выбрать</button>`;
    const modalRoot = mountModal(document.body, modal(content, { title: 'Выбрать место работы' }));
    modalRoot?.querySelector('[data-timetable-workplace-save]')?.addEventListener('click', () => {
      selectedWorkplaceId = modalRoot.querySelector('[data-timetable-workplace-modal]')?.value || selectedWorkplaceId;
      const month = calendar?.getDisplayedMonth() || initialMonth;
      selection?.destroy();
      startSelectionSession(month);
      renderHeader(month);
      modalRoot.remove();
    });
  }

  function openWorkplaceTimeModal() {
    const selectedDates = selection?.getSelectedDates?.() || [];
    if (selectedDates.length !== 1) return;

    const selectedDate = selectedDates[0];
    const workplace = workplaces.find((item) => item.key === selectedWorkplaceId) || null;
    const workingDay = workingDayForDate(workingDays, selectedWorkplaceId, selectedDate);
    if (!workplace || !workingDay) return;

    const time = resolveWorkingDayTime(workplaces, workingDay, timeWorks);
    const from = time?.from || workplace.from || '09:00';
    const to = time?.to || workplace.to || '18:00';
    const content = `<div class="modal-title"><h2>Время работы</h2></div><div class="timetable-time-fields">${timePicker({ name: 'timetableWorkplaceFrom', label: 'Начало', value: from })}${timePicker({ name: 'timetableWorkplaceTo', label: 'Окончание', value: to })}</div><button type="button" class="ui-button" data-timetable-workplace-time-save>Сохранить</button>`;
    const modalRoot = mountModal(document.body, modal(content, { title: 'Время работы' }));
    if (!modalRoot) return;
    initTimePickers(modalRoot);
    modalRoot.querySelector('[data-timetable-workplace-time-save]')?.addEventListener('click', () => {
      const nextFrom = modalRoot.querySelector('[name="timetableWorkplaceFrom"]')?.value || from;
      const nextTo = modalRoot.querySelector('[name="timetableWorkplaceTo"]')?.value || to;
      const target = workingDayForDate(workingDays, selectedWorkplaceId, selectedDate);
      if (!target) return;
      const baseTime = resolveWorkplaceTime(workplaces, selectedWorkplaceId);
      const timeWork = ensureTimeWork(timeWorks, {
        workplaceId: selectedWorkplaceId,
        date: selectedDate,
        time: baseTime,
      });
      if (!timeWork) return;
      correctTimeWork(timeWork, nextFrom, nextTo, 'timetable');
      saveTimeWorks(timeWorks);
      const month = calendar?.getDisplayedMonth() || initialMonth;
      selection?.destroy();
      startSelectionSession(month);
      renderHeader(month);
      modalRoot.remove();
    });
  }

  function openWorkplaceModal() {
    const workplace = workplaces.find((item) => item.key === selectedWorkplaceId) || null;
    const selectedDates = selection?.getSelectedDates?.() || [];
    const stats = monthStats(calendar?.getDisplayedMonth() || initialMonth, workingDays, selectedWorkplaceId, workplaces, timeWorks);
    const timeActionDisabled = selectedDates.length !== 1 || !workingDayForDate(workingDays, selectedWorkplaceId, selectedDates[0]);
    const content = `<div class="modal-title"><h2>Место работы</h2></div><div class="timetable-workplace-modal-summary"><strong>${workplace?.name || 'Место работы не выбрано'}</strong>${timetableCounter(stats)}</div><div class="timetable-workplace-modal-actions"><button type="button" class="ui-button" data-timetable-open-picker>Выбрать место работы</button><button type="button" class="ui-button" data-timetable-open-time ${timeActionDisabled ? 'disabled' : ''}>Скорректировать время</button></div>`;
    const modalRoot = mountModal(document.body, modal(content, { title: 'Место работы' }));
    modalRoot?.querySelector('[data-timetable-open-picker]')?.addEventListener('click', () => {
      modalRoot.remove();
      openWorkplacePickerModal();
    });
    modalRoot?.querySelector('[data-timetable-open-time]')?.addEventListener('click', () => {
      if (timeActionDisabled) return;
      modalRoot.remove();
      openWorkplaceTimeModal();
    });
  }

  workplaceOpen?.addEventListener('click', openWorkplaceModal);

  if (workplaces.length) startSelectionSession(initialMonth);
  else calendar = initCalendar(calendarRoot, { month: initialMonth, workingDates: [] });

  applyButton.addEventListener('click', () => {
    if (!selection) return;
    const dates = selection.getSelectedDates();
    if (!dates.length || !selectionMode) return;
    const makeWorking = selectionMode === 'make-working';
    const selected = new Set(dates);
    const nextWorkingDays = makeWorking
      ? [...workingDays, ...dates.filter((date) => !workingDays.some((item) => item?.date === date && item?.workplaceId === selectedWorkplaceId)).map((date) => ({ date, workplaceId: selectedWorkplaceId }))]
      : workingDays.filter((item) => !(item?.workplaceId === selectedWorkplaceId && selected.has(item.date)));

    if (makeWorking) {
      for (const date of dates) {
        const baseTime = resolveWorkplaceTime(workplaces, selectedWorkplaceId);
        if (!baseTime) continue;
        ensureTimeWork(timeWorks, { workplaceId: selectedWorkplaceId, date, time: baseTime });
      }
      saveTimeWorks(timeWorks);
    } else {
      for (const date of dates) {
        const index = timeWorks.findIndex((item) => item?.workplaceId === selectedWorkplaceId && item?.date === date);
        if (index >= 0) timeWorks.splice(index, 1);
      }
      saveTimeWorks(timeWorks);
    }

    saveState({ workingDays: nextWorkingDays });
    workingDays.splice(0, workingDays.length, ...nextWorkingDays);
    const month = calendar.getDisplayedMonth();
    selection.destroy();
    startSelectionSession(month);
    renderHeader(month);
  });

  return { get selection() { return selection; } };
}
