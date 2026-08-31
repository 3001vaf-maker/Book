import { accordion, initAccordions } from './accordion/accordion.js';
import { bottomNavigation } from './navigation/navigation.js';
import { entityCard } from './cards/index.js';
import { select } from './selectors/index.js';

const escapeMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
export const escapeHtml = (v = '') => String(v).replace(/[&<>"']/g, (c) => escapeMap[c]);
export { accordion, initAccordions, bottomNavigation, entityCard, select };

export function pageHeader(title, subtitle = '') {
  return `<header class="page-header"><h1>${escapeHtml(title)}</h1>${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}</header>`;
}

export function button(label, { className = '', data = '', type = 'button', aria = '' } = {}) {
  return `<button type="${type}" class="ui-button ${className}" ${data}${aria ? ` aria-label="${escapeHtml(aria)}"` : ''}>${label}</button>`;
}

export function iconButton(label, { className = '', data = '', aria = label } = {}) {
  return `<button type="button" class="icon-button ${className}" ${data} aria-label="${escapeHtml(aria)}">${label}</button>`;
}

export function field({ label, name, value = '', type = 'text', placeholder = '', required = false, readonly = false, inputmode = '' }) {
  return `<label class="field"><span>${escapeHtml(label)}</span><input name="${escapeHtml(name)}" type="${type}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" ${required ? 'required' : ''} ${readonly ? 'readonly' : ''} ${inputmode ? `inputmode="${inputmode}"` : ''}></label>`;
}

export function phoneField({ label = 'Телефон', name = 'phone', value = '', required = false } = {}) {
  return field({ label, name, value, type: 'tel', required, inputmode: 'tel', placeholder: '+7' });
}

export function searchableSelect({ label, name, value = '', options = [], placeholder = 'Начните вводить', required = false } = {}) {
  const id = `search-${name}-${Math.random().toString(36).slice(2, 8)}`;
  const opts = options.map((option) => {
    const item = typeof option === 'string' ? { value: option, label: option } : option;
    return `<option value="${escapeHtml(item.value)}">${escapeHtml(item.label)}</option>`;
  }).join('');
  return `<label class="field searchable-select"><span>${escapeHtml(label)}</span><input list="${id}" name="${escapeHtml(name)}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" ${required ? 'required' : ''} autocomplete="off"><datalist id="${id}">${opts}</datalist></label>`;
}

export function timeInput({ label, name, value = '' } = {}) {
  return field({ label, name, value, type: 'time' });
}

export function photoField({ name = 'photo', value = '' } = {}) {
  const preview = value ? `<div class="photo-field__preview" style="background-image:url('${escapeHtml(value)}')" aria-hidden="true"></div>` : '<div class="photo-field__preview photo-field__preview--empty" aria-hidden="true">Фото</div>';
  return `<div class="photo-field" data-photo-field><span class="photo-field__label">Фото</span><label class="photo-field__control">${preview}<span class="photo-field__action">${value ? 'Изменить фото' : 'Добавить фото'}</span><input type="file" accept="image/*" data-photo-input></label>${value ? '<button type="button" class="ui-button ui-button--small photo-field__remove" data-photo-remove>Удалить фото</button>' : ''}<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}" data-photo-value></div>`;
}

export function emptyState(title, text = '') {
  return `<div class="empty-state"><strong>${escapeHtml(title)}</strong>${text ? `<span>${escapeHtml(text)}</span>` : ''}</div>`;
}

export function modal(content, { title = '' } = {}) {
  return `<div class="modal-backdrop" data-modal><div class="modal-sheet" role="dialog" aria-modal="true" ${title ? `aria-label="${escapeHtml(title)}"` : ''}><button type="button" class="modal-close" data-modal-close aria-label="Закрыть">×</button>${content}</div></div>`;
}

export function mountModal(root, html) {
  const mount = root;
  mount.insertAdjacentHTML('beforeend', html);
  const m = mount.querySelector('[data-modal]:last-of-type');
  m?.addEventListener('click', (e) => {
    if (e.target.matches('[data-modal],[data-modal-close]')) m.remove();
  });
  requestAnimationFrame(() => m?.querySelector('input,select,textarea,button:not([data-modal-close])')?.focus());
  return m;
}
