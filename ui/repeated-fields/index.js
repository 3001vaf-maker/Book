import { button } from '../buttons/index.js';
import { escapeHtml } from '../utils/escape-html.js';

function normalizeValues(values) {
  return Array.isArray(values) ? values.filter(value => value !== null && value !== undefined).map(String) : [];
}

export function repeatedField({ label = '', name = '', values = [], type = 'text', placeholder = 'Добавить значение', addLabel = '+', className = '' } = {}) {
  const items = normalizeValues(values);
  const rows = items.length ? items : [''];
  return `<div class="array-group ${escapeHtml(className)}" data-repeated-field data-repeated-name="${escapeHtml(name)}"><span class="array-label">${escapeHtml(label)}</span><div data-repeated-list>${rows.map(value => repeatedRow({ name, type, value, placeholder })).join('')}</div>${button(addLabel, { className: 'ui-button--small', data: `data-repeated-add="${escapeHtml(name)}"` })}</div>`;
}

function repeatedRow({ name, type, value = '', placeholder }) {
  return `<div class="array-row" data-repeated-row><input type="${escapeHtml(type)}" name="${escapeHtml(name)}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}"><button type="button" class="remove-button" data-repeated-remove aria-label="Удалить">×</button></div>`;
}

export function initRepeatedFields(root) {
  root.querySelectorAll('[data-repeated-field]').forEach(group => {
    if (group.dataset.repeatedInitialized === 'true') return;
    group.dataset.repeatedInitialized = 'true';
    group.addEventListener('click', event => {
      const remove = event.target.closest('[data-repeated-remove]');
      if (remove) {
        remove.closest('[data-repeated-row]')?.remove();
        return;
      }
      const add = event.target.closest('[data-repeated-add]');
      if (!add) return;
      const list = group.querySelector('[data-repeated-list]');
      if (!list) return;
      const name = group.dataset.repeatedName || '';
      const type = group.querySelector('input')?.type || 'text';
      const placeholder = group.querySelector('input')?.placeholder || 'Добавить значение';
      list.insertAdjacentHTML('beforeend', repeatedRow({ name, type, placeholder }));
    });
  });
}

export function collectRepeatedField(root, name) {
  return [...root.querySelectorAll(`[data-repeated-field][data-repeated-name="${CSS.escape(name)}"] input[name="${CSS.escape(name)}"]`)]
    .map(input => input.value.trim())
    .filter(Boolean);
}
