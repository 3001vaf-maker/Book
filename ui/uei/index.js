import { escapeHtml } from '../utils/escape-html.js';
import { button } from '../buttons/index.js';
import { select } from '../selectors/index.js';

const UEI_PATTERN = '[A-Za-zА-Яа-яЁё0-9]{0,4}';

export function uei({ value = '', existing = [], detachable = [], linkValue = '', detachValue = '', memberCount = 0, showApply = true } = {}) {
  const detachMarkup = detachable.length > 1
    ? select({ label: 'Отвязать', name: 'ueiDetach', value: detachValue, options: detachable })
    : '';
  const countMarkup = memberCount > 1 ? `<span class="ui-uei__count" aria-label="Количество профилей">${escapeHtml(memberCount)}</span>` : '';
  const applyMarkup = showApply ? button('Применить', { data: 'data-uei-apply' }) : '';
  return `<section class="ui-uei" data-uei>
    <label class="field ui-uei__value">
      <span>UEI</span>
      <span class="ui-uei__value-row"><input name="uei" value="${escapeHtml(value)}" maxlength="4" pattern="${UEI_PATTERN}" inputmode="text" autocomplete="off" data-uei-field="uei" aria-label="UEI">${countMarkup}</span>
    </label>
    ${select({ label: 'Связать', name: 'ueiLink', value: linkValue, options: existing })}
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
