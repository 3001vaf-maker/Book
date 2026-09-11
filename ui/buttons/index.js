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

export function copyIconButton({ data = '', aria = 'Скопировать' } = {}) {
  return `<button type="button" class="icon-button copy-icon-button" ${data} aria-label="${escapeHtml(aria)}"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2"></rect><path d="M16 8V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h1"></path></svg><span class="copy-icon-button__done" aria-hidden="true">✓</span></button>`;
}

export function setCopyButtonCopied(button, { timeout = 1400 } = {}) {
  if (!(button instanceof HTMLElement)) return;
  const previousAria = button.getAttribute('aria-label') || 'Скопировать';
  button.classList.add('is-copied');
  button.setAttribute('aria-label', 'Скопировано');
  window.setTimeout(() => {
    button.classList.remove('is-copied');
    button.setAttribute('aria-label', previousAria);
  }, Math.max(300, Number(timeout) || 1400));
}

export async function copyTextToClipboard(value) {
  const text = String(value ?? '');
  if (!text) return false;
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  return copied;
}

export function sheetIconButton({ data = '', aria = 'Открыть список' } = {}) {
  return iconButton('▤', { className: 'sheet-icon-button', data, aria });
}

export function iconButtonGroup(items = []) {
  return `<div class="icon-button-group">${items.join('')}</div>`;
}