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
    return button(text(item.label || ''), { className: 'app-settings-panel__button', data: item.data || '', aria: item.aria || item.label || '', variant: item.variant || '', disabled: Boolean(item.disabled) });
  }).join('')}</div>`;
}

function notificationSettingEntry(item = {}) {
  const checked = Boolean(item.checked);
  const disabled = Boolean(item.disabled);
  return `<label class="list-entry app-notification-row${disabled ? ' is-disabled' : ''}">
    <span class="list-entry__background" aria-hidden="true"></span>
    <span class="list-entry__content">
      <span class="list-entry__main"><span class="list-entry__text"><strong>${text(item.label || '')}</strong><small>${text(item.description || '') || '&nbsp;'}</small></span></span>
      <span class="list-entry__toggle${checked ? ' is-on' : ''}${disabled ? ' is-disabled' : ''}">
        <input class="app-notification-input" type="checkbox" ${item.data || ''}${checked ? ' checked' : ''}${disabled ? ' disabled' : ''}${item.aria ? ` aria-label="${text(item.aria)}"` : ''}>
        <span class="app-setting-toggle__switch${checked ? ' is-on' : ''}" aria-hidden="true"><span></span></span>
      </span>
    </span>
  </label>`;
}

export function notificationSettings(items = []) {
  const rows = (Array.isArray(items) ? items : []).filter(Boolean).map(notificationSettingEntry).join('');
  return `<div class="app-notification-list"><div class="list-entries">${rows}</div><div class="muted" data-notification-status></div></div>`;
}
