import { costField, collectCost, initCostFields } from '../cost/index.js';
import { button } from '../buttons/index.js';
import { openHeaderControl } from '../header/index.js';
import { select } from '../selectors/index.js';
import { modal, mountModal } from '../modals/index.js';
import { timePicker, initTimePickers } from '../time/index.js';
import { escapeHtml } from '../utils/escape-html.js';

export { getWorkplaceContext, setWorkplaceContext } from '../../core/workplace-context.js';

export function workplaceCountText(count = 0) {
  return `${Math.max(0, Number(count) || 0)} р.м.`;
}

export function workplaceAddButton({ data = 'data-add-workplace' } = {}) {
  return button('+ Добавить рабочее место', {
    variant: 'secondary',
    data,
    aria: 'Добавить рабочее место',
  });
}

function workplaceOptions(workplaces = []) {
  return (Array.isArray(workplaces) ? workplaces : []).map((workplace) => ({
    value: String(workplace?.key || ''),
    label: String(workplace?.name || 'Без названия'),
  })).filter((option) => option.value);
}

function row(name, value, options, selected = {}, withCost = false) {
  const cost = selected?.cost || {};
  return `<div class="workplace-select-row" data-workplace-row>${select({
    label: 'Рабочее место',
    name,
    value,
    options: [{ value: '', label: 'Выбор рабочего места' }, ...options],
    data: 'data-workplace-value',
  })}${withCost ? costField({ name: `${name}-cost-${Math.random().toString(36).slice(2, 8)}`, value: cost }) : ''}<button type="button" class="remove-button" data-remove-workplace aria-label="Удалить рабочее место">×</button></div>`;
}

export function workplaceSelector({ name = 'workplaces', selected = [], allowMultiple = true, costPerWorkplace = false, workplaces = [] } = {}) {
  const options = workplaceOptions(workplaces);
  const selections = Array.isArray(selected) ? selected : [];
  const first = String(selections[0]?.workplaceId || selections[0]?.id || selections[0]?.key || '');
  const catalog = escapeHtml(JSON.stringify(options));
  return `<div class="workplace-selector" data-workplace-selector="${escapeHtml(name)}" data-cost-per-workplace="${costPerWorkplace ? 'true' : 'false'}" data-workplace-options="${catalog}"><div data-workplace-rows>${row(name, first, options, selections[0], costPerWorkplace)}</div>${allowMultiple ? workplaceAddButton() : ''}</div>`;
}

export function initWorkplaceSelectors(root) {
  root.querySelectorAll('[data-workplace-selector]').forEach((host) => {
    if (host.dataset.workplaceSelectorReady === 'true') return;
    host.dataset.workplaceSelectorReady = 'true';
    initCostFields(host);
    host.querySelector('[data-add-workplace]')?.addEventListener('click', () => {
      const rows = host.querySelector('[data-workplace-rows]');
      if (!rows) return;
      const options = JSON.parse(host.dataset.workplaceOptions || '[]');
      const withCost = host.dataset.costPerWorkplace === 'true';
      rows.insertAdjacentHTML('beforeend', row(host.dataset.workplaceSelector, '', options, {}, withCost));
      const added = rows.lastElementChild;
      if (withCost && added) initCostFields(added);
    });
    host.addEventListener('click', (event) => {
      const remove = event.target.closest('[data-remove-workplace]');
      if (remove) remove.closest('[data-workplace-row]')?.remove();
    });
  });
}

export function collectWorkplaceSelections(root, name = 'workplaces') {
  const host = root.querySelector(`[data-workplace-selector="${CSS.escape(name)}"]`);
  if (!host) return [];
  const options = JSON.parse(host.dataset.workplaceOptions || '[]');
  return [...host.querySelectorAll('[data-workplace-row]')].map((item) => {
    const input = item.querySelector('input[type="hidden"][data-workplace-value]');
    const workplaceId = String(input?.value || '');
    if (!workplaceId) return null;
    const label = options.find((option) => option.value === workplaceId)?.label || '';
    const costHost = item.querySelector('[data-cost-field]');
    return { workplaceId, name: label, cost: costHost ? collectCost(item, costHost.dataset.costField) : {} };
  }).filter(Boolean);
}

/**
 * Neutral Workplace UI content.
 * It does not know whether it is placed inside Header Control, List or any
 * other shared UI container.
 */
export function workplaceContent({ workplace = null, showStats = false, stats = null } = {}) {
  const name = workplace?.name || 'Рабочее место';
  const counter = showStats && stats
    ? `<span class="workplace-content__primary">${Math.max(0, Number(stats.days) || 0)} дней</span><span class="workplace-content__secondary">${Math.max(0, Number(stats.hours) || 0)} ч ${String(Math.max(0, Number(stats.minutes) || 0)).padStart(2, '0')} м</span>`
    : '';
  return `<span class="workplace-content"><span class="workplace-content__name">${escapeHtml(name)}</span>${counter}</span>`;
}

function workplaceSummary(stats) {
  if (!stats) return '';
  const days = Math.max(0, Number(stats.days) || 0);
  const hours = Math.max(0, Number(stats.hours) || 0);
  const minutes = String(Math.max(0, Number(stats.minutes) || 0)).padStart(2, '0');
  return `<div class="workplace-control-summary"><strong>${days} дней</strong><span>${hours} ч ${minutes} м</span></div>`;
}

/**
 * Canonical Workplace manifestation used from any section.
 * The section provides only current data and callbacks. The first-level
 * manifestation always uses the shared Header Control medium modal; nested
 * Workplace actions compose existing shared UI.
 */
export function openWorkplaceControl({
  workplaces = [],
  workplaceId = '',
  stats = null,
  canCorrectTime = false,
  time = null,
  onSelect = () => {},
  onSaveTime = () => ({ ok: true }),
} = {}) {
  const catalog = Array.isArray(workplaces) ? workplaces : [];
  const current = catalog.find((item) => String(item?.key || '') === String(workplaceId || '')) || null;
  const workplaceName = current?.name || 'Рабочее место';

  const openPicker = () => {
    const content = `<div class="compact-form"><div class="modal-title"><h2>Рабочее место</h2></div>${select({
      name: 'workplaceControlSelect',
      value: workplaceId,
      options: workplaceOptions(catalog),
      data: 'data-workplace-control-select',
      aria: 'Рабочее место',
    })}<div class="modal-actions">${button('Выбрать', { data: 'data-workplace-control-save' })}</div></div>`;
    const picker = mountModal(document.body, modal(content, { title: 'Рабочее место', variant: 'compact' }));
    picker?.querySelector('[data-workplace-control-save]')?.addEventListener('click', () => {
      const nextId = picker.querySelector('input[data-workplace-control-select]')?.value || workplaceId;
      onSelect(String(nextId || ''));
      picker.remove();
    });
  };

  const openTime = () => {
    if (!canCorrectTime || !time) return;
    const from = String(time.from || '09:00');
    const to = String(time.to || '18:00');
    const content = `<div class="compact-form"><div class="modal-title"><h2>Рабочее время</h2></div><div class="workplace-control-time">${timePicker({ name: 'workplaceControlFrom', label: 'Начало', value: from })}${timePicker({ name: 'workplaceControlTo', label: 'Окончание', value: to })}</div><div class="form-error" data-workplace-control-time-error></div>${button('Сохранить', { data: 'data-workplace-control-time-save' })}</div>`;
    const timeModal = mountModal(document.body, modal(content, { title: 'Рабочее время' }));
    if (!timeModal) return;
    initTimePickers(timeModal);
    timeModal.querySelector('[data-workplace-control-time-save]')?.addEventListener('click', () => {
      const nextFrom = timeModal.querySelector('[name="workplaceControlFrom"]')?.value || from;
      const nextTo = timeModal.querySelector('[name="workplaceControlTo"]')?.value || to;
      const result = onSaveTime({ from: nextFrom, to: nextTo });
      if (result === false || result?.ok === false) {
        const error = timeModal.querySelector('[data-workplace-control-time-error]');
        if (error) error.textContent = result?.message || 'Проверьте рабочее время.';
        return;
      }
      timeModal.remove();
    });
  };

  const correction = canCorrectTime && time
    ? button('Корректировка времени', { data: 'data-workplace-control-open-time', variant: 'secondary' })
    : '';
  const content = `<div class="modal-title"><h2>${escapeHtml(workplaceName)}</h2></div>${workplaceSummary(stats)}<div class="workplace-control-actions">${button('Рабочее место', { data: 'data-workplace-control-open-picker' })}${correction}</div>`;
  const main = openHeaderControl(content, { title: workplaceName });
  main?.querySelector('[data-workplace-control-open-picker]')?.addEventListener('click', () => { main.remove(); openPicker(); });
  main?.querySelector('[data-workplace-control-open-time]')?.addEventListener('click', () => { main.remove(); openTime(); });
  return main;
}
