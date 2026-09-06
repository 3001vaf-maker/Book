import { escapeHtml } from '../utils/escape-html.js';

export function folderCard({ title = '', meta = '', icon = '', count = '', data = '', aria = '' } = {}) {
  return `<button class="ui-folder-card" type="button"${data ? ` ${data}` : ''}${aria ? ` aria-label="${escapeHtml(aria)}"` : ''}><span class="ui-folder-card__top"><span class="ui-folder-card__icon">${escapeHtml(icon)}</span>${count !== '' ? `<span class="ui-folder-card__count">${escapeHtml(count)}</span>` : ''}</span><span class="ui-folder-card__title">${escapeHtml(title)}</span>${meta ? `<span class="ui-folder-card__meta">${escapeHtml(meta)}</span>` : ''}</button>`;
}
