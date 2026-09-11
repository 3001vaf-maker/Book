import { actionBlock, button, pageHeader, initCalendar, initMultiSelect, modal, mountModal, timePicker, initTimePickers, twoColumnLayout, escapeHtml, headerControl, workplaceContent, openWorkplaceControl, ALL_WORKPLACES_ID, getWorkplaceContext, setWorkplaceContext } from '../ui/ui.js';
import { getWorkplaces, resolveWorkplaceTime, getWorkingDayIndicators, getWorkingDayTotalMinutes, getWorkplaceMonthStats, getAllWorkplacesMonthStats, getWorkplaceMonthStatsMap } from '../core/workplace-time.js';
import { getDays, saveDays, getDay, getDayTime, createDay, updateDayTime, removeDay, getDayRemovalConflicts, getScheduleConflicts, hasScheduleConflict, findSuggestedInterval } from '../core/day/index.js';
import { isValidRange } from '../core/time/index.js';
import { openTimetableDayEditor } from './day-editor.js';

function datesForWorkplace(days, workplaceId) { return days.filter((item) => item?.workplaceId === workplaceId).map((item) => item.date).filter(Boolean); }
function datesForAllWorkplaces(days) { return [...new Set(days.map((item) => item?.date).filter(Boolean))]; }
function workingDayForDate(days, workplaceId, date) { return getDay(days, workplaceId, date); }
function formatDateLabel(value) { const [year, month, day] = String(value || '').split('-'); return year && month && day ? `${day}.${month}.${year}` : String(value || ''); }
function formatDuration(totalMinutes) {
  const total = Math.max(0, Number(totalMinutes) || 0);
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (!minutes) return `${hours} ч`;
  if (!hours) return `${minutes} м`;
  return `${hours} ч ${minutes} м`;
}
function occupiedLabel(item) { return item?.type === 'break' ? 'Перерыв' : 'Запись'; }

export function renderTimetable(root) {
  const workplaces = getWorkplaces();
  const workingDays = getDays();
  const context = getWorkplaceContext(workplaces);
  let selectedWorkplaceId = context.workplaceId;
  const initialDate = context.date;
  const initialMonth = new Date(initialDate.getFullYear(), initialDate.getMonth(), 1);

  const statsForMonth = (month) => ({
    aggregate: getAllWorkplacesMonthStats(workingDays, workplaces, month),
    byWorkplace: getWorkplaceMonthStatsMap(workingDays, workplaces, month),
  });

  const headerMarkup = (month) => {
    const allMode = selectedWorkplaceId === ALL_WORKPLACES_ID;
    const workplace = workplaces.find((item) => item.key === selectedWorkplaceId) || null;
    const stats = allMode
      ? getAllWorkplacesMonthStats(workingDays, workplaces, month)
      : getWorkplaceMonthStats(workingDays, workplaces, selectedWorkplaceId, month);
    return headerControl(workplaceContent({
      workplace,
      title: allMode ? 'Общий график' : '',
      showStats: true,
      stats,
    }), {
      data: 'data-workplace-header-open',
      aria: allMode ? 'Общий график рабочих мест' : `Рабочее место: ${workplace?.name || 'не выбрано'}`,
    });
  };

  root.innerHTML = `<div class="calendar-workspace">${pageHeader('График', '', headerMarkup(initialMonth))}<div data-timetable-calendar data-calendar-workspace-host></div><div data-timetable-actions>${actionBlock(button('<span data-timetable-apply-label>Применить: рабочий день</span>', { data: 'data-timetable-apply disabled' }), { className: 'calendar-workspace__actions' })}</div></div>`;
  const calendarRoot = root.querySelector('[data-timetable-calendar]');
  const actionsRoot = root.querySelector('[data-timetable-actions]');
  const applyButton = root.querySelector('[data-timetable-apply]');
  const applyLabel = root.querySelector('[data-timetable-apply-label]');
  let calendar; let selection; let selectionMode = null;

  const renderHeader = (month) => {
    const meta = root.querySelector('.page-header__meta'); if (!meta) return;
    meta.innerHTML = headerMarkup(month);
    meta.querySelector('[data-workplace-header-open]')?.addEventListener('click', openWorkplace);
  };
  const isAllMode = () => selectedWorkplaceId === ALL_WORKPLACES_ID;
  const isWorkingDate = (date) => !isAllMode() && datesForWorkplace(workingDays, selectedWorkplaceId).includes(date);
  const syncApplyButton = (dates) => {
    const allMode = isAllMode();
    if (actionsRoot) actionsRoot.hidden = allMode;
    if (allMode) { selectionMode = null; applyButton.disabled = true; return; }
    if (!dates.length) { selectionMode = null; applyButton.disabled = true; applyLabel.textContent = 'Применить: рабочий день'; return; }
    setWorkplaceContext({ workplaceId: selectedWorkplaceId, date: new Date(`${dates[0]}T00:00:00`) });
    selectionMode = isWorkingDate(dates[0]) ? 'make-off' : 'make-working';
    applyButton.disabled = false; applyLabel.textContent = selectionMode === 'make-off' ? 'Применить: выходной' : 'Применить: рабочий день';
  };
  const guard = (event) => {
    const calendarButton = event.target.closest('[data-calendar-date]'); if (!calendarButton || !selection || isAllMode()) return;
    const date = calendarButton.dataset.calendarDate || ''; if (!date || selection.isSelected(date)) return;
    const mode = isWorkingDate(date) ? 'make-off' : 'make-working';
    if (!selectionMode) selectionMode = mode; else if (mode !== selectionMode) { event.preventDefault(); event.stopImmediatePropagation(); }
  };
  calendarRoot.addEventListener('click', guard, true);

  const bindSelection = () => {
    selection?.destroy();
    selection = isAllMode() ? null : initMultiSelect(calendarRoot, { onChange: syncApplyButton });
    syncApplyButton([]);
  };

  const startSelectionSession = (month) => {
    const allMode = isAllMode();
    calendar = initCalendar(calendarRoot, {
      month,
      workingDates: allMode ? datesForAllWorkplaces(workingDays) : datesForWorkplace(workingDays, selectedWorkplaceId),
      renderDateContent: ({ dateKey, isCurrentMonth, isWorking }) => {
        if (!isCurrentMonth || !isWorking) return '';
        if (allMode) return `<span>${escapeHtml(formatDuration(getWorkingDayTotalMinutes(workingDays, workplaces, dateKey)))}</span>`;
        const time = getDayTime(workingDayForDate(workingDays, selectedWorkplaceId, dateKey), workplaces);
        return time ? `<span>${time.from}</span><span>${time.to}</span>` : '';
      },
      resolveDateIndicators: ({ dateKey, isCurrentMonth }) => isCurrentMonth
        ? getWorkingDayIndicators(workingDays, workplaces, dateKey, { excludeWorkplaceId: allMode ? '' : selectedWorkplaceId })
        : [],
      onDateSelect: (date) => {
        if (!date) return;
        const nextDate = new Date(`${date}T00:00:00`);
        if (allMode) {
          setWorkplaceContext({ date: nextDate });
          openTimetableDayEditor({
            date,
            onSave: () => {
              const refreshedDays = getDays();
              workingDays.splice(0, workingDays.length, ...refreshedDays);
              const month = calendar?.getDisplayedMonth() || initialMonth;
              startSelectionSession(month);
              renderHeader(month);
            },
          });
        } else setWorkplaceContext({ workplaceId: selectedWorkplaceId, date: nextDate });
      },
      onMonthChange: (nextMonth) => {
        bindSelection();
        if (allMode) setWorkplaceContext({ date: nextMonth });
        else setWorkplaceContext({ workplaceId: selectedWorkplaceId, date: nextMonth });
        renderHeader(nextMonth);
      },
    });
    bindSelection();
  };

  function conflictWorkplaceLabel(day) {
    return workplaces.find((item) => String(item?.key || '') === String(day?.workplaceId || ''))?.name || 'Другое место работы';
  }

  function buildConflictEntry(date, base) {
    const conflicts = getScheduleConflicts(workingDays, { workplaceId: selectedWorkplaceId, date, from: base.from, to: base.to });
    if (!conflicts.length) return null;
    const suggested = findSuggestedInterval(workingDays, { workplaceId: selectedWorkplaceId, date, baseFrom: base.from, baseTo: base.to });
    return { date, conflicts, suggested };
  }

  function openWorkingDaysConflictModal(entries, base) {
    const rows = entries.map((entry, index) => {
      const occupied = entry.conflicts.map((day) => `<div><span>Занято в другом месте</span><strong>${escapeHtml(conflictWorkplaceLabel(day))} · ${escapeHtml(day.from)}–${escapeHtml(day.to)}</strong></div>`).join('');
      const initialFrom = entry.suggested?.from || base.from;
      const initialTo = entry.suggested?.to || base.to;
      const timeFields = twoColumnLayout(
        timePicker({ name: `timetableConflictFrom${index}`, label: 'Начало', value: initialFrom }),
        timePicker({ name: `timetableConflictTo${index}`, label: 'Окончание', value: initialTo }),
        { ariaLabel: 'Интервал рабочего времени' },
      );
      return `<div class="compact-form" data-timetable-conflict-row="${index}"><div class="entity-details"><div><span>Дата</span><strong>${escapeHtml(formatDateLabel(entry.date))}</strong></div>${occupied}</div>${timeFields}<div class="form-error" data-timetable-conflict-error="${index}"></div></div>`;
    }).join('');
    const content = `<div class="modal-title"><h2>Конфликт времени</h2><p>На этих датах вы уже работаете в другом месте. Скорректируйте время для выбранного места.</p></div>${rows}${button('Сохранить', { data: 'data-timetable-conflicts-save' })}`;
    const m = mountModal(document.body, modal(content, { title: 'Конфликт времени' })); if (!m) return; initTimePickers(m);
    m.querySelector('[data-timetable-conflicts-save]')?.addEventListener('click', () => {
      const updates = [];
      let hasError = false;
      entries.forEach((entry, index) => {
        const from = m.querySelector(`[name="timetableConflictFrom${index}"]`)?.value || base.from;
        const to = m.querySelector(`[name="timetableConflictTo${index}"]`)?.value || base.to;
        const error = m.querySelector(`[data-timetable-conflict-error="${index}"]`);
        if (hasScheduleConflict(workingDays, { workplaceId: selectedWorkplaceId, date: entry.date, from, to })) {
          if (error) error.textContent = 'Это время всё ещё пересекается с другой работой.';
          hasError = true;
          return;
        }
        if (error) error.textContent = '';
        updates.push({ date: entry.date, from, to });
      });
      if (hasError) return;
      for (const item of updates) {
        if (getDay(workingDays, selectedWorkplaceId, item.date)) updateDayTime(workingDays, selectedWorkplaceId, item.date, item.from, item.to);
        else { const day = createDay({ date: item.date, workplaceId: selectedWorkplaceId, from: item.from, to: item.to }); if (day) workingDays.push(day); }
      }
      saveDays(workingDays);
      const month = calendar?.getDisplayedMonth() || initialMonth;
      startSelectionSession(month); renderHeader(month); m.remove();
    });
  }

  function applyWorkingDays(dates, base) {
    const candidates = dates.filter((date) => !getDay(workingDays, selectedWorkplaceId, date));
    const conflictEntries = candidates.map((date) => buildConflictEntry(date, base)).filter(Boolean);
    const conflictDates = new Set(conflictEntries.map((entry) => entry.date));
    const freeDates = candidates.filter((date) => !conflictDates.has(date));
    for (const date of freeDates) {
      const day = createDay({ date, workplaceId: selectedWorkplaceId, from: base.from, to: base.to });
      if (day) workingDays.push(day);
    }
    if (freeDates.length) saveDays(workingDays);
    if (conflictEntries.length) {
      const month = calendar?.getDisplayedMonth() || initialMonth;
      if (freeDates.length) { startSelectionSession(month); renderHeader(month); }
      openWorkingDaysConflictModal(conflictEntries, base);
      return;
    }
    saveDays(workingDays);
    const month = calendar?.getDisplayedMonth() || initialMonth;
    startSelectionSession(month); renderHeader(month);
  }

  function openWorkingTimePicker(dates) {
    const content = `<div class="modal-title"><h2>Рабочее время</h2><p>У этого рабочего места время не задано. Выберите интервал для отмеченных дат. Постоянное расписание рабочего места не изменится.</p></div><div class="compact-form">${timePicker({ name: 'timetableWorkingFrom', label: 'Начало', value: '00:00' })}${timePicker({ name: 'timetableWorkingTo', label: 'Окончание', value: '00:00' })}<div class="form-error" data-timetable-working-time-error></div>${button('Применить', { data: 'data-timetable-working-time-save' })}</div>`;
    const m = mountModal(document.body, modal(content, { title: 'Рабочее время', variant: 'compact' }));
    if (!m) return;
    initTimePickers(m);
    m.querySelector('[data-timetable-working-time-save]')?.addEventListener('click', () => {
      const from = m.querySelector('[name="timetableWorkingFrom"]')?.value || '';
      const to = m.querySelector('[name="timetableWorkingTo"]')?.value || '';
      const error = m.querySelector('[data-timetable-working-time-error]');
      if (!isValidRange(from, to)) {
        if (error) error.textContent = 'Окончание должно быть позже начала.';
        return;
      }
      if (error) error.textContent = '';
      m.remove();
      applyWorkingDays(dates, { from, to });
    });
  }

  function openRemovalBlockedModal(entries = []) {
    const blocked = (Array.isArray(entries) ? entries : []).filter((entry) => Array.isArray(entry?.conflicts) && entry.conflicts.length);
    if (!blocked.length) return;
    const workplace = workplaces.find((item) => String(item?.key || '') === String(selectedWorkplaceId || '')) || null;
    const workplaceName = workplace?.name || 'Рабочее пространство';
    const multiple = blocked.length > 1;
    const title = multiple ? 'Не все дни можно сделать выходными' : 'День нельзя сделать выходным';
    const description = multiple
      ? `${workplaceName}: на этих датах есть занятое время. Рабочие дни сохранены.`
      : `${workplaceName}: на этой дате есть занятое время. Рабочий день сохранён.`;
    const rows = blocked.map((entry) => {
      const details = entry.conflicts
        .filter((conflict) => conflict?.from && conflict?.to)
        .map((conflict) => `${occupiedLabel(conflict)} ${conflict.from}–${conflict.to}`)
        .join(', ');
      return `<div><span>${escapeHtml(formatDateLabel(entry.date))}</span><strong>${escapeHtml(details || 'Есть занятое время')}</strong></div>`;
    }).join('');
    const content = `<div class="modal-title"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p></div><div class="entity-details">${rows}</div>${button('Понятно', { data: 'data-removal-blocked-close' })}`;
    const m = mountModal(document.body, modal(content, { title, variant: 'compact' }));
    if (!m) return;
    m.querySelector('[data-removal-blocked-close]')?.addEventListener('click', () => m.remove());
  }

  function openWorkplace() {
    const allMode = isAllMode();
    const month = calendar?.getDisplayedMonth() || initialMonth;
    const monthStats = statsForMonth(month);

    openWorkplaceControl({
      workplaces,
      workplaceId: selectedWorkplaceId,
      title: 'Рабочий график',
      stats: allMode ? monthStats.aggregate : monthStats.byWorkplace[selectedWorkplaceId],
      workplaceStats: monthStats.byWorkplace,
      aggregateStats: monthStats.aggregate,
      includeAggregate: true,
      onSelect: (nextId) => {
        selectedWorkplaceId = nextId || selectedWorkplaceId;
        if (selectedWorkplaceId === ALL_WORKPLACES_ID) setWorkplaceContext({ date: month });
        else setWorkplaceContext({ workplaceId: selectedWorkplaceId, date: month });
        startSelectionSession(month); renderHeader(month);
      },
    });
  }
  root.querySelector('[data-workplace-header-open]')?.addEventListener('click', openWorkplace);

  if (workplaces.length) startSelectionSession(initialMonth); else calendar = initCalendar(calendarRoot, { month: initialMonth, workingDates: [] });

  applyButton.addEventListener('click', () => {
    if (isAllMode()) return;
    const dates = selection?.getSelectedDates?.() || []; if (!dates.length || !selectionMode) return;
    const makeWorking = selectionMode === 'make-working';
    if (makeWorking) {
      const base = resolveWorkplaceTime(workplaces, selectedWorkplaceId);
      if (!base) {
        openWorkingTimePicker(dates);
        return;
      }
      applyWorkingDays(dates, base);
      return;
    }

    const blockedRemoval = [];
    for (const date of dates) {
      if (removeDay(workingDays, selectedWorkplaceId, date)) continue;
      const conflicts = getDayRemovalConflicts(selectedWorkplaceId, date);
      if (conflicts.length) blockedRemoval.push({ date, conflicts });
    }
    saveDays(workingDays); const month = calendar.getDisplayedMonth(); startSelectionSession(month); renderHeader(month);
    if (blockedRemoval.length) openRemovalBlockedModal(blockedRemoval);
  });

  return { get selection() { return selection; } };
}