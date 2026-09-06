import { escapeHtml } from '../utils/escape-html.js';
import { button } from '../buttons/index.js';

const UEI_PATTERN = '[A-Za-zА-Яа-яЁё0-9]{0,4}';

function optionMarkup(options = [], value = '') {
  return options.map((option) => {
    const item = typeof option === 'string'
      ? { value: option, label: option }
      : option || {};
    const itemValue = String(item.value ?? '');
    const itemLabel = String(item.label ?? item.value ?? '');
    return `<option value="${escapeHtml(itemValue)}" ${itemValue === String(value ?? '') ? 'selected' : ''}>${escapeHtml(itemLabel)}</option>`;
  }).join('');
}

function selectField({ label, name, value = '', options = [], placeholder = '' } = {}) {
  const placeholderMarkup = placeholder
    ? `<option value="" ${value ? '' : 'selected'} disabled>${escapeHtml(placeholder)}</option>`
    : '';
  return `<label class="field ui-select"><span>${escapeHtml(label)}</span><span class="ui-select__control"><select name="${escapeHtml(name)}" data-uei-field="${escapeHtml(name)}">${placeholderMarkup}${optionMarkup(options, value)}</select></span></label>`;
}

/**
 * Universal UEI UI.
 *
 * The component is entity-agnostic. It only renders the common UEI controls;
 * lifecycle and merge rules belong to Core/domain logic.
 *
 * @param {Object} options
 * @param {string} [options.value=''] Current UEI value.
 * @param {Array<string|{value:string,label:string}>} [options.existing=[]] Existing UEIs available for manual linking.
 * @param {Array<string|{value:string,label:string}>} [options.detachable=[]] Profiles/records currently linked to this UEI.
 * @param {string} [options.linkValue=''] Pending existing UEI selection.
 * @param {string} [options.detachValue=''] Pending detach selection.
 * @param {boolean} [options.showApply=true] Show the standalone Apply action.
 * @returns {string} HTML
 */
export function uei({
  value = '',
  existing = [],
  detachable = [],
  linkValue = '',
  detachValue = '',
  showApply = true,
} = {}) {
  const detachMarkup = detachable.length > 1
    ? selectField({
        label: 'Отвязать',
        name: 'ueiDetach',
        value: detachValue,
        options: detachable,
        placeholder: 'Выберите сущность',
      })
    : '';

  const applyMarkup = showApply
    ? button('Применить', { data: 'data-uei-apply' })
    : '';

  return `<section class="ui-uei" data-uei>
    <label class="field ui-uei__value">
      <span>UEI</span>
      <input name="uei" value="${escapeHtml(value)}" maxlength="4" pattern="${UEI_PATTERN}" inputmode="text" autocomplete="off" data-uei-field="uei" aria-label="UEI">
    </label>
    ${selectField({
      label: 'Связать',
      name: 'ueiLink',
      value: linkValue,
      options: existing,
      placeholder: 'Выберите UEI',
    })}
    ${detachMarkup}
    ${applyMarkup}
  </section>`;
}

export { UEI_PATTERN };
