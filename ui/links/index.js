const escape = (v = '') => String(v).replace(/[&<>\"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[c]));
export const WORK_LINK_TYPES = ['Instagram', 'ВКонтакте', 'YouTube', 'Facebook', 'Сайт', 'Другое'];

export function workLinks({ links = [], name = 'links', selectRenderer } = {}) {
  const renderSelect = selectRenderer || (({ value }) => `<select name="linkType"><option value="${escape(value)}">${escape(value)}</option></select>`);
  const rows = links.length ? links : [{ type: 'Instagram', url: '' }];
  return `<div class="work-links" data-work-links="${escape(name)}">${rows.map((link) => linkRow(link, renderSelect)).join('')}</div>`;
}

function linkRow(link = {}, renderSelect) {
  return `<div class="array-row link-row" data-work-link-row>${renderSelect({ name:'linkType', value:link.type||'Instagram', options:WORK_LINK_TYPES })}<input name="linkUrl" value="${escape(link.url||'')}" placeholder="URL"><button type="button" class="remove-button" data-remove-work-link aria-label="Удалить ссылку">×</button></div>`;
}

export function initWorkLinks(root, selectRenderer) {
  root.querySelectorAll('[data-add-work-link]').forEach((add) => add.addEventListener('click', () => {
    const host = root.querySelector(`[data-work-links="${CSS.escape(add.dataset.addWorkLink)}"]`);
    if (host) host.insertAdjacentHTML('beforeend', linkRow({}, selectRenderer));
  }));
  root.querySelectorAll('[data-work-links]').forEach((host) => host.addEventListener('click', (event) => {
    if (event.target.closest('[data-remove-work-link]')) event.target.closest('[data-work-link-row]')?.remove();
  }));
}

export function collectWorkLinks(root, name = 'links') {
  return [...root.querySelectorAll(`[data-work-links="${CSS.escape(name)}"] [data-work-link-row]`)].map((row) => ({ type:row.querySelector('[name="linkType"]')?.value||'', url:row.querySelector('[name="linkUrl"]')?.value.trim()||'' })).filter((link) => link.url);
}
