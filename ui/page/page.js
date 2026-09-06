import { escapeHtml } from '../utils/escape-html.js';

export function page(blocks = []) {
  return `<div class="ui-page">${blocks.filter(Boolean).join('')}</div>`;
}

export function agreementBlock(items = []) {
  return `<section class="agreements-summary">${items.map(({ label, value, checked }) => {
    const isChecked = typeof checked === 'boolean' ? checked : value === true || value === 'Дано';
    return `<div><span>${escapeHtml(label)}</span><strong class="agreement-status" aria-label="${isChecked ? 'Дано' : 'Не дано'}">${isChecked ? '☑' : '□'}</strong></div>`;
  }).join('')}</section>`;
}

export function actionBlock(content = '') {
  return `<div class="profile-actions">${content}</div>`;
}
