import { button, miniCard, modal, mountModal, timeSlots, mountRecordZ, recordZHost, bindRecordSettings } from '../ui/ui.js';
import { listAvailableEndTimes, listAvailableStartTimes } from '../core/time/index.js';
import { moveJournalBreak, removeJournalBreak } from './break-service.js';

function formatDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}.${match[2]}.${match[1].slice(-2)}` : String(value || '');
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
  const m = mountModal(document.body, modal(content, { variant: 'x', surface: 'app' }));
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
  const m = mountModal(document.body, modal(content, { variant: 'x', surface: 'app' }));
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
  const finish = () => onClose?.();
  const m = mountRecordZ({
    title: 'Перерыв',
    settings: true,
    className: 'record-break-z',
    onClose: () => queueMicrotask(finish),
  });
  if (!m) return;
  const root = recordZHost(m);

  const render = () => {
    const date = formatDate(current.date);
    const period = `${current.from} - ${current.to}`;
    const card = miniCard({
      className: 'record-break-mini-card',
      lines: [
        { value: 'Перерыв', strong: true },
        { value: date, align: 'right' },
        { value: period, align: 'right', data: 'data-break-move', aria: `Перенести перерыв ${period}` },
      ],
    });
    root.innerHTML = `<div class="record-screen record-screen--state-view">${card}</div>`;

    root.querySelector('[data-break-move]')?.addEventListener('click', () => {
      openBreakTimeSlots(current, ({ from, to }) => {
        const updated = moveJournalBreak(current.id, { from, to });
        if (!updated) return;
        current = updated;
        render();
      });
    });
  };

  bindRecordSettings(m, () => {
    const layer = mountModal(document.body, modal(
      `<div class="modal-actions">${button('Удалить перерыв', { variant: 'critical', data: 'data-break-settings-delete' })}</div>`,
      { variant: 'x', surface: 'app' },
    ));
    layer?.querySelector('[data-break-settings-delete]')?.addEventListener('click', () => {
      layer.v2Close?.();
      if (!removeJournalBreak(current.id)) return;
      m.v2Close?.();
    });
  });

  render();
}
