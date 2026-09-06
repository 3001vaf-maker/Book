import { escapeHtml } from '../utils/escape-html.js';

export function page(blocks = []) {
  return `<div class="ui-page">${blocks.filter(Boolean).join('')}</div>`;
}

export function agreementBlock(items = []) {
  return `<section class="agreements-summary">${items.map(({ label, value }) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('')}</section>`;
}

export function actionBlock(content = '') {
  return `<div class="profile-actions">${content}</div>`;
}
