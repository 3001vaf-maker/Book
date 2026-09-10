import { escapeHtml } from '../utils/escape-html.js';

export function page(blocks = []) {
  return `<div class="ui-page">${blocks.filter(Boolean).join('')}</div>`;
}

export function details(items = []) {
  const values = (Array.isArray(items) ? items : []).filter(Boolean);
  if (!values.length) return '';
  return `<div class="entity-details">${values.map(({ label = '', value = '—' }) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value === '' || value == null ? '—' : value)}</strong></div>`).join('')}</div>`;
}

export function agreementBlock(items = []) {
  return `<section class="agreements-summary">${items.map(({ label, value, checked, data = '', aria = '', interactive = false }) => {
    const isChecked = typeof checked === 'boolean' ? checked : value === true || value === 'Дано';
    const content = `<span>${escapeHtml(label)}</span><strong class="agreement-status" aria-label="${isChecked ? 'Дано' : 'Не дано'}">${isChecked ? '☑' : '□'}</strong>`;
    if (interactive || data) return `<button type="button"${data ? ` ${data}` : ''}${aria ? ` aria-label="${escapeHtml(aria)}"` : ''}>${content}</button>`;
    return `<div>${content}</div>`;
  }).join('')}</section>`;
}

export function actionBlock(content = '', { className = '' } = {}) {
  return `<div class="profile-actions${className ? ` ${escapeHtml(className)}` : ''}">${content}</div>`;
}
