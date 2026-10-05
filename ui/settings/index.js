import { button } from '../buttons/index.js';
import { v2ListEntry, v2ListEntries } from '../lists/list-entry.js';
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
    return button(text(item.label || ''), { className: 'app-settings-panel__button', data: item.data || '', aria: item.aria || item.label || '', variant: item.variant || '', disabled: Boolean(item.disabled) });
  }).join('')}</div>`;
}

export function notificationSettings(items = []) {
  const rows = (Array.isArray(items) ? items : []).filter(Boolean).map((item) => v2ListEntry({
    title: item.label || '',
    subtitle: item.description || '',
    interactive: false,
    toggleData: item.data || '',
    toggleAria: item.aria || `${item.checked ? 'Выключить' : 'Включить'} ${item.label || ''}`,
    toggleChecked: Boolean(item.checked),
    toggleDisabled: Boolean(item.disabled),
  }));
  return `<div class="app-notification-list">${v2ListEntries(rows)}<div class="muted" data-notification-status></div></div>`;
}
