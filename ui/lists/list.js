import { escapeHtml } from '../utils/escape-html.js';

/**
 * Canonical Core UI List.
 *
 * Secondary-value rule:
 * - first secondary value belongs under the title;
 * - additional secondary values belong to the right side of the item.
 * The List remains generic and does not know what the values represent.
 */
export function list({ items = [], className = '' } = {}) {
  const listItems = Array.isArray(items) ? items : [];

  return `<div class="ui-list${className ? ` ${escapeHtml(className)}` : ''}" data-ui-list>${listItems.map((item = {}, index) => {
    const secondary = Array.isArray(item.secondary)
      ? item.secondary.filter((value) => value !== null && value !== undefined && String(value) !== '')
      : (item.secondary === null || item.secondary === undefined || String(item.secondary) === '' ? [] : [item.secondary]);
    const primarySecondary = secondary[0] ?? '';
    const rightSecondary = secondary.slice(1);
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
      `<span class="ui-list__main"><span class="ui-list__title">${escapeHtml(item.title ?? '')}</span>` +
      (primarySecondary ? `<span class="ui-list__secondary">${escapeHtml(primarySecondary)}</span>` : '') +
      `</span>` +
      (rightSecondary.length ? `<span class="ui-list__right-secondary">${rightSecondary.map((value) => `<span>${escapeHtml(value)}</span>`).join('')}</span>` : '') +
      `</${tag}>`;
  }).join('')}</div>`;
}