import { escapeHtml } from '../utils/escape-html.js';
import { modal, mountModal } from '../modals/index.js';

export const COLOR_PALETTE = Object.freeze([
  '#F6D32D', '#F2C94C', '#F2994A', '#F08C46', '#E76F51',
  '#E63946', '#D62828', '#B42318', '#9B1C31', '#7F1D1D',
  '#FF6B9D', '#E64980', '#C2255C', '#A61E4D', '#7A284B',
  '#C77DFF', '#9D4EDD', '#7B2CBF', '#5A189A', '#3C096C',
  '#74C0FC', '#339AF0', '#1C7ED6', '#1864AB', '#0B3C5D',
  '#63E6BE', '#20C997', '#12B886', '#0F766E', '#0B7285',
  '#8CE99A', '#51CF66', '#37B24D', '#2B8A3E', '#1B5E20',
  '#DDB892', '#BC8A5F', '#9C6644', '#7F5539', '#5B4636',
  '#FFFFFF', '#E9ECEF', '#ADB5BD', '#6C757D', '#212529'
]);

export function colorPicker({ name = 'color', value = COLOR_PALETTE[0], colors = COLOR_PALETTE, required = false } = {}) {
  const palette = Array.isArray(colors) && colors.length ? colors : COLOR_PALETTE;
  const requested = String(value || '');
  const selected = palette.includes(requested) ? requested : (required ? '' : palette[0]);
  const swatchStyle = selected ? ` style="background:${escapeHtml(selected)}"` : '';
  const emptyClass = selected ? '' : ' is-empty';
  return `<div class="color-picker" data-color-picker data-color-name="${escapeHtml(name)}" data-color-required="${required ? 'true' : 'false'}"><input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(selected)}" data-color-value><button type="button" class="color-picker__trigger" data-color-open><span class="color-picker__swatch${emptyClass}" data-color-swatch${swatchStyle}></span><span>Выбор цвета</span></button></div>`;
}

export function initColorPickers(root, colors = COLOR_PALETTE) {
  const paletteColors = Array.isArray(colors) && colors.length ? colors : COLOR_PALETTE;
  root.querySelectorAll('[data-color-picker]').forEach((picker) => {
    const value = picker.querySelector('[data-color-value]');
    const swatch = picker.querySelector('[data-color-swatch]');
    const open = picker.querySelector('[data-color-open]');
    if (!value || !swatch || !open) return;
    open.onclick = () => {
      const palette = paletteColors.map((color) => `<button type="button" class="color-picker__option ${color === value.value ? 'is-selected' : ''}" data-color-option="${escapeHtml(color)}" aria-label="Цвет ${escapeHtml(color)}"><span style="background:${escapeHtml(color)}"></span></button>`).join('');
      const m = mountModal(root, modal(`<div class="compact-form"><div class="modal-title"><h2>Выбор цвета</h2></div><div class="color-picker__palette" data-color-palette>${palette}</div></div>`, { title: 'Выбор цвета' }));
      m?.querySelectorAll('[data-color-option]').forEach((option) => option.addEventListener('click', () => {
        value.value = option.dataset.colorOption || paletteColors[0];
        swatch.style.background = value.value;
        swatch.classList.remove('is-empty');
        value.dispatchEvent(new Event('change', { bubbles: true }));
        m.remove();
      }));
    };
  });
}
