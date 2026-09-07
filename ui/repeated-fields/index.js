import { button } from '../buttons/index.js';
import { escapeHtml } from '../utils/escape-html.js';

function normalizeItems(values) {
  if (!Array.isArray(values)) return [];
  return values
    .filter(value => value !== null && value !== undefined)
    .map(value => typeof value === 'object' && value !== null
      ? { value: String(value.value ?? ''), source: String(value.source ?? '') }
      : { value: String(value), source: '' });
}

function defaultAddLabel(label) {
  return label ? `+ Добавить ${label}` : '+ Добавить';
}

export function repeatedField({ label = '', name = '', values = [], type = 'text', placeholder = 'Добавить значение', addLabel = '', className = '' } = {}) {
  const items = normalizeItems(values);
  const rows = items.length ? items : [{ value: '', source: '' }];
  const resolvedAddLabel = addLabel || defaultAddLabel(label);
  return `<div class="array-group ${escapeHtml(className)}" data-repeated-field data-repeated-name="${escapeHtml(name)}" data-repeated-label="${escapeHtml(label)}"><span class="array-label">${escapeHtml(label)}</span><div data-repeated-list>${rows.map(item => repeatedRow({ name, type, value: item.value, source: item.source, placeholder, label })).join('')}</div>${button(resolvedAddLabel, { className: 'ui-button--small', data: `data-repeated-add="${escapeHtml(name)}"` })}</div>`;
}

function repeatedRow({ name, type, value = '', source = '', placeholder, label = '' }) {
  const sourceMarkup = source ? ` data-repeated-source="${escapeHtml(source)}"` : '';
  const removeLabel = label ? `Удалить ${label}` : 'Удалить значение';
  return `<div class="array-row" data-repeated-row${sourceMarkup}><input type="${escapeHtml(type)}" name="${escapeHtml(name)}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}"><button type="button" class="remove-button" data-repeated-remove aria-label="${escapeHtml(removeLabel)}">×</button></div>`;
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
      const label = group.dataset.repeatedLabel || '';
      const type = group.querySelector('input')?.type || 'text';
      const placeholder = group.querySelector('input')?.placeholder || 'Добавить значение';
      list.insertAdjacentHTML('beforeend', repeatedRow({ name, type, placeholder, label }));
    });
  });
}

export function collectRepeatedField(root, name) {
  return [...root.querySelectorAll(`[data-repeated-field][data-repeated-name="${CSS.escape(name)}"] input[name="${CSS.escape(name)}"]`)]
    .map(input => input.value.trim())
    .filter(Boolean);
}

export function collectRepeatedEntries(root, name) {
  return [...root.querySelectorAll(`[data-repeated-field][data-repeated-name="${CSS.escape(name)}"] [data-repeated-row]`)]
    .map(row => ({ value: row.querySelector('input')?.value.trim() || '', source: row.dataset.repeatedSource || '' }))
    .filter(item => item.value);
}
