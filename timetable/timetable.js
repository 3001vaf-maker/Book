import { actionBlock, button, pageHeader, initCalendar, initMultiSelect, select, modal, mountModal, timePicker, initTimePickers, escapeHtml, workplaceHeaderButton, getWorkplaceContext, setWorkplaceContext } from '../ui/ui.js';
import { getWorkplaces, resolveWorkplaceTime } from '../core/workplace-time.js';
import { getDays, saveDays, getDay, getDayTime, createDay, updateDayTime, getScheduleConflicts, hasScheduleConflict, findSuggestedInterval } from '../core/day.js';

function workplaceOptions(workplaces) { return workplaces.map((workplace) => ({ value: workplace.key, label: workplace.name || 'Без названия' })); }
function datesForWorkplace(days, workplaceId) { return days.filter((item) => item?.workplaceId === workplaceId).map((item) => item.date).filter(Boolean); }
function workingDayForDate(days, workplaceId, date) { return getDay(days, workplaceId, date); }
function minutesBetween(from, to) { const [fh, fm] = from.split(':').map(Number); const [th, tm] = to.split(':').map(Number); return Math.max(0, th * 60 + tm - fh * 60 - fm); }
function formatDateLabel(value) { const [year, month, day] = String(value || '').split('-'); return year && month && day ? `${day}.${month}.${year}` : String(value || ''); }
function monthStats(month, days, workplaceId, workplaces) {
  const prefix = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-`;
  const selected = datesForWorkplace(days, workplaceId).filter((date) => date.startsWith(prefix));
  const total = selected.reduce((sum, date) => { const time = getDayTime(workingDayForDate(days, workplaceId, date), workplaces); return sum + (time ? minutesBetween(time.from, time.to) : 0); }, 0);
  return { days: selected.length, hours: Math.floor(total / 60), minutes: total % 60 };
}
function timetableCounter(stats) { return `<span class="timetable-workplace__days">${stats.days} дней</span><span class="timetable-workplace__time">${stats.hours} ч ${String(stats.minutes).padStart(2, '0')} м</span>`; }

export function renderTimetable(root) {
  const workplaces = getWorkplaces();
  const workingDays = getDays();
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
    const content = `<div class="compact-form"><div class="modal-title"><h2>Рабочее место</h2></div>${select({ name: 'timetableWorkplaceModal', value: selectedWorkplaceId, options: workplaceOptions(workplaces), data: 'data-timetable-workplace-modal', aria: 'Рабочее место' })}<div class="modal-actions">${button('Выбрать', { data: 'data-timetable-workplace-save' })}</div></div>`;
    const m = mountModal(document.body, modal(content, { title: 'Рабочее место', variant: 'compact' }));
    m?.querySelector('[data-timetable-workplace-save]')?.addEventListener('click', () => { selectedWorkplaceId = m.querySelector('[data-timetable-workplace-modal]')?.value || selectedWorkplaceId; setWorkplaceContext({ workplaceId: selectedWorkplaceId, date: calendar?.getDisplayedMonth() || initialDate }); const month = calendar?.getDisplayedMonth() || initialMonth; selection?.destroy(); startSelectionSession(month); renderHeader(month); m.remove(); });
  }

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
      return `<div class="compact-form" data-timetable-conflict-row="${index}"><div class="entity-details"><div><span>Дата</span><strong>${escapeHtml(formatDateLabel(entry.date))}</strong></div>${occupied}</div><div class="timetable-time-fields">${timePicker({ name: `timetableConflictFrom${index}`, label: 'Начало', value: initialFrom })}${timePicker({ name: `timetableConflictTo${index}`, label: 'Окончание', value: initialTo })}</div><div class="form-error" data-timetable-conflict-error="${index}"></div></div>`;
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
      selection?.destroy(); startSelectionSession(month); renderHeader(month); m.remove();
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
    const workplaceName = workplace?.name || 'Рабочее место';
    const content = `<div class="modal-title"><h2>${escapeHtml(workplaceName)}</h2></div><div class="timetable-workplace-modal-summary">${timetableCounter(stats)}</div><div class="timetable-workplace-modal-actions">${button('Рабочее место', { data: 'data-timetable-open-picker' })}${button('Корректировка времени', { data: `data-timetable-open-time${disabled ? ' disabled' : ''}`, variant: 'secondary' })}</div>`;
    const m = mountModal(document.body, modal(content, { title: workplaceName, variant: 'medium' }));
    m?.querySelector('[data-timetable-open-picker]')?.addEventListener('click', () => { m.remove(); openWorkplacePickerModal(); });
    m?.querySelector('[data-timetable-open-time]')?.addEventListener('click', () => { if (!disabled) { m.remove(); openWorkplaceTimeModal(); } });
  }
  root.querySelector('[data-workplace-header-open]')?.addEventListener('click', openWorkplaceModal);

  if (workplaces.length) startSelectionSession(initialMonth); else calendar = initCalendar(calendarRoot, { month: initialMonth, workingDates: [] });

  applyButton.addEventListener('click', () => {
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
        if (freeDates.length) { selection?.destroy(); startSelectionSession(month); renderHeader(month); }
        openWorkingDaysConflictModal(conflictEntries, base);
        return;
      }
    } else {
      for (let i = workingDays.length - 1; i >= 0; i -= 1) if (workingDays[i]?.workplaceId === selectedWorkplaceId && dates.includes(workingDays[i].date)) workingDays.splice(i, 1);
    }
    saveDays(workingDays); const month = calendar.getDisplayedMonth(); selection?.destroy(); startSelectionSession(month); renderHeader(month);
  });

  return { get selection() { return selection; } };
}
