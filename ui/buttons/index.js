import { escapeHtml } from '../utils/escape-html.js';

const BUTTON_VARIANTS = {
  secondary: 'ui-button--secondary',
  danger: 'ui-button--danger',
};

export function button(label, { className = '', data = '', type = 'button', aria = '', variant = '' } = {}) {
  const variantClass = BUTTON_VARIANTS[variant] || '';
  return `<button type="${type}" class="ui-button ${variantClass} ${className}" ${data}${aria ? ` aria-label="${escapeHtml(aria)}"` : ''}>${label}</button>`;
}

export function iconButton(label, { className = '', data = '', aria = label } = {}) {
  return `<button type="button" class="icon-button ${className}" ${data} aria-label="${escapeHtml(aria)}">${label}</button>`;
}
