import { button } from '../buttons/index.js';
import { escapeHtml } from '../utils/escape-html.js';

function text(value = '') {
  return escapeHtml(String(value ?? ''));
}

export function readOnlyReceipt({
  title = '',
  status = '',
  date = '',
  time = '',
  items = [],
  totals = [],
  action = null,
} = {}) {
  return `<section class="read-only-sheet" data-read-only-sheet>
    <header class="read-only-sheet__header"><h2>${text(title)}</h2><div class="read-only-sheet__meta"><strong>${text(status)}</strong><span>${text(date)}</span><span>${text(time)}</span></div></header>
    <div class="read-only-sheet__items">${(Array.isArray(items) ? items : []).map((item) => `<div class="read-only-sheet__row"><span>${text(item.label)}</span><strong>${text(item.value)}</strong></div>`).join('')}</div>
    <div class="read-only-sheet__totals">${(Array.isArray(totals) ? totals : []).map((item) => `<div class="read-only-sheet__row${item.strong ? ' is-strong' : ''}"><span>${text(item.label)}</span><strong>${text(item.value)}</strong></div>`).join('')}</div>
    ${action ? `<div class="read-only-sheet__action">${button(text(action.label || ''), { data: action.data || '', aria: action.aria || action.label || '' })}</div>` : ''}
  </section>`;
}
