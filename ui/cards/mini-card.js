import { escapeHtml } from '../utils/escape-html.js';

function attrs(data = '', aria = '') {
  return `${data ? ` ${String(data).trim()}` : ''}${aria ? ` aria-label="${escapeHtml(aria)}"` : ''}`;
}

function rowMarkup(row = {}) {
  const label = escapeHtml(row.label || '');
  const value = row.checked === true ? '✓' : row.checked === false ? '—' : escapeHtml(row.value || '');
  const content = `<span class="mini-card__row-label">${label}</span><strong class="mini-card__row-value">${value}</strong>`;
  if (row.data) {
    return `<button type="button" class="mini-card__row mini-card__row--action"${attrs(row.data, row.aria || row.label)}>${content}</button>`;
  }
  return `<div class="mini-card__row">${content}</div>`;
}

export function miniCard({
  title = '',
  value = '',
  subtitle = '',
  rows = [],
  interactive = false,
  data = '',
  aria = '',
  className = '',
} = {}) {
  const tag = interactive ? 'button' : 'section';
  const classes = ['mini-card', interactive ? 'mini-card--interactive' : '', className].filter(Boolean).join(' ');
  const actionAttrs = interactive ? ` type="button"${attrs(data, aria || title)}` : '';
  const rowItems = Array.isArray(rows) ? rows : [];
  return `<${tag} class="${escapeHtml(classes)}"${actionAttrs}>
    <span class="mini-card__head">
      <strong class="mini-card__title">${escapeHtml(title)}</strong>
      ${value ? `<strong class="mini-card__value">${escapeHtml(value)}</strong>` : ''}
      ${subtitle ? `<span class="mini-card__subtitle">${escapeHtml(subtitle)}</span>` : ''}
    </span>
    ${rowItems.length ? `<span class="mini-card__rows">${rowItems.map(rowMarkup).join('')}</span>` : ''}
  </${tag}>`;
}
