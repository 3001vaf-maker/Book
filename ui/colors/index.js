import { escapeHtml } from '../utils/escape-html.js';
import { modal, mountModal } from '../modals/index.js';

const DEFAULT_COLORS = [
  '#F6D32D', '#F2C94C', '#F2994A', '#F08C46', '#E76F51',
  '#E63946', '#D62828', '#B42318', '#9B1C31', '#7F1D1D',
  '#FF6B9D', '#E64980', '#C2255C', '#A61E4D', '#7A284B',
  '#C77DFF', '#9D4EDD', '#7B2CBF', '#5A189A', '#3C096C',
  '#74C0FC', '#339AF0', '#1C7ED6', '#1864AB', '#0B3C5D',
  '#63E6BE', '#20C997', '#12B886', '#0F766E', '#0B7285',
  '#8CE99A', '#51CF66', '#37B24D', '#2B8A3E', '#1B5E20',
  '#DDB892', '#BC8A5F', '#9C6644', '#7F5539', '#5B4636',
  '#FFFFFF', '#E9ECEF', '#ADB5BD', '#6C757D', '#212529'
];

export function colorPicker({ name = 'color', value = DEFAULT_COLORS[0], colors = DEFAULT_COLORS } = {}) {
  const selected = colors.includes(value) ? value : colors[0];
  return `<div class="color-picker" data-color-picker data-color-name="${escapeHtml(name)}"><input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(selected)}" data-color-value><button type="button" class="color-picker__trigger" data-color-open><span class="color-picker__swatch" data-color-swatch style="background:${escapeHtml(selected)}"></span><span>Выбор цвета</span></button></div>`;
}

export function initColorPickers(root, colors = DEFAULT_COLORS) {
  root.querySelectorAll('[data-color-picker]').forEach((picker) => {
    const value = picker.querySelector('[data-color-value]');
    const swatch = picker.querySelector('[data-color-swatch]');
    const open = picker.querySelector('[data-color-open]');
    if (!value || !swatch || !open) return;
    open.onclick = () => {
      const palette = colors.map((color) => `<button type="button" class="color-picker__option ${color === value.value ? 'is-selected' : ''}" data-color-option="${escapeHtml(color)}" aria-label="Цвет ${escapeHtml(color)}"><span style="background:${escapeHtml(color)}"></span></button>`).join('');
      const m = mountModal(root, modal(`<div class="compact-form"><div class="modal-title"><h2>Выбор цвета</h2></div><div class="color-picker__palette" data-color-palette>${palette}</div></div>`, { title: 'Выбор цвета' }));
      m?.querySelectorAll('[data-color-option]').forEach((option) => option.addEventListener('click', () => {
        value.value = option.dataset.colorOption || colors[0];
        swatch.style.background = value.value;
        m.remove();
      }));
    };
  });
}
