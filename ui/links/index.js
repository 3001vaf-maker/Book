import { escapeHtml } from '../utils/escape-html.js';
import { select } from '../selectors/index.js';

export const LINK_TYPES = ['Instagram', 'ВКонтакте', 'YouTube', 'Facebook', 'Сайт', 'Другое'];

function linkRow(link = {}) {
  return `<div class="array-row link-row" data-link-row>${select({ name:'linkType', value:link.type||'Instagram', options:LINK_TYPES })}<input name="linkUrl" value="${escapeHtml(link.url||'')}" placeholder="URL"><button type="button" class="remove-button" data-remove-link aria-label="Удалить ссылку">×</button></div>`;
}

export function links({ links: values = [], name = 'links' } = {}) {
  const rows = values.length ? values : [{ type: 'Instagram', url: '' }];
  return `<div class="ui-links" data-links="${escapeHtml(name)}">${rows.map(linkRow).join('')}</div>`;
}

export function initLinks(root) {
  root.querySelectorAll('[data-add-link]').forEach((add) => {
    if (add.dataset.linksReady === 'true') return;
    add.dataset.linksReady = 'true';
    add.addEventListener('click', () => {
      const host = root.querySelector(`[data-links="${CSS.escape(add.dataset.addLink)}"]`);
      if (host) host.insertAdjacentHTML('beforeend', linkRow());
    });
  });

  root.querySelectorAll('[data-links]').forEach((host) => {
    if (host.dataset.linksReady === 'true') return;
    host.dataset.linksReady = 'true';
    host.addEventListener('click', (event) => {
      if (event.target.closest('[data-remove-link]')) event.target.closest('[data-link-row]')?.remove();
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

// Compatibility aliases: old consumers use the same shared Links UI, never a parallel selector.
export const WORK_LINK_TYPES = LINK_TYPES;
export function workLinks({ links: values = [], name = 'links' } = {}) { return links({ links: values, name }); }
export function initWorkLinks(root) {
  root.querySelectorAll('[data-add-work-link]').forEach((add) => {
    add.dataset.addLink = add.dataset.addWorkLink;
    add.setAttribute('data-add-link', '');
  });
  initLinks(root);
}
export function collectWorkLinks(root, name = 'links') { return collectLinks(root, name); }
