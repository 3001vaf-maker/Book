import { escapeHtml } from '../utils/escape-html.js';

let selectorEventsReady = false;
let selectorId = 0;

function normalizeOptions(options = []) {
  return (Array.isArray(options) ? options : []).map((option) => {
    const item = typeof option === 'string' ? { value: option, label: option } : option || {};
    return { value: String(item.value ?? ''), label: String(item.label ?? item.value ?? '') };
  });
}

function closeSelector(surface) {
  surface?.remove();
}

function commitSelectorValue(surface, value, label) {
  const input = document.getElementById(surface?.dataset.inputId || '');
  const trigger = input?.closest('.ui-select')?.querySelector('[data-ui-select-trigger]');
  if (!input || !trigger) return;
  input.value = String(value ?? '');
  const valueNode = trigger.querySelector('.ui-select__value');
  if (valueNode) valueNode.textContent = String(label ?? value ?? '');
  input.dispatchEvent(new Event('change', { bubbles: true }));
  closeSelector(surface);
}

function filterSelector(surface, query) {
  const needle = String(query || '').trim().toLocaleLowerCase('ru');
  surface.querySelectorAll('[data-ui-select-option]').forEach((option) => {
    const text = `${option.dataset.value || ''} ${option.textContent || ''}`.toLocaleLowerCase('ru');
    option.hidden = Boolean(needle) && !text.includes(needle);
  });
}

function ensureSelectorEvents() {
  if (selectorEventsReady || typeof document === 'undefined') return;
  selectorEventsReady = true;

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest?.('[data-ui-select-trigger]');
    if (!trigger) return;
    event.preventDefault();
    openSelector(trigger);
  });

  document.addEventListener('click', (event) => {
    const option = event.target.closest?.('[data-ui-select-option]');
    if (!option) return;
    const surface = option.closest('[data-ui-selector]');
    if (!surface) return;
    commitSelectorValue(surface, option.dataset.value ?? '', option.querySelector('span')?.textContent ?? '');
  });

  document.addEventListener('input', (event) => {
    const search = event.target.closest?.('[data-ui-selector-search]');
    if (!search) return;
    const surface = search.closest('[data-ui-selector]');
    if (surface) filterSelector(surface, search.value);
  });

  document.addEventListener('click', (event) => {
    const surface = event.target.closest?.('[data-ui-selector]');
    if (!surface || event.target.closest?.('[data-ui-select-option]') || event.target.closest?.('[data-ui-selector-search]')) return;
    if (event.target === surface || event.target.closest?.('[data-ui-selector-dismiss]')) closeSelector(surface);
  });

  document.addEventListener('keydown', (event) => {
    const search = event.target.closest?.('[data-ui-selector-search]');
    if (search && event.key === 'Enter') {
      event.preventDefault();
      const surface = search.closest('[data-ui-selector]');
      if (!surface) return;
      const query = search.value.trim();
      if (!query) return;
      const options = JSON.parse(surface.dataset.options || '[]');
      const exact = options.find((option) => option.label.toLocaleLowerCase('ru') === query.toLocaleLowerCase('ru') || option.value.toLocaleLowerCase('ru') === query.toLocaleLowerCase('ru'));
      if (exact) commitSelectorValue(surface, exact.value, exact.label);
      else if (surface.dataset.allowCustom === 'true') commitSelectorValue(surface, query, query);
      return;
    }
    if (event.key !== 'Escape') return;
    document.querySelectorAll('[data-ui-selector]').forEach(closeSelector);
  });
}

function openSelector(trigger) {
  document.querySelectorAll('[data-ui-selector]').forEach(closeSelector);

  const inputId = trigger.dataset.inputId;
  const input = inputId ? document.getElementById(inputId) : null;
  if (!input) return;

  const options = JSON.parse(trigger.dataset.options || '[]');
  const currentValue = String(input.value ?? '');
  const selectedIndex = options.findIndex((option) => String(option.value ?? '') === currentValue);
  const optionMarkup = options.map((option, index) => `
    <button type="button" class="ui-selector__option${index === selectedIndex ? ' is-current' : ''}" data-ui-select-option data-value="${escapeHtml(option.value)}">
      <span>${escapeHtml(option.label)}</span>
    </button>`).join('');
  const searchable = trigger.dataset.searchable === 'true';
  const allowCustom = trigger.dataset.allowCustom === 'true';
  const placeholder = trigger.dataset.placeholder || 'Начните вводить';

  const surface = document.createElement('div');
  surface.className = 'ui-selector';
  surface.dataset.uiSelector = '';
  surface.dataset.inputId = input.id;
  surface.dataset.options = JSON.stringify(options);
  surface.dataset.allowCustom = allowCustom ? 'true' : 'false';
  surface.innerHTML = `
    <div class="ui-selector__backdrop" data-ui-selector-dismiss></div>
    <div class="ui-selector__wheel${searchable ? ' is-searchable' : ''}" role="listbox" aria-label="Выбор значения">
      ${searchable ? `<div class="ui-selector__search-wrap"><input class="ui-selector__search" type="search" data-ui-selector-search placeholder="${escapeHtml(placeholder)}" autocomplete="off"></div>` : ''}
      <div class="ui-selector__viewport">${optionMarkup}</div>
    </div>`;

  document.body.appendChild(surface);

  if (searchable) {
    const search = surface.querySelector('[data-ui-selector-search]');
    search?.focus();
    if (currentValue && !options.some((option) => option.value === currentValue)) search.value = currentValue;
    if (search?.value) filterSelector(surface, search.value);
  } else {
    const viewport = surface.querySelector('.ui-selector__viewport');
    const current = viewport?.querySelector('.is-current');
    if (viewport && current) {
      const targetTop = current.offsetTop - (viewport.clientHeight - current.offsetHeight) / 2;
      viewport.scrollTop = Math.max(0, targetTop);
    }
  }
}

export function select({ name = '', label = '', value = '', options = [], aria = '', className = '', data = '', searchable = false, allowCustom = false, placeholder = '' } = {}) {
  ensureSelectorEvents();

  const normalized = normalizeOptions(options);
  const stringValue = String(value ?? '');
  if (stringValue && !normalized.some((option) => option.value === stringValue) && allowCustom) normalized.unshift({ value: stringValue, label: stringValue });
  const inputId = `ui-select-${++selectorId}`;
  const current = normalized.find((option) => option.value === stringValue) || normalized[0] || { value: '', label: placeholder || 'Выбрать' };
  const optionData = escapeHtml(JSON.stringify(normalized));
  const dataAttrs = data ? ` ${data}` : '';

  return `<label class="field ui-select ${escapeHtml(className)}">
    ${label ? `<span>${escapeHtml(label)}</span>` : ''}
    <input id="${inputId}" type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(stringValue)}"${dataAttrs}>
    <button type="button" class="ui-select__control" data-ui-select-trigger data-input-id="${inputId}" data-options="${optionData}" data-searchable="${searchable ? 'true' : 'false'}" data-allow-custom="${allowCustom ? 'true' : 'false'}" data-placeholder="${escapeHtml(placeholder)}"${aria ? ` aria-label="${escapeHtml(aria)}"` : ''}${dataAttrs}>
      <span class="ui-select__value">${escapeHtml(current.label)}</span>
      <span class="ui-select__chevron" aria-hidden="true">⌄</span>
    </button>
  </label>`;
}

export function searchableSelect({ label = '', name = '', value = '', options = [], placeholder = 'Начните вводить', required = false, aria = '' } = {}) {
  return select({ label: required && label && !label.trim().endsWith('*') ? `${label} *` : label, name, value, options, placeholder, searchable: true, allowCustom: true, aria: aria || label });
}
