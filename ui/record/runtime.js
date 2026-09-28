import { workspaceHeaderContext } from '../header/index.js';
import { mountV2ZLayer, v2ZLayer } from '../v2/index.js';
import { entityCard, entityCardStack } from '../cards/index.js';
import { miniCard } from '../cards/mini-card.js';
import { list } from '../lists/list.js';

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

export function recordWorkplaceCards(items = [], {
  data = 'data-record-workplace',
  selected = '',
} = {}) {
  const cards = (Array.isArray(items) ? items : []).map((item = {}) => {
    const key = String(item.key ?? item.id ?? '');
    const name = String(item.name || item.title || 'Рабочее пространство');
    const secondary = [item.city, item.address].filter(Boolean).join(' · ');
    return entityCard({
      title: name,
      subtitle: secondary,
      image: String(item.photo || ''),
      initial: name.slice(0, 1).toUpperCase(),
      interactive: true,
      data: `${data}="${escapeRecordText(key)}"`,
      className: `entity-card--compact record-workplace-card${String(selected) === key ? ' is-selected' : ''}`,
      aria: `Выбрать рабочее пространство ${name}`,
    });
  });
  return entityCardStack(cards, { className: 'record-workplace-stack' });
}

export function recordProcedureList(items = [], {
  data = 'data-record-procedure',
  selected = [],
  empty = 'Процедур нет.',
} = {}) {
  const selectedSet = new Set((Array.isArray(selected) ? selected : []).map(String));
  const values = (Array.isArray(items) ? items : []).map((item = {}) => {
    const id = String(item.id || '');
    return {
      title: item.name || item.title || '',
      secondary: item.durationText || item.secondary || '',
      right: item.costText || item.right || '',
      interactive: true,
      data: `${data}="${escapeRecordText(id)}"`,
      selected: selectedSet.has(id),
      aria: item.aria || `Выбрать процедуру ${item.name || item.title || ''}`,
    };
  });
  return values.length ? list({ items: values, className: 'record-procedure-list' }) : `<div class="muted">${escapeRecordText(empty)}</div>`;
}

function timeValue(item) {
  return String(item && typeof item === 'object' ? (item.from ?? item.value ?? '') : item ?? '');
}

export function recordTimeRows(items = [], {
  data = 'data-record-time',
  empty = 'Нет свободного времени',
  accentEvery = 30,
} = {}) {
  const values = (Array.isArray(items) ? items : []).map(timeValue).filter(Boolean);
  if (!values.length) return `<div class="muted">${escapeRecordText(empty)}</div>`;
  const groups = new Map();
  values.forEach((value) => {
    const [hour = ''] = value.split(':');
    if (!groups.has(hour)) groups.set(hour, []);
    groups.get(hour).push(value);
  });
  return `<div class="record-time-hours">${[...groups.entries()].map(([hour, times]) => `
    <div class="record-time-hour" data-record-time-hour="${escapeRecordText(hour)}">
      <div class="record-time-track">${times.map((value) => {
        const minute = Number(value.split(':')[1] || 0);
        const emphasized = Number(accentEvery) > 0 && minute % Number(accentEvery) === 0;
        return `<button type="button" class="record-time-chip${emphasized ? ' is-emphasized' : ''}" ${data}="${escapeRecordText(value)}">${escapeRecordText(value)}</button>`;
      }).join('')}</div>
    </div>`).join('')}</div>`;
}

export function recordConfirmationMiniCard({
  workplace = '',
  date = '',
  period = '',
  uei = '',
  name = '',
  phone = '',
  duration = '',
  total = '',
  procedures = [],
} = {}) {
  const base = miniCard({
    title: name || 'Запись',
    value: uei || '',
    subtitle: phone || '',
    rows: [
      { label: 'Пространство', value: workplace || '—' },
      { label: 'Дата', value: date || '—' },
      { label: 'Период', value: period || '—' },
    ],
    className: 'record-confirmation-mini',
  });
  const metrics = `<div class="record-confirmation-mini__metrics">
    <div><span>Итог времени</span><strong>${escapeRecordText(duration || '—')}</strong></div>
    <div><span>Итог суммы</span><strong>${escapeRecordText(total || '—')}</strong></div>
  </div>`;
  const procedureRows = `<div class="record-confirmation-mini__procedures">${(Array.isArray(procedures) ? procedures : []).map((item = {}) => `
    <div class="record-confirmation-mini__procedure"${item.data ? ` ${String(item.data).trim()}` : ''}>
      <span>${escapeRecordText(item.name || item.title || '')}</span>
      <strong>${escapeRecordText(item.right || item.costText || '')}</strong>
    </div>`).join('')}</div>`;
  return base.replace('</section>', `${metrics}${procedureRows}</section>`);
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
  chatPersonKey = '',
} = {}) {
  const context = workspaceHeaderContext({
    title,
    a: settings ? {
      kind: 'settings',
      label: 'Настройки записи',
      data: 'data-record-owner-settings',
      aria: 'Настройки записи',
    } : null,
    d: {
      kind: 'chat',
      data: 'data-record-owner-chat',
      aria: 'Чат',
    },
  });
  const classes = ['record-shared-z', className].filter(Boolean).join(' ');
  const layer = mountV2ZLayer(recordSurface(), v2ZLayer(
    `${context}<div data-record-owner-host></div>`,
    { className: classes },
  ), { stack, onClose });
  layer?.querySelector('[data-record-owner-chat]')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('book:record-chat-request', {
      detail: { personKey: String(chatPersonKey || '') },
    }));
  });
  return layer;
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
