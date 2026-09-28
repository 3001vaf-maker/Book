import { workspaceHeaderContext } from '../header/index.js';
import { mountV2ZLayer, v2ZLayer } from '../v2/index.js';
import { entityVisualCard } from '../cards/entity-card-constructor.js';
import { miniCard } from '../cards/mini-card.js';
import { listEntry, listEntries } from '../lists/list-entry.js';
import { v2HorizontalRail, v2RailCard } from '../v2/index.js';
import { timeSlots } from '../time/index.js';

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
} = {}) {
  const cards = (Array.isArray(items) ? items : []).map((item = {}) => {
    const key = String(item.key ?? item.id ?? '');
    const name = String(item.name || item.title || 'Рабочее пространство');
    return entityVisualCard({
      appearance: item.appearance || item.cardAppearance || {},
      fields: Array.isArray(item.fields) ? item.fields : [],
      image: String(item.photo || item.image || ''),
      imagePosition: String(item.imagePosition || '50% 50%'),
      interactive: true,
      data: `${data}="${escapeRecordText(key)}"`,
      aria: `Выбрать рабочее пространство ${name}`,
    });
  });
  return cards.length
    ? v2HorizontalRail(cards.join(''), { className: 'v2-profile-workplaces' })
    : '';
}

export function recordProcedureList(items = [], {
  data = 'data-record-procedure',
  selected = [],
  empty = 'Процедур нет.',
} = {}) {
  const selectedSet = new Set((Array.isArray(selected) ? selected : []).map(String));
  const rows = (Array.isArray(items) ? items : []).map((item = {}) => {
    const id = String(item.id || '');
    const on = selectedSet.has(id);
    const name = String(item.name || item.title || 'Процедура');
    const duration = String(item.durationText || item.secondary || '');
    const cost = String(item.costText || item.right || '');
    return `<button type="button" class="v2-service-sticker${on ? ' is-selected' : ''}" ${data}="${escapeRecordText(id)}" aria-pressed="${on ? 'true' : 'false'}" aria-label="${escapeRecordText(item.aria || `Выбрать процедуру ${name}`)}">
      <span class="v2-service-sticker__text">
        <strong>${escapeRecordText(name)}</strong>
        ${duration ? `<span>${escapeRecordText(duration)}</span>` : ''}
      </span>
      <span class="v2-service-sticker__price">${escapeRecordText(cost)}</span>
      <span class="v2-service-sticker__selector" aria-hidden="true"></span>
    </button>`;
  });
  return rows.length
    ? `<div class="v2-sticker-list v2-sticker-list--services">${rows.join('')}</div>`
    : `<div class="muted">${escapeRecordText(empty)}</div>`;
}

export function recordPersonList(items = [], {
  data = 'data-record-person',
  selected = '',
  empty = 'Люди не найдены.',
} = {}) {
  const rows = (Array.isArray(items) ? items : []).map((item = {}) => {
    const key = String(item.key || item.id || '');
    return listEntry({
      overline: item.uei || '',
      title: item.name || '',
      subtitle: item.phone || '',
      interactive: true,
      selected: String(selected || '') === key,
      data: `${data}="${escapeRecordText(key)}"`,
      aria: item.aria || `Выбрать ${item.name || ''}`,
    });
  });
  return rows.length ? listEntries(rows) : `<div class="muted">${escapeRecordText(empty)}</div>`;
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
      ${timeSlots({
        values: times.map((value) => {
          const minute = Number(value.split(':')[1] || 0);
          return {
            value,
            label: value,
            emphasized: Number(accentEvery) > 0 && minute % Number(accentEvery) === 0,
          };
        }),
        data,
        ariaLabel: `Время ${hour}:00`,
        className: 'time-slots--hour-rows',
      })}
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
  discount = '',
  total = '',
  procedures = [],
} = {}) {
  const card = miniCard({
    lines: [
      { value: workplace || '—', align: 'left', strong: true },
      { value: date || '—', align: 'right' },
      { value: period || '—', align: 'right' },
      { value: uei || '—', align: 'left' },
      { value: name || '—', align: 'left', strong: true },
      { value: phone || '—', align: 'left' },
    ],
  });

  const metrics = v2HorizontalRail([
    v2RailCard({
      title: duration || '—',
      subtitle: 'Время',
      className: 'people-metric-card',
    }),
    v2RailCard({
      title: discount || '0%',
      subtitle: 'Скидка',
      className: 'people-metric-card',
    }),
    v2RailCard({
      title: total || '—',
      subtitle: 'Сумма',
      className: 'people-metric-card',
    }),
  ].join(''), { className: 'people-metrics' });

  const rows = listEntries((Array.isArray(procedures) ? procedures : []).map((item = {}) => listEntry({
    columns: [
      [
        { value: item.name || item.title || 'Процедура', strong: true },
        { value: '', className: 'list-entry__line-spacer' },
        { value: item.durationText || '', strong: true },
      ],
      [
        { value: '', className: 'list-entry__line-spacer' },
        { value: item.right || item.costText || '', strong: true },
        { value: '', className: 'list-entry__line-spacer' },
      ],
    ],
    interactive: false,
    className: 'list-entry--record-procedure',
    aria: item.aria || item.name || item.title || 'Процедура',
  })));

  return `<div class="record-confirmation-view">
    <div class="record-confirmation-view__card">${card}</div>
    <div class="record-confirmation-view__metrics">${metrics}</div>
    <div class="record-confirmation-view__procedures">${rows}</div>
  </div>`;
}

export function mountRecordZ({
  title = 'Запись',
  settings = false,
  className = '',
  stack = true,
  onClose = null,
  chatPersonKey = '',
  aImage = '',
  aImagePosition = '',
  aInitials = '',
} = {}) {
  const context = workspaceHeaderContext({
    title,
    hideD: !chatPersonKey,
    a: {
      kind: 'avatar',
      label: 'Запись',
      image: aImage,
      imagePosition: aImagePosition,
      initials: aInitials,
      ...(settings ? {
        data: 'data-record-owner-settings',
        aria: 'Настройки записи',
      } : {
        disabled: true,
        aria: 'Запись',
      }),
    },
    d: chatPersonKey ? {
      kind: 'chat',
      data: 'data-record-owner-chat',
      aria: 'Чат',
    } : null,
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
