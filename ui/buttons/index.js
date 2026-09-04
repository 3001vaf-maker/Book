import { escapeHtml } from '../utils/escape-html.js';

export function button(label, { className = '', data = '', type = 'button', aria = '' } = {}) {
  return `<button type="${type}" class="ui-button ${className}" ${data}${aria ? ` aria-label="${escapeHtml(aria)}"` : ''}>${label}</button>`;
}

export function iconButton(label, { className = '', data = '', aria = label } = {}) {
  return `<button type="button" class="icon-button ${className}" ${data} aria-label="${escapeHtml(aria)}">${label}</button>`;
}
