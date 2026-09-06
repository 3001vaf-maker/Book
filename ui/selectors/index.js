import { escapeHtml } from '../utils/escape-html.js';

let selectorEventsReady = false;

function normalizeOptions(options = []) {
  const normalized = options.map(option => {
    const item = typeof option === 'string' ? { value: option, label: option } : option || {};
    return { value: String(item.value ?? ''), label: String(item.label ?? item.value ?? '') };
  });

  if (!normalized.some(option => option.value === '')) {
    normalized.unshift({ value: '', label: 'Не выбрано' });
  }

  return normalized;
}

function ensureSelectorEvents() {
  if (selectorEventsReady || typeof document === 'undefined') return;
  selectorEventsReady = true;

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-ui-select-trigger]');
    if (!trigger) return;
    event.preventDefault();
    openSelector(trigger);
  });

  document.addEventListener('click', (event) => {
    const option = event.target.closest('[data-ui-select-option]');
    if (!option) return;
    const surface = option.closest('[data-ui-selector]');
    if (!surface) return;

    const input = document.getElementById(surface.dataset.inputId);
    if (!input) return;

    input.value = option.dataset.value ?? '';
    input.dispatchEvent(new Event('change', { bubbles: true }));
    closeSelector(surface);
  });

  document.addEventListener('click', (event) => {
    const surface = event.target.closest('[data-ui-selector]');
    if (!surface || event.target.closest('[data-ui-select-option]')) return;
    if (event.target === surface || event.target.closest('[data-ui-selector-dismiss]')) {
      closeSelector(surface);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    document.querySelectorAll('[data-ui-selector]').forEach(closeSelector);
  });
}

function closeSelector(surface) {
  surface.remove();
}

function openSelector(trigger) {
  document.querySelectorAll('[data-ui-selector]').forEach(closeSelector);

  const inputId = trigger.dataset.inputId;
  const input = inputId ? document.getElementById(inputId) : null;
  if (!input) return;

  const options = JSON.parse(trigger.dataset.options || '[]');
  const currentValue = String(input.value ?? '');
  const selectedIndex = Math.max(0, options.findIndex(option => String(option.value ?? '') === currentValue));
  const optionMarkup = options.map((option, index) => `
    <button type="button" class="ui-selector__option${index === selectedIndex ? ' is-current' : ''}" data-ui-select-option data-value="${escapeHtml(option.value)}">
      <span>${escapeHtml(option.label)}</span>
    </button>`).join('');

  const surface = document.createElement('div');
  surface.className = 'ui-selector';
  surface.dataset.uiSelector = '';
  surface.dataset.inputId = input.id;
  surface.innerHTML = `
    <div class="ui-selector__backdrop" data-ui-selector-dismiss></div>
    <div class="ui-selector__wheel" role="listbox" aria-label="Выбор значения">
      <div class="ui-selector__viewport">${optionMarkup}</div>
    </div>`;

  document.body.appendChild(surface);

  const viewport = surface.querySelector('.ui-selector__viewport');
  const current = viewport?.querySelector('.is-current');
  if (viewport && current) {
    const targetTop = current.offsetTop - (viewport.clientHeight - current.offsetHeight) / 2;
    viewport.scrollTop = Math.max(0, targetTop);
  }
}

export function select({ name = '', label = '', value = '', options = [], aria = '', className = '', data = '' } = {}) {
  ensureSelectorEvents();

  const normalized = normalizeOptions(options);
  const inputId = `ui-select-${Math.random().toString(36).slice(2, 10)}`;
  const current = normalized.find(option => option.value === String(value ?? '')) || normalized[0];
  const optionData = escapeHtml(JSON.stringify(normalized));
  const dataAttrs = data ? ` ${data}` : '';

  return `<label class="field ui-select ${escapeHtml(className)}">
    ${label ? `<span>${escapeHtml(label)}</span>` : ''}
    <input id="${inputId}" type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(String(value ?? ''))}">
    <button type="button" class="ui-select__control" data-ui-select-trigger data-input-id="${inputId}" data-options="${optionData}"${aria ? ` aria-label="${escapeHtml(aria)}"` : ''}${dataAttrs}>
      <span class="ui-select__value">${escapeHtml(current.label)}</span>
      <span class="ui-select__chevron" aria-hidden="true">⌄</span>
    </button>
  </label>`;
}

export function searchableSelect({ label, name, value = '', options = [], placeholder = 'Начните вводить', required = false } = {}) {
  const id = `search-${name}-${Math.random().toString(36).slice(2, 8)}`;
  const opts = options.map((option) => {
    const item = typeof option === 'string' ? { value: option, label: option } : option;
    return `<option value="${escapeHtml(item.value)}">${escapeHtml(item.label)}</option>`;
  }).join('');
  return `<label class="field searchable-select"><span>${escapeHtml(label)}</span><input list="${id}" name="${escapeHtml(name)}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" ${required ? 'required' : ''} autocomplete="off"><datalist id="${id}">${opts}</datalist></label>`;
}
