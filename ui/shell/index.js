import { button } from '../buttons/index.js';
import { navigationBar } from '../navigation/navigation.js';
import { escapeHtml } from '../utils/escape-html.js';

const CLIENT_NAV_ITEMS = [
  { id: 'profile', label: 'Профиль', icon: '◉' },
  { id: 'messages', label: 'Сообщения', icon: '💬' },
  { id: 'history', label: 'История', icon: '▤' },
];

function text(value = '') {
  return escapeHtml(String(value ?? ''));
}

export function appHeader({
  title = '',
  back = null,
  action = null,
  settings = null,
} = {}) {
  const backButton = back
    ? button('‹', { className: 'app-header__control app-header__control--icon', data: back.data || '', aria: back.aria || 'Назад', variant: 'secondary' })
    : '';
  const actionButton = action
    ? button(text(action.label || ''), { className: 'app-header__control app-header__control--action', data: action.data || '', aria: action.aria || action.label || '', disabled: Boolean(action.disabled) })
    : '';
  const settingsButton = settings
    ? button(settings.label || '•••', { className: 'app-header__control app-header__control--icon', data: settings.data || '', aria: settings.aria || 'Настройки', variant: 'secondary' })
    : '';

  return `<header class="app-header" data-app-header>
    <div class="app-header__slot app-header__slot--back${back ? '' : ' is-empty'}">${backButton}</div>
    <h1 class="app-header__title">${text(title)}</h1>
    <div class="app-header__slot app-header__slot--action${action ? '' : ' is-empty'}">${actionButton}</div>
    <div class="app-header__slot app-header__slot--settings${settings ? '' : ' is-empty'}">${settingsButton}</div>
  </header>`;
}

export function mediaRail(items = []) {
  const values = (Array.isArray(items) ? items : []).filter(Boolean);
  if (!values.length) return '';
  return `<div class="app-media-rail" data-media-rail>${values.map((item, index) => {
    const label = text(item.label || item.title || `Новость ${index + 1}`);
    const image = String(item.image || '').trim();
    const style = image ? ` style="--media-image:url('${text(image)}')"` : '';
    const data = item.data ? ` ${item.data}` : '';
    return `<button type="button" class="app-media-rail__item"${data}${style}><span class="app-media-rail__circle" aria-hidden="true"></span><span>${label}</span></button>`;
  }).join('')}</div>`;
}

export function clientBottomNavigation(active = 'profile') {
  return navigationBar(CLIENT_NAV_ITEMS, active, {
    className: 'bottom-nav--client',
    aria: 'Клиентская навигация',
    dataAttribute: 'data-client-nav',
  });
}

export function appShell({
  header = '',
  media = '',
  body = '',
  primaryAction = '',
  bottomNavigation = '',
  className = '',
} = {}) {
  const classes = ['app-view-shell', media ? 'app-view-shell--has-media' : '', className].filter(Boolean).join(' ');
  return `<section class="${classes}" data-app-view-shell>
    ${header}
    ${media ? `<div class="app-view-shell__media">${media}</div>` : ''}
    <main class="app-view-shell__screen">${body}</main>
    ${primaryAction ? `<div class="app-view-shell__primary-action">${primaryAction}</div>` : ''}
    ${bottomNavigation}
  </section>`;
}

export function clientProfileCard({
  workplace = '',
  visitLabel = 'Последний визит',
  date = '',
  time = '',
  uei = '',
  discount = 0,
  name = '',
  phone = '',
  financial = [],
  rows = [],
} = {}) {
  const finance = (Array.isArray(financial) ? financial : []).slice(0, 3);
  const details = Array.isArray(rows) ? rows : [];
  return `<article class="client-profile-card" data-client-profile-card>
    <div class="client-profile-card__visit">
      <strong class="client-profile-card__workplace">${text(workplace)}</strong>
      <span class="client-profile-card__visit-label">${text(visitLabel)}</span>
      <strong class="client-profile-card__visit-date">${text(date)}</strong>
      <strong class="client-profile-card__visit-time">${text(time)}</strong>
    </div>
    <div class="client-profile-card__identity">
      <strong class="client-profile-card__uei">${uei ? `UEI ${text(uei)}` : ''}</strong>
      <strong class="client-profile-card__discount">${Number(discount) > 0 ? `${text(discount)}%` : ''}</strong>
      <strong class="client-profile-card__name">${text(name)}</strong>
      <span class="client-profile-card__phone">${text(phone)}</span>
    </div>
    <div class="client-profile-card__finance">${finance.map((item) => `<div class="client-profile-card__metric"><strong>${text(item.value)}</strong><span>${text(item.label)}</span></div>`).join('')}</div>
    <div class="client-profile-card__rows">${details.map((item, index) => `<button type="button" class="client-profile-card__row"${item.data ? ` ${item.data}` : ''} data-profile-row="${index}"><span>${text(item.label)}</span><strong>${text(item.value)}</strong></button>`).join('')}</div>
  </article>`;
}

function attachmentMarkup(attachment = {}) {
  const dataUrl = String(attachment?.dataUrl || '').trim();
  const type = String(attachment?.type || '').toLowerCase();
  const name = text(attachment?.name || 'Вложение');
  if (type.startsWith('image/') && dataUrl.startsWith('data:image/')) {
    return `<a class="message-attachment message-attachment--image" href="${text(dataUrl)}" target="_blank" rel="noopener" aria-label="Открыть ${name}"><img src="${text(dataUrl)}" alt="${name}"></a>`;
  }
  if (type.startsWith('video/') && dataUrl.startsWith('data:video/')) {
    return `<video class="message-attachment message-attachment--video" controls preload="metadata"><source src="${text(dataUrl)}" type="${text(type)}"></video>`;
  }
  return '';
}

export function messageBubble(message = {}, { viewer = 'client' } = {}) {
  const direction = String(message.direction || '').toLowerCase();
  const system = direction === 'system' || String(message.kind || '').toLowerCase() === 'system';
  const outgoing = viewer === 'master' ? direction === 'outbound' : direction === 'inbound';
  const classes = ['message-bubble', system ? 'message-bubble--system' : outgoing ? 'message-bubble--outgoing' : 'message-bubble--incoming'].join(' ');
  const time = message.time || message.createdAt || '';
  const attachments = (Array.isArray(message.attachments) ? message.attachments : []).map(attachmentMarkup).filter(Boolean).join('');
  const body = text(message.body || '').replaceAll('\n', '<br>');
  return `<div class="${classes}" data-message-id="${text(message.id || '')}">${attachments ? `<div class="message-bubble__attachments">${attachments}</div>` : ''}${body ? `<div class="message-bubble__body">${body}</div>` : ''}${time ? `<span class="message-bubble__time">${text(time)}</span>` : ''}</div>`;
}

export function messageThread(messages = [], options = {}) {
  const values = Array.isArray(messages) ? messages : [];
  return `<div class="message-thread" data-message-thread>${values.map((message) => messageBubble(message, options)).join('')}</div>`;
}

export function messageComposer({ placeholder = 'Написать сообщение...', data = 'data-message-composer', sendData = 'data-message-send', attachments = false } = {}) {
  const composerClass = attachments ? 'message-composer message-composer--with-attachments' : 'message-composer message-composer--plain';
  return `<form class="${composerClass}" ${data}>${attachments ? `<input class="sr-only" type="file" accept="image/*,video/*" multiple data-message-attachment-input><button type="button" class="message-composer__attach" data-message-attachment aria-label="Прикрепить фото или медиа">📎</button>` : ''}<textarea class="message-composer__input" name="message" rows="1" placeholder="${text(placeholder)}" aria-label="${text(placeholder)}"></textarea>${button('➤', { className: 'message-composer__send', type: 'submit', data: sendData, aria: 'Отправить' })}${attachments ? '<div class="message-composer__attachments" data-message-attachment-preview></div>' : ''}</form>`;
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

export function readOnlyReceipt({
  title = '',
  status = '',
  date = '',
  time = '',
  items = [],
  totals = [],
  action = null,
} = {}) {
  return `<section class="read-only-sheet" data-read-only-sheet>
    <header class="read-only-sheet__header"><h2>${text(title)}</h2><div class="read-only-sheet__meta"><strong>${text(status)}</strong><span>${text(date)}</span><span>${text(time)}</span></div></header>
    <div class="read-only-sheet__items">${(Array.isArray(items) ? items : []).map((item) => `<div class="read-only-sheet__row"><span>${text(item.label)}</span><strong>${text(item.value)}</strong></div>`).join('')}</div>
    <div class="read-only-sheet__totals">${(Array.isArray(totals) ? totals : []).map((item) => `<div class="read-only-sheet__row${item.strong ? ' is-strong' : ''}"><span>${text(item.label)}</span><strong>${text(item.value)}</strong></div>`).join('')}</div>
    ${action ? `<div class="read-only-sheet__action">${button(text(action.label || ''), { data: action.data || '', aria: action.aria || action.label || '' })}</div>` : ''}
  </section>`;
}
