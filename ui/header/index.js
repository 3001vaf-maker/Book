import { escapeHtml } from '../utils/escape-html.js';

/**
 * Canonical clickable control placed inside page headers.
 * The control owns only header geometry/interaction shell and knows nothing
 * about the UI content rendered inside it.
 */
export function headerControl(content = '', { data = '', aria = '', className = '', indicator = '⌄' } = {}) {
  const classes = ['header-control', className].filter(Boolean).map(escapeHtml).join(' ');
  const dataAttrs = data ? ` ${data}` : '';
  const ariaAttr = aria ? ` aria-label="${escapeHtml(aria)}"` : '';
  const indicatorMarkup = indicator === '' ? '' : `<span class="header-control__indicator" aria-hidden="true">${escapeHtml(indicator)}</span>`;
  return `<button type="button" class="${classes}" data-header-control${dataAttrs}${ariaAttr}><span class="header-control__content">${content}</span>${indicatorMarkup}</button>`;
}
