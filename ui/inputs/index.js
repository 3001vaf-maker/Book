import { escapeHtml } from '../utils/escape-html.js';
import { button } from '../buttons/index.js';

function labelText(label, required) {
  const value = String(label || '');
  return required && value && !value.trim().endsWith('*') ? `${value} *` : value;
}

export function field({ label = '', name = '', value = '', type = 'text', placeholder = '', required = false, readonly = false, inputmode = '', maxlength = '', autocomplete = '', data = '' } = {}) {
  return `<label class="field"><span>${escapeHtml(labelText(label, required))}</span><input name="${escapeHtml(name)}" type="${escapeHtml(type)}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}"${required ? ' required' : ''}${readonly ? ' readonly' : ''}${inputmode ? ` inputmode="${escapeHtml(inputmode)}"` : ''}${maxlength !== '' ? ` maxlength="${escapeHtml(maxlength)}"` : ''}${autocomplete ? ` autocomplete="${escapeHtml(autocomplete)}"` : ''}${data ? ` ${data}` : ''}></label>`;
}

export function phoneField({ label = 'Телефон', name = 'phone', value = '', required = false } = {}) {
  return field({ label, name, value, type: 'tel', required, inputmode: 'tel', placeholder: '+7' });
}

export function textareaField({ label = '', name = '', value = '', placeholder = '', required = false, rows = 4, maxlength = '' } = {}) {
  return `<label class="field"><span>${escapeHtml(labelText(label, required))}</span><textarea name="${escapeHtml(name)}" rows="${escapeHtml(rows)}" placeholder="${escapeHtml(placeholder)}"${required ? ' required' : ''}${maxlength !== '' ? ` maxlength="${escapeHtml(maxlength)}"` : ''}>${escapeHtml(value)}</textarea></label>`;
}

export function photoField({ name = 'photo', value = '' } = {}) {
  const preview = value
    ? `<div class="photo-field__preview" style="background-image:url('${escapeHtml(value)}')" aria-hidden="true"></div>`
    : '<div class="photo-field__preview photo-field__preview--empty" aria-hidden="true">Фото</div>';
  return `<div class="photo-field" data-photo-field><span class="photo-field__label">Фото</span><label class="photo-field__control">${preview}<span class="photo-field__action">${value ? 'Изменить фото' : 'Добавить фото'}</span><input type="file" accept="image/*" data-photo-input></label>${value ? button('Удалить фото', { className: 'photo-field__remove', data: 'data-photo-remove', variant: 'secondary' }) : ''}<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}" data-photo-value></div>`;
}

export function initPhotoField(root) {
  root.querySelectorAll('[data-photo-field]').forEach((fieldRoot) => {
    const input = fieldRoot.querySelector('[data-photo-input]');
    const value = fieldRoot.querySelector('[data-photo-value]');
    const preview = fieldRoot.querySelector('.photo-field__preview');
    const action = fieldRoot.querySelector('.photo-field__action');
    if (!input || !value || !preview || !action) return;

    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        const src = String(reader.result || '');
        value.value = src;
        preview.classList.remove('photo-field__preview--empty');
        preview.style.backgroundImage = `url('${src.replaceAll("'", '%27')}')`;
        preview.textContent = '';
        action.textContent = 'Изменить фото';
        if (!fieldRoot.querySelector('[data-photo-remove]')) fieldRoot.insertAdjacentHTML('beforeend', button('Удалить фото', { className: 'photo-field__remove', data: 'data-photo-remove', variant: 'secondary' }));
        value.dispatchEvent(new Event('change', { bubbles: true }));
      });
      reader.readAsDataURL(file);
    });

    fieldRoot.addEventListener('click', (event) => {
      const remove = event.target.closest('[data-photo-remove]');
      if (!remove) return;
      value.value = '';
      input.value = '';
      preview.style.backgroundImage = '';
      preview.classList.add('photo-field__preview--empty');
      preview.textContent = 'Фото';
      action.textContent = 'Добавить фото';
      remove.remove();
      value.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });
}
