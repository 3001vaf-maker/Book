import { escapeHtml } from '../ui.js';

export function select({ name = '', label = '', value = '', options = [], aria = '', className = '', data = '' } = {}) {
  const optionMarkup = options.map(option => {
    const item = typeof option === 'string' ? { value: option, label: option } : option;
    return `<option value="${escapeHtml(item.value ?? '')}" ${String(item.value ?? '') === String(value ?? '') ? 'selected' : ''}>${escapeHtml(item.label ?? item.value ?? '')}</option>`;
  }).join('');
  return `<label class="field ui-select ${className}">${label ? `<span>${escapeHtml(label)}</span>` : ''}<span class="ui-select__control"><select ${name ? `name="${escapeHtml(name)}"` : ''} ${aria ? `aria-label="${escapeHtml(aria)}"` : ''} ${data}>${optionMarkup}</select></span></label>`;
}
