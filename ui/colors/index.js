import { escapeHtml } from '../utils/escape-html.js';
import { modal, mountModal } from '../modals/index.js';

const DEFAULT_COLORS = ['#3B302B', '#7A6F69', '#B8AEA8', '#E5DED9', '#F4F1EA', '#E8E1DC', '#9A6258', '#B84A4A', '#FFFFFF'];

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
