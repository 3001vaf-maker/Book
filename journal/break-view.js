import { button, entityCard, escapeHtml, modal, mountModal, timeSlots } from '../ui/ui.js';
import { getWorkplaces } from '../core/workplace-time.js';
import { getDays, getDay, getDayTime } from '../core/day.js';
import { getTimeUsages, isTimeRangeAvailable } from '../core/time-usage.js';
import { minutesBetween, minutesToTime, timeToMinutes } from '../core/time.js';
import { getRecordsForDay } from './record-data.js';
import { getJournalBreaks, moveJournalBreak, removeJournalBreak } from './break-data.js';

function formatDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}.${match[2]}.${match[1].slice(-2)}` : String(value || '');
}

function workplaceName(workplaceId) {
  const workplace = getWorkplaces().find((item) => String(item?.key ?? item?.id ?? '') === String(workplaceId || ''));
  return workplace?.name || workplace?.title || 'Рабочее пространство';
}

function availableBreakStarts(item) {
  const workplaces = getWorkplaces();
  const day = getDay(getDays(), item.workplaceId, item.date);
  const workTime = getDayTime(day, workplaces);
  const start = timeToMinutes(workTime?.from);
  const end = timeToMinutes(workTime?.to);
  const duration = minutesBetween(item.from, item.to);
  if (start == null || end == null || !duration) return [];

  const records = getRecordsForDay(item.date, item.workplaceId).filter((record) => record?.status !== 'cancelled');
  const breaks = getJournalBreaks();
  const usages = getTimeUsages({ records, breaks });
  const first = Math.ceil(start / 15) * 15;
  const values = [];
  for (let value = first; value + duration <= end; value += 15) {
    const from = minutesToTime(value);
    const to = minutesToTime(value + duration);
    if (isTimeRangeAvailable({ from, to, usages, excludeId: item.id })) values.push(from);
  }
  return values;
}

function openBreakTimeSlots(item, onSelected) {
  const values = availableBreakStarts(item);
  const slots = values.length
    ? timeSlots({ values, selected: item.from, data: 'data-break-time-slot', ariaLabel: 'Перенести перерыв' })
    : '<div class="muted">Свободного времени нет.</div>';
  const content = `<div class="modal-title"><h2>Перенести перерыв</h2></div>${slots}`;
  const m = mountModal(document.body, modal(content, { variant: 'medium', surface: 'app' }));
  if (!m) return;
  m.querySelectorAll('[data-break-time-slot]').forEach((node) => node.addEventListener('click', () => {
    const from = node.dataset.breakTimeSlot;
    if (!from) return;
    m.remove();
    onSelected?.(from);
  }));
}

export function openBreakView(breakItem, { onClose = () => {} } = {}) {
  if (!breakItem?.id) return;
  let current = { ...breakItem };
  const host = document.createElement('div');
  const m = mountModal(document.body, modal('<div data-break-view-host></div>', { variant: 'large', surface: 'app' }));
  if (!m) return;
  const root = m.querySelector('[data-break-view-host]');

  const finish = () => onClose?.();
  m.addEventListener('click', (event) => {
    if (event.target === m || event.target.closest('[data-modal-close]')) queueMicrotask(finish);
  });

  const render = () => {
    const workplace = workplaceName(current.workplaceId);
    const date = formatDate(current.date);
    const period = `${current.from} - ${current.to}`;
    const card = entityCard({
      title: 'Перерыв',
      topMeta: [{ value: workplace, row: 1 }],
      topRightMeta: [
        { value: date, row: 2, weight: 'regular' },
        { value: period, row: 3, weight: 'regular', data: 'data-break-move', aria: `Перенести перерыв ${period}` },
      ],
      className: 'entity-card--hero entity-card--top-dark',
    });
    root.innerHTML = `<div class="record-screen record-screen--state-view">${card}<div class="record-modal-actions modal-actions">${button('Удалить перерыв', { data: 'data-break-delete', variant: 'danger' })}</div></div>`;

    root.querySelector('[data-break-move]')?.addEventListener('click', () => {
      openBreakTimeSlots(current, (from) => {
        const duration = minutesBetween(current.from, current.to);
        const to = minutesToTime(timeToMinutes(from) + duration);
        const updated = moveJournalBreak(current.id, { from, to });
        if (!updated) return;
        current = updated;
        render();
      });
    });

    root.querySelector('[data-break-delete]')?.addEventListener('click', () => {
      if (!removeJournalBreak(current.id)) return;
      m.remove();
      finish();
    });
  };

  render();
}
