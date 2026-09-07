import { escapeHtml } from '../utils/escape-html.js';

export function pageHeader(title, subtitle = '', meta = '') {
  return `<header class="page-header"><div class="page-header__main"><h1>${escapeHtml(title)}</h1>${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}</div>${meta ? `<div class="page-header__meta">${meta}</div>` : ''}</header>`;
}

export function page(blocks = []) {
  return `<div class="ui-page">${blocks.filter(Boolean).join('')}</div>`;
}

export function details(items = []) {
  const values = (Array.isArray(items) ? items : []).filter(Boolean);
  if (!values.length) return '';
  return `<div class="entity-details">${values.map(({ label = '', value = '—' }) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value === '' || value == null ? '—' : value)}</strong></div>`).join('')}</div>`;
}

export function agreementBlock(items = []) {
  return `<section class="agreements-summary">${items.map(({ label, value, checked }) => {
    const isChecked = typeof checked === 'boolean' ? checked : value === true || value === 'Дано';
    return `<div><span>${escapeHtml(label)}</span><strong class="agreement-status" aria-label="${isChecked ? 'Дано' : 'Не дано'}">${isChecked ? '☑' : '□'}</strong></div>`;
  }).join('')}</section>`;
}

export function actionBlock(content = '', { className = '' } = {}) {
  return `<div class="profile-actions${className ? ` ${escapeHtml(className)}` : ''}">${content}</div>`;
}
