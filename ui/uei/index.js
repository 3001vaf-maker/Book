import { escapeHtml } from '../utils/escape-html.js';
import { button } from '../buttons/index.js';

const UEI_PATTERN = '[A-Za-zА-Яа-яЁё0-9]{0,4}';

function optionMarkup(options = [], value = '') {
  return options.map((option) => {
    const item = typeof option === 'string' ? { value: option, label: option } : option || {};
    const itemValue = String(item.value ?? '');
    const itemLabel = String(item.label ?? item.value ?? '');
    return `<option value="${escapeHtml(itemValue)}" ${itemValue === String(value ?? '') ? 'selected' : ''}>${escapeHtml(itemLabel)}</option>`;
  }).join('');
}

function selectField({ label, name, value = '', options = [], placeholder = '' } = {}) {
  const placeholderMarkup = placeholder ? `<option value="" ${value ? '' : 'selected'} disabled>${escapeHtml(placeholder)}</option>` : '';
  return `<label class="field ui-select"><span>${escapeHtml(label)}</span><span class="ui-select__control"><select name="${escapeHtml(name)}" data-uei-field="${escapeHtml(name)}">${placeholderMarkup}${optionMarkup(options, value)}</select></span></label>`;
}

export function uei({ value = '', existing = [], detachable = [], linkValue = '', detachValue = '', showApply = true } = {}) {
  const detachMarkup = detachable.length > 1 ? selectField({ label: 'Отвязать', name: 'ueiDetach', value: detachValue, options: detachable, placeholder: 'Выберите сущность' }) : '';
  const applyMarkup = showApply ? button('Применить', { data: 'data-uei-apply' }) : '';
  return `<section class="ui-uei" data-uei>
    <label class="field ui-uei__value">
      <span>UEI</span>
      <input name="uei" value="${escapeHtml(value)}" maxlength="4" pattern="${UEI_PATTERN}" inputmode="text" autocomplete="off" data-uei-field="uei" aria-label="UEI">
    </label>
    ${selectField({ label: 'Связать', name: 'ueiLink', value: linkValue, options: existing, placeholder: 'Выберите UEI' })}
    ${detachMarkup}
    ${applyMarkup}
  </section>`;
}

export function initUEI(root) {
  root.querySelectorAll('[data-uei]').forEach((ueiRoot) => {
    const input = ueiRoot.querySelector('[name="uei"]');
    if (!input) return;
    input.addEventListener('input', () => {
      input.value = Array.from(String(input.value || ''))
        .filter(char => /[A-Za-zА-Яа-яЁё0-9]/.test(char))
        .slice(0, 4)
        .join('')
        .toUpperCase();
    });
  });
}

export { UEI_PATTERN };
