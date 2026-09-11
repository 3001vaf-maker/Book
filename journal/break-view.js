import { button, entityCard, modal, mountModal, timeSlots } from '../ui/ui.js';
import { listAvailableEndTimes, listAvailableStartTimes } from '../core/time/index.js';
import { getWorkplaces } from '../core/workplace-time.js';
import { moveJournalBreak, removeJournalBreak } from './break-service.js';

function formatDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}.${match[2]}.${match[1].slice(-2)}` : String(value || '');
}

function workplaceName(workplaceId) {
  const workplace = getWorkplaces().find((item) => String(item?.key ?? item?.id ?? '') === String(workplaceId || ''));
  return workplace?.name || workplace?.title || 'Рабочее пространство';
}

function availableBreakStarts(item) {
  return listAvailableStartTimes({
    date: item.date,
    workplaceId: item.workplaceId,
    duration: 5,
    step: 5,
    excludeId: item.id,
  });
}

function availableBreakEnds(item, from) {
  return listAvailableEndTimes({
    date: item.date,
    workplaceId: item.workplaceId,
    from,
    step: 5,
    excludeId: item.id,
  });
}

function openBreakEndSlots(item, from, onSelected) {
  const values = availableBreakEnds(item, from);
  const slots = values.length
    ? timeSlots({ values, selected: item.to, data: 'data-break-end-slot', ariaLabel: 'Выбрать завершение перерыва' })
    : '<div class="muted">Нет доступного завершения.</div>';
  const content = `<div class="modal-title"><h2>До скольки занять</h2></div>${slots}`;
  const m = mountModal(document.body, modal(content, { variant: 'medium', surface: 'app' }));
  if (!m) return;
  m.querySelectorAll('[data-break-end-slot]').forEach((node) => node.addEventListener('click', () => {
    const to = node.dataset.breakEndSlot;
    if (!to) return;
    m.remove();
    onSelected?.({ from, to });
  }));
}

function openBreakTimeSlots(item, onSelected) {
  const values = availableBreakStarts(item);
  const slots = values.length
    ? timeSlots({ values, selected: item.from, data: 'data-break-start-slot', ariaLabel: 'Выбрать начало перерыва' })
    : '<div class="muted">Свободного времени нет.</div>';
  const content = `<div class="modal-title"><h2>С какого времени</h2></div>${slots}`;
  const m = mountModal(document.body, modal(content, { variant: 'medium', surface: 'app' }));
  if (!m) return;
  m.querySelectorAll('[data-break-start-slot]').forEach((node) => node.addEventListener('click', () => {
    const from = node.dataset.breakStartSlot;
    if (!from) return;
    m.remove();
    openBreakEndSlots(item, from, onSelected);
  }));
}

export function openBreakView(breakItem, { onClose = () => {} } = {}) {
  if (!breakItem?.id) return;
  let current = { ...breakItem };
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
      openBreakTimeSlots(current, ({ from, to }) => {
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
