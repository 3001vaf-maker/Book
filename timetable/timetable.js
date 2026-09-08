import { actionBlock, button, pageHeader, initCalendar, initMultiSelect, modal, mountModal, timePicker, initTimePickers, escapeHtml, headerControl, workplaceContent, openWorkplaceControl, ALL_WORKPLACES_ID, getWorkplaceContext, setWorkplaceContext } from '../ui/ui.js';
import { getWorkplaces, resolveWorkplaceTime, getWorkingDayIndicators, getWorkingDayTotalMinutes, getWorkplaceMonthStats, getAllWorkplacesMonthStats, getWorkplaceMonthStatsMap } from '../core/workplace-time.js';
import { getDays, saveDays, getDay, getDayTime, getDaysForDate, createDay, updateDayTime, getScheduleConflicts, hasScheduleConflict, findSuggestedInterval } from '../core/day.js';
import { getWorkingTimeUsageConflicts } from '../core/time-usage.js';
import { isValidRange, rangesOverlap } from '../core/time.js';

function datesForWorkplace(days, workplaceId) { return days.filter((item) => item?.workplaceId === workplaceId).map((item) => item.date).filter(Boolean); }
function datesForAllWorkplaces(days) { return [...new Set(days.map((item) => item?.date).filter(Boolean))]; }
function workingDayForDate(days, workplaceId, date) { return getDay(days, workplaceId, date); }
function formatDateLabel(value) { const [year, month, day] = String(value || '').split('-'); return year && month && day ? `${day}.${month}.${year}` : String(value || ''); }
function formatModalDate(value) {
  const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const [, month, day] = String(value || '').split('-');
  const monthName = months[Math.max(0, Number(month) - 1)] || '';
  return day && monthName ? `${Number(day)} ${monthName}` : formatDateLabel(value);
}
function formatDuration(totalMinutes) {
  const total = Math.max(0, Number(totalMinutes) || 0);
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (!minutes) return `${hours} ч`;
  if (!hours) return `${minutes} м`;
  return `${hours} ч ${minutes} м`;
}
function overlapLabel(a, b) {
  const from = a.from > b.from ? a.from : b.from;
  const to = a.to < b.to ? a.to : b.to;
  return `${from}–${to}`;
}

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

  function aggregateDayEntries(date) {
    return getDaysForDate(workingDays, date).map((day) => {
      const workplaceId = String(day?.workplaceId || '');
      const workplace = workplaces.find((item) => String(item?.key || '') === workplaceId) || null;
      const time = getDayTime(day, workplaces);
      if (!workplaceId || !time) return null;
      return {
        workplaceId,
        name: workplace?.name || 'Рабочее место',
        from: time.from,
        to: time.to,
      };
    }).filter(Boolean);
  }

  function openAggregateDayEditor(date) {
    const entries = aggregateDayEntries(date);
    if (!entries.length) return;
    const rows = entries.map((entry, index) => `<div class="compact-form" data-aggregate-workplace="${escapeHtml(entry.workplaceId)}"><strong>${escapeHtml(entry.name)}</strong><div class="time-range-fields">${timePicker({ name: `aggregateFrom${index}`, label: 'Начало', value: entry.from })}${timePicker({ name: `aggregateTo${index}`, label: 'Окончание', value: entry.to })}</div><div class="form-error" data-aggregate-error="${index}" aria-live="polite"></div></div>`).join('');
    const dateTitle = formatModalDate(date);
    const content = `<div class="compact-form"><div class="modal-title"><h2>${escapeHtml(dateTitle)}</h2></div>${rows}${button('Применить', { data: 'data-aggregate-day-apply' })}</div>`;
    const m = mountModal(document.body, modal(content, { title: dateTitle, variant: 'medium' }));
    if (!m) return;
    initTimePickers(m);
    const save = m.querySelector('[data-aggregate-day-apply]');

    const readValues = () => entries.map((entry, index) => ({
      ...entry,
      from: m.querySelector(`[name="aggregateFrom${index}"]`)?.value || entry.from,
      to: m.querySelector(`[name="aggregateTo${index}"]`)?.value || entry.to,
    }));

    const validate = () => {
      const values = readValues();
      const errors = values.map(() => []);

      values.forEach((value, index) => {
        if (!isValidRange(value.from, value.to)) errors[index].push('Проверьте рабочее время.');
      });

      for (let left = 0; left < values.length; left += 1) {
        if (!isValidRange(values[left].from, values[left].to)) continue;
        for (let right = left + 1; right < values.length; right += 1) {
          if (!isValidRange(values[right].from, values[right].to)) continue;
          if (!rangesOverlap(values[left].from, values[left].to, values[right].from, values[right].to)) continue;
          const overlap = overlapLabel(values[left], values[right]);
          errors[left].push(`Пересечение с ${values[right].name}: ${overlap}`);
          errors[right].push(`Пересечение с ${values[left].name}: ${overlap}`);
        }
      }

      values.forEach((value, index) => {
        if (!isValidRange(value.from, value.to)) return;
        const conflicts = getWorkingTimeUsageConflicts({ date, workplaceId: value.workplaceId, from: value.from, to: value.to });
        conflicts.forEach((conflict) => {
          if (!conflict?.from || !conflict?.to) return;
          errors[index].push(`Запись ${conflict.from}–${conflict.to} выходит за рабочее время`);
        });
      });

      errors.forEach((messages, index) => {
        const error = m.querySelector(`[data-aggregate-error="${index}"]`);
        if (error) error.innerHTML = messages.map((message) => `<div>${escapeHtml(message)}</div>`).join('');
      });
      const hasErrors = errors.some((messages) => messages.length > 0);
      if (save) save.disabled = hasErrors;
      return { ok: !hasErrors, values };
    };

    m.addEventListener('change', (event) => {
      if (event.target?.matches?.('[data-time-value]')) validate();
    });
    validate();

    save?.addEventListener('click', () => {
      const result = validate();
      if (!result.ok) return;
      result.values.forEach((value) => updateDayTime(workingDays, value.workplaceId, date, value.from, value.to));
      saveDays(workingDays);
      const month = calendar?.getDisplayedMonth() || initialMonth;
      startSelectionSession(month);
      renderHeader(month);
      m.remove();
    });
  }

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
          openAggregateDayEditor(date);
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
      return `<div class="compact-form" data-timetable-conflict-row="${index}"><div class="entity-details"><div><span>Дата</span><strong>${escapeHtml(formatDateLabel(entry.date))}</strong></div>${occupied}</div><div class="compact-form">${timePicker({ name: `timetableConflictFrom${index}`, label: 'Начало', value: initialFrom })}${timePicker({ name: `timetableConflictTo${index}`, label: 'Окончание', value: initialTo })}</div><div class="form-error" data-timetable-conflict-error="${index}"></div></div>`;
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
      const base = resolveWorkplaceTime(workplaces, selectedWorkplaceId); if (!base) return;
      const candidates = dates.filter((date) => !getDay(workingDays, selectedWorkplaceId, date));
      const conflictEntries = candidates.map((date) => buildConflictEntry(date, base)).filter(Boolean);
      const conflictDates = new Set(conflictEntries.map((entry) => entry.date));
      const freeDates = candidates.filter((date) => !conflictDates.has(date));
      for (const date of freeDates) {
        const day = createDay({ date, workplaceId: selectedWorkplaceId, from: base.from, to: base.to }); if (day) workingDays.push(day);
      }
      if (freeDates.length) saveDays(workingDays);
      if (conflictEntries.length) {
        const month = calendar?.getDisplayedMonth() || initialMonth;
        if (freeDates.length) { startSelectionSession(month); renderHeader(month); }
        openWorkingDaysConflictModal(conflictEntries, base);
        return;
      }
    } else {
      for (let i = workingDays.length - 1; i >= 0; i -= 1) if (workingDays[i]?.workplaceId === selectedWorkplaceId && dates.includes(workingDays[i].date)) workingDays.splice(i, 1);
    }
    saveDays(workingDays); const month = calendar.getDisplayedMonth(); startSelectionSession(month); renderHeader(month);
  });

  return { get selection() { return selection; } };
}