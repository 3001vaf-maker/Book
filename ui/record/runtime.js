import { workspaceHeaderContext } from '../header/index.js';
import { mountV2ZLayer, v2ZLayer } from '../v2/index.js';

function recordSurface() {
  return document.querySelector('[data-v2-workspace-surface]')
    || document.querySelector('[data-v2-app]')
    || document.body;
}

function escapeRecordText(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[char]));
}

export function recordTimeChoices({
  values = [],
  data = 'data-record-time',
  empty = 'Нет свободного времени',
  quarterEmphasis = true,
} = {}) {
  const items = (Array.isArray(values) ? values : []).map((value) => {
    const text = String(value || '');
    const quarter = quarterEmphasis && /:(00|15|30|45)$/.test(text);
    return `<button type="button" class="record-time-option${quarter ? ' is-quarter' : ''}" ${data}="${escapeRecordText(text)}">${escapeRecordText(text)}</button>`;
  }).join('');
  return `<div class="record-time-list">${items || `<div class="muted">${escapeRecordText(empty)}</div>`}</div>`;
}

export function mountRecordZ({
  title = 'Запись',
  settings = false,
  className = '',
  stack = true,
  onClose = null,
} = {}) {
  const context = workspaceHeaderContext({
    title,
    a: settings ? {
      kind: 'settings',
      label: 'Настройки записи',
      data: 'data-record-owner-settings',
      aria: 'Настройки записи',
    } : null,
  });
  const classes = ['record-shared-z', className].filter(Boolean).join(' ');
  return mountV2ZLayer(recordSurface(), v2ZLayer(
    `${context}<div data-record-owner-host></div>`,
    { className: classes },
  ), { stack, onClose });
}

export function recordZHost(layerRoot) {
  return layerRoot?.querySelector('[data-record-owner-host]') || null;
}

export function renderRecordZ(layerRoot, content = '') {
  const host = recordZHost(layerRoot);
  if (!host) return null;
  host.innerHTML = String(content || '');
  return host;
}

export function setRecordPrimaryAction(layerRoot, {
  label = '',
  variant = '',
  onClick = null,
} = {}) {
  const context = layerRoot?.querySelector('[data-workspace-header-context]');
  if (!context) return;
  context.querySelector('[data-record-owner-primary]')?.remove();
  if (!label || typeof onClick !== 'function') {
    window.dispatchEvent(new CustomEvent('book:v2-context-changed'));
    return;
  }
  const source = document.createElement('button');
  source.type = 'button';
  source.className = 'record-owner-primary';
  source.dataset.recordOwnerPrimary = '';
  source.dataset.v2PrimaryAction = '';
  source.dataset.v2PrimaryLabel = label;
  if (variant) source.dataset.v2PrimaryVariant = variant;
  source.setAttribute('aria-label', label);
  source.addEventListener('click', onClick);
  context.appendChild(source);
  window.dispatchEvent(new CustomEvent('book:v2-context-changed'));
}

export function bindRecordSettings(layerRoot, onOpen) {
  if (typeof onOpen !== 'function') return;
  layerRoot?.querySelector('[data-record-owner-settings]')?.addEventListener('click', onOpen);
}

export function closeRecordZStack(className = 'record-flow-z') {
  const selector = className
    ? `[data-v2-z-layer].${className}`
    : '[data-v2-z-layer].record-shared-z';
  [...document.querySelectorAll(selector)].reverse().forEach((layer) => layer.v2Close?.());
}
