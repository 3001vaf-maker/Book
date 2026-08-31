import { escapeHtml } from '../ui.js';
import { select } from '../selectors/index.js';

export const WORK_LINK_TYPES = ['Instagram', 'ВКонтакте', 'YouTube', 'Facebook', 'Сайт', 'Другое'];

export function workLinks({ links = [], name = 'links' } = {}) {
  const rows = links.length ? links : [{ type: 'Instagram', url: '' }];
  return `<div class="work-links" data-work-links="${escapeHtml(name)}">${rows.map(linkRow).join('')}</div>`;
}

function linkRow(link = {}) {
  return `<div class="array-row link-row" data-work-link-row>${select({ name: 'linkType', value: link.type || 'Instagram', options: WORK_LINK_TYPES })}<input name="linkUrl" value="${escapeHtml(link.url || '')}" placeholder="URL"><button type="button" class="remove-button" data-remove-work-link aria-label="Удалить ссылку">×</button></div>`;
}

export function initWorkLinks(root) {
  root.querySelectorAll('[data-add-work-link]').forEach((add) => {
    add.addEventListener('click', () => {
      const host = root.querySelector(`[data-work-links="${CSS.escape(add.dataset.addWorkLink)}"]`);
      if (host) host.insertAdjacentHTML('beforeend', linkRow());
    });
  });
  root.querySelectorAll('[data-work-links]').forEach((host) => {
    host.addEventListener('click', (event) => {
      if (event.target.closest('[data-remove-work-link]')) event.target.closest('[data-work-link-row]')?.remove();
    });
  });
}

export function collectWorkLinks(root, name = 'links') {
  return [...root.querySelectorAll(`[data-work-links="${CSS.escape(name)}"] [data-work-link-row]`)]
    .map((row) => ({ type: row.querySelector('[name="linkType"]')?.value || '', url: row.querySelector('[name="linkUrl"]')?.value.trim() || '' }))
    .filter((link) => link.url);
}
