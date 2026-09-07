import { costField, collectCost, initCostFields } from '../cost/index.js';
import { button } from '../buttons/index.js';
import { select } from '../selectors/index.js';
import { escapeHtml } from '../utils/escape-html.js';

export { getWorkplaceContext, setWorkplaceContext } from '../../core/workplace-context.js';

export function workplaceCountText(count = 0) {
  return `${Math.max(0, Number(count) || 0)} р.м.`;
}

export function workplaceAddButton({ data = 'data-add-workplace' } = {}) {
  return button('+ Добавить рабочее место', {
    className: 'ui-button--secondary ui-button--full',
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

export function workplaceHeaderButton({ workplace = null, showStats = false, stats = null } = {}) {
  const name = workplace?.name || 'Рабочее место';
  const safeName = escapeHtml(name);
  const counter = showStats && stats
    ? `<span class="timetable-workplace__days">${stats.days} дней</span><span class="timetable-workplace__time">${stats.hours} ч ${String(stats.minutes).padStart(2, '0')} м</span>`
    : '';
  return `<button type="button" class="timetable-workplace-button ui-button--secondary" data-workplace-header-open aria-label="Рабочее место: ${safeName}"><span class="timetable-workplace-button__name">${safeName}</span>${counter}<span class="timetable-workplace-button__arrow" aria-hidden="true">⌄</span></button>`;
}
