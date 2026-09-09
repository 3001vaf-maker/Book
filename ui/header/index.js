import { modal, mountModal } from '../modals/index.js';
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
 * It owns only the stable Header Control shell and knows nothing about the
 * UI content rendered inside it.
 */
export function headerControl(content = '', { data = '', aria = '', className = '', indicator = '⌄' } = {}) {
  const classes = ['header-control', className].filter(Boolean).map(escapeHtml).join(' ');
  const dataAttrs = data ? ` ${data}` : '';
  const ariaAttr = aria ? ` aria-label="${escapeHtml(aria)}"` : '';
  const indicatorMarkup = indicator === '' ? '' : `<span class="header-control__indicator" aria-hidden="true">${escapeHtml(indicator)}</span>`;
  return `<button type="button" class="${classes}" data-header-control${dataAttrs}${ariaAttr}><span class="header-control__content">${content}</span>${indicatorMarkup}</button>`;
}

/**
 * Canonical compact two-or-more option toggle for page headers.
 */
export function headerToggle({ items = [], activeId = '', data = 'data-header-toggle' } = {}) {
  const buttons = (Array.isArray(items) ? items : []).map((item) => {
    const id = String(item?.id || '');
    const active = id === String(activeId || '');
    return `<button type="button" class="header-toggle__item${active ? ' is-active' : ''}" ${data}="${escapeHtml(id)}" aria-pressed="${active}">${escapeHtml(item?.label || id)}</button>`;
  }).join('');
  return `<div class="header-toggle" role="group">${buttons}</div>`;
}

/**
 * Canonical grouping for more than one header control block.
 */
export function headerControlGroup(items = []) {
  return `<div class="header-control-group">${(Array.isArray(items) ? items : []).filter(Boolean).join('')}</div>`;
}

/**
 * Canonical manifestation of Header Control.
 * Every Header Control opens the same medium modal shell; the caller only
 * supplies the UI content placed inside that shell.
 */
export function openHeaderControl(content = '', { title = '', className = '' } = {}) {
  return mountModal(document.body, modal(String(content || ''), {
    title,
    className,
    variant: 'medium',
  }));
}
