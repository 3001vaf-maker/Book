import { escapeHtml } from '../utils/escape-html.js';

/**
 * Canonical page header.
 * The optional meta slot accepts already assembled shared UI, including
 * headerControl().
 */
export function pageHeader(title, subtitle = '', meta = '') {
  return `<header class="page-header"><div class="page-header__main"><h1>${escapeHtml(title)}</h1>${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}</div>${meta ? `<div class="page-header__meta">${meta}</div>` : ''}</header>`;
}

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
