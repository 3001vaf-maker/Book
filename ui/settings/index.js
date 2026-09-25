import { button } from '../buttons/index.js';
import { escapeHtml } from '../utils/escape-html.js';

function text(value = '') {
  return escapeHtml(String(value ?? ''));
}

export function settingToggle({ label = '', checked = false, data = '', disabled = false } = {}) {
  return `<button type="button" class="app-setting-toggle${checked ? ' is-on' : ''}" ${data} aria-pressed="${checked ? 'true' : 'false'}"${disabled ? ' disabled' : ''}><span>${text(label)}</span><span class="app-setting-toggle__switch" aria-hidden="true"><span></span></span></button>`;
}

export function settingsPanel(items = []) {
  return `<div class="app-settings-panel">${(Array.isArray(items) ? items : []).filter(Boolean).map((item) => {
    if (item.type === 'toggle') return settingToggle(item);
    return button(text(item.label || ''), { className: 'app-settings-panel__button', data: item.data || '', aria: item.aria || item.label || '', variant: item.variant || '' });
  }).join('')}</div>`;
}
