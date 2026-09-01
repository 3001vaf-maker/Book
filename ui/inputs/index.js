import { escapeHtml } from '../utils/escape-html.js';

export function field({ label, name, value = '', type = 'text', placeholder = '', required = false, readonly = false, inputmode = '' }) {
  return `<label class="field"><span>${escapeHtml(label)}</span><input name="${escapeHtml(name)}" type="${type}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" ${required ? 'required' : ''} ${readonly ? 'readonly' : ''} ${inputmode ? `inputmode="${escapeHtml(inputmode)}"` : ''}></label>`;
}

export function phoneField({ label = 'Телефон', name = 'phone', value = '', required = false } = {}) {
  return field({ label, name, value, type: 'tel', required, inputmode: 'tel', placeholder: '+7' });
}

export function textareaField({ label, name, value = '', placeholder = '', required = false, rows = 4 } = {}) {
  return `<label class="field"><span>${escapeHtml(label)}</span><textarea name="${escapeHtml(name)}" rows="${rows}" placeholder="${escapeHtml(placeholder)}" ${required ? 'required' : ''}>${escapeHtml(value)}</textarea></label>`;
}
