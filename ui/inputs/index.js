import { escapeHtml } from '../utils/escape-html.js';
import { button } from '../buttons/index.js';
import { select } from '../selectors/index.js';
import { phoneCountryOptions, phoneInputState } from '../../core/phone/index.js';

let phoneInputId = 0;
let phoneEventsReady = false;

function labelText(label, required) {
  const value = String(label || '');
  return required && value && !value.trim().endsWith('*') ? `${value} *` : value;
}

function phoneCountryLabel(iso) {
  return phoneCountryOptions().find((option) => option.value === iso)?.label || iso;
}

function setPhoneCountry(host, iso) {
  const countryInput = host?.querySelector('input[data-phone-country]');
  const trigger = countryInput?.closest('.ui-select')?.querySelector('[data-ui-select-trigger]');
  if (!countryInput || !trigger) return;
  countryInput.value = iso;
  const valueNode = trigger.querySelector('.ui-select__value');
  if (valueNode) valueNode.textContent = phoneCountryLabel(iso);
}

function syncPhoneHost(host, rawValue, { detectCountry = true } = {}) {
  if (!host) return;
  const nationalInput = host.querySelector('[data-phone-national]');
  const valueInput = host.querySelector('[data-phone-value]');
  const countryInput = host.querySelector('input[data-phone-country]');
  if (!nationalInput || !valueInput || !countryInput) return;

  const raw = String(rawValue ?? nationalInput.value ?? '');
  const state = phoneInputState(raw, countryInput.value || 'RU');
  if (detectCountry && state.countryIso !== countryInput.value) setPhoneCountry(host, state.countryIso);

  nationalInput.value = state.displayNational;
  valueInput.value = state.canonical;
  const requiredError = nationalInput.required && !state.complete;
  nationalInput.setCustomValidity(requiredError ? 'Введите номер телефона полностью.' : '');
}

function ensurePhoneEvents() {
  if (phoneEventsReady || typeof document === 'undefined') return;
  phoneEventsReady = true;

  document.addEventListener('input', (event) => {
    const input = event.target.closest?.('[data-phone-national]');
    if (!input) return;
    syncPhoneHost(input.closest('[data-phone-input]'), input.value, { detectCountry: true });
  });

  document.addEventListener('change', (event) => {
    const country = event.target.closest?.('input[data-phone-country]');
    if (country) {
      const host = country.closest('[data-phone-input]');
      const national = host?.querySelector('[data-phone-national]');
      syncPhoneHost(host, national?.value || '', { detectCountry: false });
      return;
    }

    const national = event.target.closest?.('[data-phone-national]');
    if (national) syncPhoneHost(national.closest('[data-phone-input]'), national.value, { detectCountry: true });
  });
}

export function field({ label = '', name = '', value = '', type = 'text', placeholder = '', required = false, readonly = false, inputmode = '', maxlength = '', autocomplete = '', data = '' } = {}) {
  return `<label class="field"><span>${escapeHtml(labelText(label, required))}</span><input name="${escapeHtml(name)}" type="${escapeHtml(type)}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}"${required ? ' required' : ''}${readonly ? ' readonly' : ''}${inputmode ? ` inputmode="${escapeHtml(inputmode)}"` : ''}${maxlength !== '' ? ` maxlength="${escapeHtml(maxlength)}"` : ''}${autocomplete ? ` autocomplete="${escapeHtml(autocomplete)}"` : ''}${data ? ` ${data}` : ''}></label>`;
}

export function phoneInput({ name = 'phone', value = '', required = false, aria = 'Телефон' } = {}) {
  ensurePhoneEvents();
  const state = phoneInputState(value, 'RU');
  const countryName = `${name}Country${++phoneInputId}`;
  const countrySelect = select({
    name: countryName,
    value: state.countryIso,
    options: phoneCountryOptions(),
    aria: 'Страна и код телефона',
    className: 'phone-input__country',
    data: 'data-phone-country',
    searchable: true,
  });
  return `<div class="phone-input" data-phone-input>${countrySelect}<input class="phone-input__national" type="tel" value="${escapeHtml(state.displayNational)}" placeholder="903 123-45-67" inputmode="tel" autocomplete="tel" data-phone-national aria-label="${escapeHtml(aria)}"${required ? ' required' : ''}><input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(state.canonical)}" data-phone-value></div>`;
}

export function phoneField({ label = 'Телефон', name = 'phone', value = '', required = false } = {}) {
  return `<div class="field phone-field"><span>${escapeHtml(labelText(label, required))}</span>${phoneInput({ name, value, required, aria: label })}</div>`;
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
