import { escapeHtml } from '../utils/escape-html.js';

function attrs(value = '') {
  const source = String(value || '').trim();
  return source ? ` ${source}` : '';
}

export function formView(content = '', { className = '', data = '', novalidate = true } = {}) {
  const classes = String(className || '').trim();
  return `<form${classes ? ` class="${escapeHtml(classes)}"` : ''}${attrs(data)}${novalidate ? ' novalidate' : ''}>${String(content || '')}</form>`;
}

export function formError(message = '', { data = '' } = {}) {
  const value = String(message || '').trim();
  const dataAttrs = attrs(data);
  return `<div class="form-error"${dataAttrs} role="alert">${value ? escapeHtml(value) : ''}</div>`;
}
