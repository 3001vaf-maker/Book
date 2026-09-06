import { button } from '../buttons/index.js';
import { escapeHtml } from '../utils/escape-html.js';
import { select } from '../selectors/index.js';

export const LINK_TYPES = ['Instagram', 'ВКонтакте', 'YouTube', 'Facebook', 'Сайт', 'Другое'];

function linkRow(link = {}) {
  return `<div class="array-group link-row" data-link-row>${select({ name:'linkType', value:link.type||'Instagram', options:LINK_TYPES })}<div class="array-row"><input name="linkUrl" value="${escapeHtml(link.url||'')}" placeholder="URL"><button type="button" class="remove-button" data-remove-link aria-label="Удалить ссылку">🗑</button></div></div>`;
}

export function links({ links: values = [], name = 'links' } = {}) {
  const rows = values.length ? values : [{ type: 'Instagram', url: '' }];
  return `<div class="ui-links array-group" data-links="${escapeHtml(name)}"><div data-links-list>${rows.map(linkRow).join('')}</div>${button('+ Добавить ссылку',{className:'ui-button--small',data:`data-add-link="${escapeHtml(name)}"`})}</div>`;
}

export function initLinks(root) {
  root.querySelectorAll('[data-links]').forEach((host) => {
    if (host.dataset.linksReady === 'true') return;
    host.dataset.linksReady = 'true';
    host.addEventListener('click', (event) => {
      const remove = event.target.closest('[data-remove-link]');
      if (remove) {
        remove.closest('[data-link-row]')?.remove();
        return;
      }
      const add = event.target.closest('[data-add-link]');
      if (!add) return;
      host.querySelector('[data-links-list]')?.insertAdjacentHTML('beforeend', linkRow());
    });
  });
}

export function collectLinks(root, name = 'links') {
  return [...root.querySelectorAll(`[data-links="${CSS.escape(name)}"] [data-link-row]`)]
    .map((row) => ({
      type: row.querySelector('[name="linkType"]')?.value || '',
      url: row.querySelector('[name="linkUrl"]')?.value.trim() || '',
    }))
    .filter((link) => link.url);
}
