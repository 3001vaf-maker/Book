import { escapeHtml } from '../utils/escape-html.js';

export function select({ name = '', label = '', value = '', options = [], aria = '', className = '', data = '' } = {}) {
  const optionMarkup = options.map(option => {
    const item = typeof option === 'string' ? { value: option, label: option } : option;
    return `<option value="${escapeHtml(item.value ?? '')}" ${String(item.value ?? '') === String(value ?? '') ? 'selected' : ''}>${escapeHtml(item.label ?? item.value ?? '')}</option>`;
  }).join('');
  return `<label class="field ui-select ${className}">${label ? `<span>${escapeHtml(label)}</span>` : ''}<span class="ui-select__control"><select ${name ? `name="${escapeHtml(name)}"` : ''} ${aria ? `aria-label="${escapeHtml(aria)}"` : ''} ${data}>${optionMarkup}</select></span></label>`;
}

export function searchableSelect({ label, name, value = '', options = [], placeholder = 'Начните вводить', required = false } = {}) {
  const id = `search-${name}-${Math.random().toString(36).slice(2, 8)}`;
  const opts = options.map((option) => {
    const item = typeof option === 'string' ? { value: option, label: option } : option;
    return `<option value="${escapeHtml(item.value)}">${escapeHtml(item.label)}</option>`;
  }).join('');
  return `<label class="field searchable-select"><span>${escapeHtml(label)}</span><input list="${id}" name="${escapeHtml(name)}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" ${required ? 'required' : ''} autocomplete="off"><datalist id="${id}">${opts}</datalist></label>`;
}
