import { escapeHtml } from '../utils/escape-html.js';

/**
 * Canonical Core UI List.
 *
 * The List renders a plain enumeration of requested values. It does not know
 * anything about Book entities. The caller supplies the primary title and any
 * requested secondary values; secondary values are always rendered visually
 * subordinate to the title.
 */
export function list({ items = [], className = '' } = {}) {
  const listItems = Array.isArray(items) ? items : [];

  return `<div class="ui-list${className ? ` ${escapeHtml(className)}` : ''}" data-ui-list>${listItems.map((item = {}, index) => {
    const title = item.title ?? '';
    const secondary = Array.isArray(item.secondary)
      ? item.secondary.filter((value) => value !== null && value !== undefined && String(value) !== '')
      : (item.secondary === null || item.secondary === undefined || String(item.secondary) === '' ? [] : [item.secondary]);
    const interactive = Boolean(item.interactive);
    const tag = interactive ? 'button' : 'div';
    const attrs = item.data || item.aria
      ? `${item.data ? ` ${item.data}` : ''}${item.aria ? ` aria-label="${escapeHtml(item.aria)}"` : ''}`
      : '';
    const classes = [
      'ui-list__item',
      item.className || '',
      item.selected ? 'is-selected' : '',
      index === 0 ? 'is-first' : '',
      index === listItems.length - 1 ? 'is-last' : ''
    ].filter(Boolean).join(' ');

    return `<${tag} class="${classes}"${interactive ? ` type="button"` : ''}${attrs}>` +
      `<span class="ui-list__title">${escapeHtml(title)}</span>` +
      (secondary.length ? `<span class="ui-list__secondary">${secondary.map((value) => `<span>${escapeHtml(value)}</span>`).join('')}</span>` : '') +
      `</${tag}>`;
  }).join('')}</div>`;
}
