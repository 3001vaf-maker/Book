import { actionBlock, button, pageHeader, initCalendar, initMultiSelect, select, modal, mountModal, timePicker, initTimePickers, escapeHtml, workplaceHeaderButton, getWorkplaceContext, setWorkplaceContext } from '../ui/ui.js';
import { getWorkplaces, resolveWorkplaceTime } from '../core/workplace-time.js';
import { getDays, saveDays, getDay, getDayTime, createDay, updateDayTime, hasScheduleConflict, findSuggestedInterval, migrateLegacyWorkingDates } from '../core/day.js';

function workplaceOptions(workplaces) { return workplaces.map((workplace) => ({ value: workplace.key, label: workplace.name || 'Без названия' })); }
function datesForWorkplace(days, workplaceId) { return days.filter((item) => item?.workplaceId === workplaceId).map((item) => item.date).filter(Boolean); }
function workingDayForDate(days, workplaceId, date) { return getDay(days, workplaceId, date); }
function minutesBetween(from, to) { const [fh, fm] = from.split(':').map(Number); const [th, tm] = to.split(':').map(Number); return Math.max(0, th * 60 + tm - fh * 60 - fm); }
function monthStats(month, days, workplaceId, workplaces) {
  const prefix = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-`;
  const selected = datesForWorkplace(days, workplaceId).filter((date) => date.startsWith(prefix));
  const total = selected.reduce((sum, date) => { const time = getDayTime(workingDayForDate(days, workplaceId, date), workplaces); return sum + (time ? minutesBetween(time.from, time.to) : 0); }, 0);
  return { days: selected.length, hours: Math.floor(total / 60), minutes: total % 60 };
}
function timetableCounter(stats) { return `<span class="timetable-workplace__days">${stats.days} дней</span><span class="timetable-workplace__time">${stats.hours} ч ${String(stats.minutes).padStart(2, '0')} м</span>`; }

export function renderTimetable(root) {
  const workplaces = getWorkplaces();
  let workingDays = getDays();
  if (!workingDays.length) workingDays = migrateLegacyWorkingDates(workplaces[0]?.key);
  const context = getWorkplaceContext(workplaces);
  let selectedWorkplaceId = context.workplaceId;
  const initialDate = context.date;
  const initialMonth = new Date(initialDate.getFullYear(), initialDate.getMonth(), 1);

  root.innerHTML = `<div class="calendar-workspace">${pageHeader('График', '', workplaceHeaderButton({ workplace: workplaces.find((w) => w.key === selectedWorkplaceId), showStats: true, stats: monthStats(initialMonth, workingDays, selectedWorkplaceId, workplaces) }))}<div data-timetable-calendar data-calendar-workspace-host></div>${actionBlock(button('<span data-timetable-apply-label>Применить: рабочий день</span>', { data: 'data-timetable-apply disabled' }), { className: 'calendar-workspace__actions' })}</div>`;
  const calendarRoot = root.querySelector('[data-timetable-calendar]');
  const applyButton = root.querySelector('[data-timetable-apply]');
  const applyLabel = root.querySelector('[data-timetable-apply-label]');
  let calendar; let selection; let selectionMode = null;

  const renderHeader = (month) => {
    const meta = root.querySelector('.page-header__meta'); if (!meta) return;
    meta.innerHTML = workplaceHeaderButton({ workplace: workplaces.find((w) => w.key === selectedWorkplaceId), showStats: true, stats: monthStats(month, workingDays, selectedWorkplaceId, workplaces) });
    meta.querySelector('[data-workplace-header-open]')?.addEventListener('click', openWorkplaceModal);
  };
  const isWorkingDate = (date) => datesForWorkplace(workingDays, selectedWorkplaceId).includes(date);
  const syncApplyButton = (dates) => {
    if (!dates.length) { selectionMode = null; applyButton.disabled = true; applyLabel.textContent = 'Применить: рабочий день'; return; }
    setWorkplaceContext({ workplaceId: selectedWorkplaceId, date: new Date(`${dates[0]}T00:00:00`) });
    selectionMode = isWorkingDate(dates[0]) ? 'make-off' : 'make-working';
    applyButton.disabled = false; applyLabel.textContent = selectionMode === 'make-off' ? 'Применить: выходной' : 'Применить: рабочий день';
  };
  const guard = (event) => {
    const calendarButton = event.target.closest('[data-calendar-date]'); if (!calendarButton || !selection) return;
    const date = calendarButton.dataset.calendarDate || ''; if (!date || selection.isSelected(date)) return;
    const mode = isWorkingDate(date) ? 'make-off' : 'make-working';
    if (!selectionMode) selectionMode = mode; else if (mode !== selectionMode) { event.preventDefault(); event.stopImmediatePropagation(); }
  };
  calendarRoot.addEventListener('click', guard, true);

  const startSelectionSession = (month) => {
    calendar = initCalendar(calendarRoot, {
      month, workingDates: datesForWorkplace(workingDays, selectedWorkplaceId),
      renderDateContent: ({ dateKey, isCurrentMonth, isWorking }) => {
        if (!isCurrentMonth || !isWorking) return '';
        const time = getDayTime(workingDayForDate(workingDays, selectedWorkplaceId, dateKey), workplaces);
        return time ? `<span>${time.from}</span><span>${time.to}</span>` : '';
      },
      onDateSelect: (date) => { if (date) setWorkplaceContext({ workplaceId: selectedWorkplaceId, date: new Date(`${date}T00:00:00`) }); },
      onMonthChange: (nextMonth) => { selection?.destroy(); selection = initMultiSelect(calendarRoot, { onChange: syncApplyButton }); syncApplyButton([]); setWorkplaceContext({ workplaceId: selectedWorkplaceId, date: nextMonth }); renderHeader(nextMonth); },
    });
    selection = initMultiSelect(calendarRoot, { onChange: syncApplyButton }); syncApplyButton([]);
  };

  function openWorkplacePickerModal() {
    const content = `<div class="modal-title"><h2>Выбрать место работы</h2></div>${select({ name: 'timetableWorkplaceModal', label: 'Место работы', value: selectedWorkplaceId, options: workplaceOptions(workplaces), data: 'data-timetable-workplace-modal' })}${button('Выбрать', { data: 'data-timetable-workplace-save' })}`;
    const m = mountModal(document.body, modal(content, { title: 'Выбрать место работы' }));
    m?.querySelector('[data-timetable-workplace-save]')?.addEventListener('click', () => { selectedWorkplaceId = m.querySelector('[data-timetable-workplace-modal]')?.value || selectedWorkplaceId; setWorkplaceContext({ workplaceId: selectedWorkplaceId, date: calendar?.getDisplayedMonth() || initialDate }); const month = calendar?.getDisplayedMonth() || initialMonth; selection?.destroy(); startSelectionSession(month); renderHeader(month); m.remove(); });
  }

  function openWorkingDayConflictModal(date) {
    const workplace = workplaces.find((w) => w.key === selectedWorkplaceId); const base = resolveWorkplaceTime(workplaces, selectedWorkplaceId); if (!workplace || !base) return;
    const suggested = findSuggestedInterval(workingDays, { workplaceId: selectedWorkplaceId, date, baseFrom: base.from, baseTo: base.to });
    const suggestionText = suggested ? `${suggested.from}–${suggested.to}` : 'свободного интервала в стандартных часах нет';
    const content = `<div class="modal-title"><h2>Выберите время</h2></div><p>На ${escapeHtml(date)} выбранное место пересекается с другой работой мастера.</p><div class="timetable-workplace-modal-summary"><strong>Можно предложить: ${escapeHtml(suggestionText)}</strong></div><div class="timetable-time-fields">${timePicker({ name: 'timetableConflictFrom', label: 'Начало', value: suggested?.from || base.from })}${timePicker({ name: 'timetableConflictTo', label: 'Окончание', value: suggested?.to || base.to })}</div><div class="form-error" data-timetable-conflict-error></div>${button('Сохранить', { data: 'data-timetable-conflict-save' })}`;
    const m = mountModal(document.body, modal(content, { title: 'Выберите время' })); if (!m) return; initTimePickers(m);
    m.querySelector('[data-timetable-conflict-save]')?.addEventListener('click', () => {
      const from = m.querySelector('[name="timetableConflictFrom"]')?.value || base.from; const to = m.querySelector('[name="timetableConflictTo"]')?.value || base.to;
      if (hasScheduleConflict(workingDays, { workplaceId: selectedWorkplaceId, date, from, to })) { m.querySelector('[data-timetable-conflict-error]').textContent = 'Это время пересекается с другой работой. Выберите другое время или другой день.'; return; }
      const day = createDay({ date, workplaceId: selectedWorkplaceId, from, to }); if (!day) return;
      workingDays.push(day); saveDays(workingDays); m.remove(); const month = calendar?.getDisplayedMonth() || initialMonth; selection?.destroy(); startSelectionSession(month); renderHeader(month);
    });
  }

  function openWorkplaceTimeModal() {
    const dates = selection?.getSelectedDates?.() || []; if (!dates.length) return;
    const firstDay = workingDayForDate(workingDays, selectedWorkplaceId, dates[0]); if (!firstDay) return;
    const workplace = workplaces.find((w) => w.key === selectedWorkplaceId); const current = getDayTime(firstDay, workplaces);
    const from = current?.from || workplace?.from || '09:00'; const to = current?.to || workplace?.to || '18:00';
    const content = `<div class="modal-title"><h2>Время работы</h2></div><div class="timetable-time-fields">${timePicker({ name: 'timetableWorkplaceFrom', label: 'Начало', value: from })}${timePicker({ name: 'timetableWorkplaceTo', label: 'Окончание', value: to })}</div><div class="form-error" data-timetable-time-error></div>${button('Сохранить', { data: 'data-timetable-workplace-time-save' })}`;
    const m = mountModal(document.body, modal(content, { title: 'Время работы' })); if (!m) return; initTimePickers(m);
    m.querySelector('[data-timetable-workplace-time-save]')?.addEventListener('click', () => {
      const nextFrom = m.querySelector('[name="timetableWorkplaceFrom"]')?.value || from; const nextTo = m.querySelector('[name="timetableWorkplaceTo"]')?.value || to;
      for (const date of dates) if (hasScheduleConflict(workingDays, { workplaceId: selectedWorkplaceId, date, from: nextFrom, to: nextTo })) { m.querySelector('[data-timetable-time-error]').textContent = `В ${date} это время пересекается с другой работой мастера.`; return; }
      for (const date of dates) updateDayTime(workingDays, selectedWorkplaceId, date, nextFrom, nextTo);
      saveDays(workingDays); const month = calendar?.getDisplayedMonth() || initialMonth; selection?.destroy(); startSelectionSession(month); renderHeader(month); m.remove();
    });
  }

  function openWorkplaceModal() {
    const workplace = workplaces.find((w) => w.key === selectedWorkplaceId); const dates = selection?.getSelectedDates?.() || []; const stats = monthStats(calendar?.getDisplayedMonth() || initialMonth, workingDays, selectedWorkplaceId, workplaces);
    const disabled = !dates.length || dates.some((date) => !workingDayForDate(workingDays, selectedWorkplaceId, date));
    const content = `<div class="modal-title"><h2>Место работы</h2></div><div class="timetable-workplace-modal-summary"><strong>${escapeHtml(workplace?.name || 'Место работы не выбрано')}</strong>${timetableCounter(stats)}</div><div class="timetable-workplace-modal-actions">${button('Выбрать место работы', { data: 'data-timetable-open-picker' })}${button('Скорректировать время', { data: `data-timetable-open-time${disabled ? ' disabled' : ''}` })}</div>`;
    const m = mountModal(document.body, modal(content, { title: 'Место работы' }));
    m?.querySelector('[data-timetable-open-picker]')?.addEventListener('click', () => { m.remove(); openWorkplacePickerModal(); });
    m?.querySelector('[data-timetable-open-time]')?.addEventListener('click', () => { if (!disabled) { m.remove(); openWorkplaceTimeModal(); } });
  }
  root.querySelector('[data-workplace-header-open]')?.addEventListener('click', openWorkplaceModal);

  if (workplaces.length) startSelectionSession(initialMonth); else calendar = initCalendar(calendarRoot, { month: initialMonth, workingDates: [] });

  applyButton.addEventListener('click', () => {
    const dates = selection?.getSelectedDates?.() || []; if (!dates.length || !selectionMode) return;
    const makeWorking = selectionMode === 'make-working';
    if (makeWorking) {
      for (const date of dates) {
        if (getDay(workingDays, selectedWorkplaceId, date)) continue;
        const base = resolveWorkplaceTime(workplaces, selectedWorkplaceId); if (!base) continue;
        if (hasScheduleConflict(workingDays, { workplaceId: selectedWorkplaceId, date, from: base.from, to: base.to })) {
          if (dates.length === 1) { openWorkingDayConflictModal(date); return; }
          continue;
        }
        const day = createDay({ date, workplaceId: selectedWorkplaceId, from: base.from, to: base.to }); if (day) workingDays.push(day);
      }
    } else {
      for (let i = workingDays.length - 1; i >= 0; i -= 1) if (workingDays[i]?.workplaceId === selectedWorkplaceId && dates.includes(workingDays[i].date)) workingDays.splice(i, 1);
    }
    saveDays(workingDays); const month = calendar.getDisplayedMonth(); selection?.destroy(); startSelectionSession(month); renderHeader(month);
  });

  return { get selection() { return selection; } };
}
