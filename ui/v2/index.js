import { escapeHtml } from '../utils/escape-html.js';
import { v2ModalPortalGeometry } from './modal-geometry.js';

function text(value = '') {
  return escapeHtml(String(value ?? ''));
}

function dataAttributes(data = '') {
  return String(data || '').trim() ? ` ${String(data).trim()}` : '';
}

function headerControl(slot = {}, role = '') {
  if (!slot || slot.hidden) return `<div class="v2-header__slot v2-header__slot--${role} is-empty"></div>`;
  const label = text(slot.label || '');
  const aria = text(slot.aria || slot.label || role);
  const badge = Number(slot.badge || 0) > 0 ? `<span class="v2-header__badge">${Math.min(99, Number(slot.badge || 0))}</span>` : '';
  const image = String(slot.image || '').trim();
  const initials = text(slot.initials || (slot.label || '').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase());
  const kind = slot.kind || 'text';
  const variant = slot.variant === 'danger' ? 'danger' : (slot.variant === 'white' || slot.variant === 'secondary' ? 'white' : '');
  const variantClass = variant ? ` v2-header__control--${variant}` : '';
  let body = label;
  if (kind === 'logo') {
    body = label;
  } else if (kind === 'avatar') {
    body = image
      ? `<span class="v2-header__avatar" style="--v2-avatar:url('${text(image)}');--v2-avatar-position:${text(slot.imagePosition || '50% 50%')}" aria-hidden="true"></span>`
      : `<span class="v2-header__avatar v2-header__avatar--initials" aria-hidden="true">${initials}</span>`;
  } else if (kind === 'chat') {
    body = '<span class="v2-header__icon v2-header__icon--chat" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 4c-4.7 0-8 2.8-8 6.7 0 2.5 1.4 4.6 3.8 5.8L7.2 20l3.6-2.1c.4.1.8.1 1.2.1 4.7 0 8-2.8 8-7.3S16.7 4 12 4Z"></path></svg></span>';
  } else if (kind === 'contacts') {
    body = '<span class="v2-header__icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="7" cy="8" r="2.2"></circle><path d="M3.8 14.5c.7-2.1 1.8-3.1 3.2-3.1s2.5 1 3.2 3.1M13 7h7M13 12h7M13 17h7"></path></svg></span>';
  } else if (kind === 'attachment') {
    body = '<span class="v2-header__icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m8.5 12.5 6.2-6.2a3.2 3.2 0 0 1 4.5 4.5l-8.3 8.3a5 5 0 0 1-7.1-7.1l8.1-8.1"></path></svg></span>';
  } else if (kind === 'settings') {
    body = '<span class="v2-header__icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"></circle><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"></path></svg></span>';
  } else if (kind === 'back') {
    body = '<span class="v2-header__back" aria-hidden="true">‹</span>';
  }
  return `<div class="v2-header__slot v2-header__slot--${role}"><button type="button" class="v2-header__control v2-header__control--${kind}${variantClass}"${dataAttributes(slot.data)} aria-label="${aria}"${slot.disabled ? ' disabled' : ''}>${body}${badge}</button></div>`;
}

export function v2Header({ a = null, b = '', c = null, d = null } = {}) {
  const title = b && typeof b === 'object'
    ? `<button type="button" class="v2-header__title v2-header__title-control"${dataAttributes(b.data)} aria-label="${text(b.aria || b.label || '')}">${text(b.label || '')}</button>`
    : `<h1 class="v2-header__title">${text(b)}</h1>`;
  const headerClasses = ['v2-header', c && !c.hidden ? 'has-c' : '', d && !d.hidden ? 'has-d' : ''].filter(Boolean).join(' ');
  return `<header class="${headerClasses}" data-v2-header>
    ${headerControl(a, 'a')}
    ${title}
    ${headerControl(c, 'c')}
    ${headerControl(d, 'd')}
  </header>`;
}

function v2NavigationIcon(id = '') {
  const key = String(id || '').toLowerCase();
  const paths = {
    people: '<circle cx="8" cy="9" r="3"></circle><circle cx="16" cy="9" r="3"></circle><path d="M3 20c.7-3.2 2.4-5 5-5s4.3 1.8 5 5M12 20c.6-2.8 2.1-4.4 4.4-4.4 2.2 0 3.7 1.6 4.3 4.4"></path>',
    contacts: '<circle cx="8" cy="9" r="3"></circle><circle cx="16" cy="9" r="3"></circle><path d="M3 20c.7-3.2 2.4-5 5-5s4.3 1.8 5 5M12 20c.6-2.8 2.1-4.4 4.4-4.4 2.2 0 3.7 1.6 4.3 4.4"></path>',
    finance: '<rect x="3" y="6" width="18" height="13" rx="2"></rect><path d="M3 10h18M15 15h3"></path>',
    cash: '<rect x="3" y="6" width="18" height="13" rx="2"></rect><path d="M3 10h18M15 15h3"></path>',
    dds: '<path d="M4 6h16M4 12h16M4 18h16"></path><path d="m8 3-3 3 3 3M16 15l3 3-3 3"></path>',
    'income-expense': '<path d="M7 4v16M17 4v16M3 8l4-4 4 4M13 16l4 4 4-4"></path>',
    articles: '<path d="M5 5h14M5 10h14M5 15h9M5 20h9"></path>',
    special: '<path d="M4 8h16M4 16h16M8 4 4 8l4 4M16 12l4 4-4 4"></path>',
    'z-report': '<path d="M5 4h14L6 20h13"></path>',
    timetable: '<rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M7 3v4M17 3v4M3 10h18"></path>',
    home: '<path d="m3 11 9-7 9 7v9h-6v-6H9v6H3Z"></path>',
    journal: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3Z"></path><path d="M8 4v16"></path>',
    history: '<path d="M4 7h16M4 12h16M4 17h11"></path><circle cx="2.5" cy="7" r=".8"></circle><circle cx="2.5" cy="12" r=".8"></circle><circle cx="2.5" cy="17" r=".8"></circle>',
    profile: '<circle cx="12" cy="8" r="4"></circle><path d="M4 21c1-4.4 3.7-7 8-7s7 2.6 8 7"></path>',
    settings: '<circle cx="12" cy="12" r="3"></circle><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"></path>',
    service: '<path d="m14 6 4-4 4 4-4 4M3 21l9-9M8 16l3 3"></path>',
    'online-booking': '<rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M7 3v4M17 3v4M3 10h18M8 15h8"></path>',
    communications: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"></path>',
    integrations: '<path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"></path>',
    documents: '<path d="M6 3h9l4 4v14H6Z"></path><path d="M15 3v5h5M9 13h6M9 17h6"></path>',
    tags: '<path d="M3 12V4h8l10 10-8 8Z"></path><circle cx="8" cy="8" r="1"></circle>',
    day: '<rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M7 3v4M17 3v4M3 10h18"></path>',
    month: '<path d="M5 20V11M10 20V6M15 20V9M20 20V3"></path>',
    list: '<path d="M8 6h13M8 12h13M8 18h13"></path><circle cx="3.5" cy="6" r="1"></circle><circle cx="3.5" cy="12" r="1"></circle><circle cx="3.5" cy="18" r="1"></circle>',
  };
  const body = paths[key] || '<rect x="4" y="4" width="16" height="16" rx="3"></rect>';
  return `<span class="v2-nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24">${body}</svg></span>`;
}

function v2NestedMark(count = 0) {
  const value = Math.max(0, Number(count || 0));
  if (!value) return '';
  return `<span class="v2-f-nested" aria-hidden="true"><i></i><i></i><i></i><b>${value}</b></span>`;
}

export function v2EList(items = [], { active = '', data = 'data-v2-e-item' } = {}) {
  const values = (Array.isArray(items) ? items : []).filter(Boolean).slice(0, 7);
  if (!values.length) return '';
  const activeId = String(active || values[0]?.id || '0');
  const activeIndex = Math.max(0, values.findIndex((item, index) => String(item.id || index) === activeId));
  return `<div class="v2-e-deck" data-v2-e-list data-v2-e-count="${values.length}">${values.map((item, index) => {
    const id = String(item.id || index);
    const isActive = index === activeIndex;
    const itemData = data ? ` ${data}="${text(id)}"` : '';
    return `<button type="button" class="v2-e-card${isActive ? ' is-active' : ''}"${itemData} data-v2-e-index="${index}" aria-label="${text(item.aria || item.label || '')}"${isActive ? ' aria-current="true"' : ''}>${v2NavigationIcon(item.icon || id)}<strong>${text(item.label || '')}</strong></button>`;
  }).join('')}</div>`;
}

export function v2FDeck(items = [], { active = '', data = 'data-v2-deck-item', className = '', role = '' } = {}) {
  const values = (Array.isArray(items) ? items : []).filter(Boolean).slice(0, 7);
  if (!values.length) return '';
  const activeId = String(active || values[0]?.id || '0');
  const activeIndex = Math.max(0, values.findIndex((item, index) => String(item.id || index) === activeId));
  const deckClasses = ['v2-deck', className].filter(Boolean).join(' ');
  const roleData = role ? ` data-v2-deck-role="${text(role)}"` : '';
  return `<div class="${text(deckClasses)}" data-v2-deck data-v2-deck-count="${values.length}"${roleData}>${values.map((item, index) => {
    const id = String(item.id || index);
    const isActive = index === activeIndex;
    const childrenCount = Number(item.childrenCount || item.children || 0);
    const classes = ['v2-deck__card', isActive ? 'is-active' : ''].filter(Boolean).join(' ');
    const customData = data && data !== 'data-v2-deck-item' ? ` ${data}="${text(id)}"` : '';
    return `<button type="button" class="${classes}" data-v2-deck-item="${text(id)}"${customData} data-v2-f-index="${index}" aria-label="${text(item.aria || item.label || '')}"${isActive ? ' aria-current="true"' : ''}>${v2NestedMark(childrenCount)}${v2NavigationIcon(item.icon || id)}<strong>${text(item.label || '')}</strong></button>`;
  }).join('')}</div>`;
}

export function v2Shell({
  header = '',
  body = '',
  deck = '',
  eDeck = '',
  className = '',
  deckOpen = false,
  eOpen = false,
  zEnter = false,
  zData = 'data-v2-z',
} = {}) {
  const classes = ['v2-app', deck ? 'v2-app--with-deck' : '', eDeck ? 'has-e-deck' : '', deckOpen ? 'is-deck-open' : '', deckOpen && eOpen && eDeck ? 'is-e-open' : '', zEnter && !deckOpen ? 'is-z-entering' : '', className].filter(Boolean).join(' ');
  const feDeck = deck || eDeck ? `<div class="v2-fe-deck" data-v2-fe>${deck}${eDeck}</div>` : '';
  return `<section class="${classes}" data-v2-app>
    ${header}
    <div class="v2-app__stage">
      ${feDeck}
      <div class="v2-front" data-v2-front>
        <main class="v2-z" ${zData}>
${body}
</main>
      </div>
    </div>
  </section>`;
}

export function v2Section(title = '', content = '', { className = '' } = {}) {
  return `<section class="v2-section ${text(className)}"><h2 class="v2-section__title">${text(title)}</h2><div class="v2-section__content">${content}</div></section>`;
}

export function v2HorizontalRail(content = '', { className = '' } = {}) {
  return `<div class="v2-rail ${text(className)}">${content}</div>`;
}

export function v2RailCard({ title = '', subtitle = '', meta = '', data = '', aria = '', className = '' } = {}) {
  return `<button type="button" class="v2-rail-card ${text(className)}"${dataAttributes(data)} aria-label="${text(aria || title)}"><strong>${text(title)}</strong>${subtitle ? `<span>${text(subtitle)}</span>` : ''}${meta ? `<small>${text(meta)}</small>` : ''}</button>`;
}

export function v2Sticker({
  eyebrow = '',
  title = '',
  body = '',
  action = '',
  className = '',
  data = 'data-v2-sticker',
  closeData = '',
  closeAria = 'Закрыть',
} = {}) {
  const close = closeData
    ? `<button type="button" class="v2-sticker__close" ${String(closeData).trim()} aria-label="${text(closeAria)}">×</button>`
    : '';
  return `<section class="v2-sticker-screen ${text(className)}" ${data}>
    <article class="v2-sticker">
      ${close}
      ${eyebrow ? `<div class="v2-sticker__eyebrow">${text(eyebrow)}</div>` : ''}
      ${title ? `<h1 class="v2-sticker__title">${text(title)}</h1>` : ''}
      <div class="v2-sticker__body">${body}</div>
      ${action ? `<div class="v2-sticker__action">${action}</div>` : ''}
    </article>
  </section>`;
}

export function v2Document({ title = 'Документ', version = '', content = '' } = {}) {
  const body = String(content || '').trim()
    ? String(content).trim().split(/\n{2,}/).map((part) => `<p>${text(part).replaceAll('\n', '<br>')}</p>`).join('')
    : '<p>Текст документа не заполнен.</p>';
  return `<article class="v2-document">${version ? `<div class="v2-document__version">Версия ${text(version)}</div>` : ''}<h2>${text(title)}</h2><div class="v2-document__body">${body}</div></article>`;
}

export function v2LegalCards(items = []) {
  return `<div class="v2-legal-cards">${(Array.isArray(items) ? items : []).map((item, index) => `<article class="v2-legal-card">
    <button type="button" class="v2-legal-card__document"${dataAttributes(item.openData)} aria-label="${text(item.openAria || item.title || 'Документ')}">
      <strong>${text(item.title || 'Документ')}</strong>
      <span>${text(item.status || (item.required ? 'обязательное' : 'необязательное'))}</span>
    </button>
    <button type="button" class="v2-legal-card__toggle${item.checked ? ' is-on' : ''}"${dataAttributes(item.toggleData)} aria-pressed="${item.checked ? 'true' : 'false'}" aria-label="${text(item.toggleAria || item.title || 'Согласие')}"><span></span></button>
  </article>`).join('')}</div>`;
}

export function v2ZLayer(content = '', { className = '' } = {}) {
  return `<main class="v2-z v2-z--layer ${text(className)}" data-v2-z-layer>${content}</main>`;
}

export function mountV2ZLayer(root, html, { onClose = null, stack = false } = {}) {
  const app = root?.closest?.('[data-v2-app]') || document.querySelector('[data-v2-app]');
  const stage = app?.querySelector?.('.v2-app__stage');
  const front = app?.querySelector?.('[data-v2-front]');
  const host = front || stage;
  if (!host) return null;
  const template = document.createElement('template');
  template.innerHTML = String(html || '').trim();
  const node = template.content.firstElementChild;
  if (!node?.matches?.('[data-v2-z-layer]')) return null;
  if (!stack) host.querySelectorAll('[data-v2-z-layer]').forEach((layer) => layer.remove());
  const depth = host.querySelectorAll('[data-v2-z-layer]').length + 1;
  node.dataset.v2ZDepth = String(depth);
  node.style.setProperty('--v2-z-layer-shift', `${depth * 12}px`);
  host.appendChild(node);
  app?.classList.add('has-z-layer');
  const notify = () => window.dispatchEvent(new CustomEvent('book:v2-context-changed'));
  const contextObserver = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => mutation.type === 'childList'
      || (mutation.type === 'attributes' && [
        'class',
        'disabled',
        'aria-label',
        'data-v2-primary-visible',
        'data-v2-primary-label',
        'data-v2-primary-variant',
      ].includes(mutation.attributeName)))) {
      notify();
    }
  });
  contextObserver.observe(node, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: [
      'class',
      'disabled',
      'aria-label',
      'data-v2-primary-visible',
      'data-v2-primary-label',
      'data-v2-primary-variant',
    ],
  });
  let disposeSwipe = () => {};
  const close = () => {
    contextObserver.disconnect();
    disposeSwipe();
    if (node.isConnected) node.remove();
    app?.classList.toggle('has-z-layer', Boolean(host.querySelector('[data-v2-z-layer]')));
    notify();
    onClose?.();
  };
  node.addEventListener('click', (event) => {
    if (event.target.closest?.('[data-v2-z-close]')) close();
  });
  disposeSwipe = initV2Swipe(node, { onRight: close, revealDeck: false });
  node.v2Close = close;
  notify();
  return node;
}

export function v2Layer(content = '', { kind = 'standard', title = '', className = '' } = {}) {
  const aliases = { quick: 'bottom', system: 'top' };
  const allowed = new Set(['top', 'standard', 'bottom', 'technical']);
  const candidate = aliases[kind] || kind;
  const resolved = allowed.has(candidate) ? candidate : 'standard';
  const closeControl = resolved === 'technical'
    ? '<button type="button" class="v2-layer__close" data-v2-layer-close aria-label="Закрыть">×</button>'
    : '';
  const gestureZone = resolved === 'top' || resolved === 'bottom'
    ? `<span class="v2-layer__gesture-zone v2-layer__gesture-zone--${resolved}" data-v2-layer-gesture-zone aria-hidden="true"></span>`
    : '';
  return `<div class="v2-layer-backdrop" data-v2-layer data-v2-layer-kind="${resolved}"><section class="v2-layer v2-layer--${resolved} ${text(className)}" role="dialog" aria-modal="true" aria-label="${text(title)}" tabindex="-1">${closeControl}${gestureZone}${title ? `<header class="v2-layer__header"><h2>${text(title)}</h2></header>` : ''}${content}</section></div>`;
}

function initV2LayerDismissGesture(node, { kind = 'standard', onDismiss = null, threshold = 64, maxDrag = 180 } = {}) {
  if (!node || kind === 'technical') return () => {};
  const sheet = node.querySelector('.v2-layer');
  if (!sheet) return () => {};
  const vertical = kind === 'top' || kind === 'bottom';
  const target = vertical ? sheet.querySelector('[data-v2-layer-gesture-zone]') : sheet;
  if (!target) return () => {};

  let pointerId = null;
  let startX = 0;
  let startY = 0;
  let delta = 0;
  let axis = 'pending';
  let dismissing = false;

  const reset = () => {
    sheet.classList.remove('is-dragging');
    sheet.style.removeProperty('--v2-layer-drag-x');
    sheet.style.removeProperty('--v2-layer-drag-y');
    pointerId = null;
    delta = 0;
    axis = 'pending';
  };

  const down = (event) => {
    if (dismissing) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (!vertical && event.target.closest?.('input,select,textarea,[contenteditable="true"],[data-v2-layer-gesture-ignore]')) return;
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    delta = 0;
    axis = 'pending';
  };

  const move = (event) => {
    if (event.pointerId !== pointerId) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (axis === 'pending') {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 7) return;
      axis = vertical
        ? (Math.abs(dy) >= Math.abs(dx) * 1.08 ? 'vertical' : 'horizontal')
        : (Math.abs(dx) >= Math.abs(dy) * 1.08 ? 'horizontal' : 'vertical');
      if ((vertical && axis !== 'vertical') || (!vertical && axis !== 'horizontal')) {
        pointerId = null;
        return;
      }
      target.setPointerCapture?.(event.pointerId);
    }
    const raw = vertical ? dy : dx;
    const allowed = kind === 'top' ? Math.min(0, raw) : Math.max(0, raw);
    delta = Math.max(-maxDrag, Math.min(maxDrag, allowed));
    if (delta === 0) return;
    sheet.classList.add('is-dragging');
    sheet.style.setProperty(vertical ? '--v2-layer-drag-y' : '--v2-layer-drag-x', `${delta}px`);
    event.preventDefault();
    event.stopPropagation();
  };

  const up = (event) => {
    if (event.pointerId !== pointerId) return;
    target.releasePointerCapture?.(event.pointerId);
    const passed = kind === 'top' ? delta <= -threshold : delta >= threshold;
    pointerId = null;
    if (!passed) {
      reset();
      return;
    }
    dismissing = true;
    sheet.classList.remove('is-dragging');
    sheet.classList.add('is-dismissing');
    sheet.style.setProperty(vertical ? '--v2-layer-drag-y' : '--v2-layer-drag-x', kind === 'top' ? '-110%' : '110%');
    window.setTimeout(() => onDismiss?.(), 150);
  };

  target.addEventListener('pointerdown', down);
  target.addEventListener('pointermove', move, { passive: false });
  target.addEventListener('pointerup', up);
  target.addEventListener('pointercancel', reset);
  return () => {
    target.removeEventListener('pointerdown', down);
    target.removeEventListener('pointermove', move);
    target.removeEventListener('pointerup', up);
    target.removeEventListener('pointercancel', reset);
  };
}

const v2ModalSurfaceLocks = new WeakMap();

function activeV2ModalSurface(root = null) {
  if (root?.matches?.('[data-v2-z-layer], [data-v2-z]')) return root;
  const closest = root?.closest?.('[data-v2-z-layer], [data-v2-z]');
  if (closest) return closest;
  const app = root?.closest?.('[data-v2-app]') || document.querySelector('[data-v2-app]');
  const layers = [...(app?.querySelectorAll?.('[data-v2-z-layer]') || [])];
  return layers.at(-1)
    || app?.querySelector?.('[data-v2-front] > [data-v2-z]')
    || document.querySelector('.app-content')
    || document.querySelector('#app');
}

function lockV2ModalSurface(host) {
  if (!host?.classList) return;
  const next = (v2ModalSurfaceLocks.get(host) || 0) + 1;
  v2ModalSurfaceLocks.set(host, next);
  host.classList.add('has-v2-layer');
}

function unlockV2ModalSurface(host) {
  if (!host?.classList) return;
  const next = Math.max(0, (v2ModalSurfaceLocks.get(host) || 1) - 1);
  if (next) {
    v2ModalSurfaceLocks.set(host, next);
    return;
  }
  v2ModalSurfaceLocks.delete(host);
  host.classList.remove('has-v2-layer');
}

function currentVisualViewport() {
  const vv = window.visualViewport;
  return {
    offsetLeft: Number(vv?.offsetLeft ?? 0),
    offsetTop: Number(vv?.offsetTop ?? 0),
    width: Number(vv?.width ?? window.innerWidth ?? 0),
    height: Number(vv?.height ?? window.innerHeight ?? 0),
  };
}

function mountV2ModalPortal(host) {
  if (!host) return null;

  const portal = document.createElement('div');
  portal.className = 'v2-layer-portal v2-layer-portal--viewport';
  portal.dataset.v2LayerPortal = '';
  document.body.appendChild(portal);

  const sync = () => {
    if (!portal.isConnected || !host.isConnected) return;
    const geometry = v2ModalPortalGeometry(host.getBoundingClientRect(), currentVisualViewport());
    portal.style.left = `${geometry.left}px`;
    portal.style.top = `${geometry.top}px`;
    portal.style.width = `${geometry.width}px`;
    portal.style.height = `${geometry.height}px`;
  };

  let settleTimers = [];
  const settle = () => {
    sync();
    requestAnimationFrame(sync);
    requestAnimationFrame(() => requestAnimationFrame(sync));
    settleTimers.forEach((timer) => window.clearTimeout(timer));
    settleTimers = [
      window.setTimeout(sync, 80),
      window.setTimeout(sync, 180),
      window.setTimeout(sync, 360),
    ];
  };

  settle();

  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(settle) : null;
  resizeObserver?.observe(host);
  window.addEventListener('resize', settle);
  window.visualViewport?.addEventListener('resize', settle);
  window.visualViewport?.addEventListener('scroll', settle);
  document.addEventListener('focusin', settle, true);
  document.addEventListener('focusout', settle, true);

  return {
    portal,
    sync: settle,
    dispose() {
      resizeObserver?.disconnect();
      settleTimers.forEach((timer) => window.clearTimeout(timer));
      settleTimers = [];
      window.removeEventListener('resize', settle);
      window.visualViewport?.removeEventListener('resize', settle);
      window.visualViewport?.removeEventListener('scroll', settle);
      document.removeEventListener('focusin', settle, true);
      document.removeEventListener('focusout', settle, true);
      if (portal.isConnected) portal.remove();
    },
  };
}

export function mountV2Layer(html, { root = null } = {}) {
  const template = document.createElement('template');
  template.innerHTML = String(html || '').trim();
  const node = template.content.firstElementChild;
  if (!node?.matches('[data-v2-layer]')) return null;
  const kind = node.dataset.v2LayerKind || 'standard';
  const technical = kind === 'technical';
  const host = technical ? document.body : activeV2ModalSurface(root);
  if (!host) return null;
  const app = technical ? null : host.closest?.('[data-v2-app]');
  const locksHeader = Boolean(app && kind === 'standard');
  const header = locksHeader ? app.querySelector?.('[data-v2-header]') : null;
  const portalOwner = technical ? null : mountV2ModalPortal(host);
  const mountHost = portalOwner?.portal || host;
  node.classList.add(technical ? 'v2-layer-backdrop--technical' : 'v2-layer-backdrop--contained');
  if (!technical && host.matches?.('[data-v2-z], [data-v2-z-layer]')) lockV2ModalSurface(host);
  if (header) {
    header.inert = true;
    header.classList.add('is-modal-locked');
  }
  mountHost.appendChild(node);
  node.v2Portal = portalOwner?.portal || null;

  let disposeGesture = () => {};
  const stopPointerPropagation = (event) => event.stopPropagation();
  ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'].forEach((type) => {
    node.addEventListener(type, stopPointerPropagation);
  });

  const close = () => {
    disposeGesture();
    if (node.isConnected) node.remove();
    portalOwner?.dispose();
    if (!technical && host.matches?.('[data-v2-z], [data-v2-z-layer]')) unlockV2ModalSurface(host);
    if (locksHeader && app && !app.querySelector('[data-v2-layer-kind="standard"]')) {
      const currentHeader = app.querySelector?.('[data-v2-header]');
      if (currentHeader) {
        currentHeader.inert = false;
        currentHeader.classList.remove('is-modal-locked');
      }
    }
  };
  node.v2Close = close;
  disposeGesture = initV2LayerDismissGesture(node, {
    kind,
    onDismiss: () => node.v2Close?.(),
  });
  node.addEventListener('click', (event) => {
    if (event.target.closest('[data-v2-layer-close]')) node.v2Close?.();
  });
  return node;
}

export function initV2Swipe(root, { onRight = null, onLeft = null, threshold = 72, maxDrag = 180, revealDeck = true } = {}) {
  const surface = root?.matches?.('[data-v2-z], [data-v2-z-layer]') ? root : root?.querySelector?.('[data-v2-z], [data-v2-z-layer]');
  if (!surface) return () => {};
  const app = surface.closest?.('[data-v2-app]');
  const isLayer = surface.matches?.('[data-v2-z-layer]');
  const isBaseZ = surface.matches?.('[data-v2-z]') && !isLayer;
  const hasDeck = revealDeck && isBaseZ && Boolean(app?.querySelector?.('[data-v2-deck]'));
  let pointerId = null;
  let startX = 0;
  let startY = 0;
  let dx = 0;
  let axis = 'pending';
  let suppressNextClick = false;

  const isTopmost = () => {
    const layers = [...(app?.querySelectorAll?.('[data-v2-z-layer]') || [])];
    if (isLayer) return layers.at(-1) === surface;
    return layers.length === 0;
  };

  const reset = () => {
    surface.style.removeProperty('--v2-drag-x');
    surface.classList.remove('is-dragging');
    app?.classList.remove('is-revealing-deck');
    pointerId = null;
    dx = 0;
    axis = 'pending';
  };

  const down = (event) => {
    if (!isTopmost()) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (event.target.closest?.('button,input,select,textarea,label,[contenteditable="true"],[data-v2-stage-gesture-ignore]')) return;
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    dx = 0;
    axis = 'pending';
    suppressNextClick = false;
  };
  const move = (event) => {
    if (event.pointerId !== pointerId) return;
    const nextX = event.clientX - startX;
    const nextY = event.clientY - startY;
    if (axis === 'pending') {
      if (Math.max(Math.abs(nextX), Math.abs(nextY)) < 7) return;
      axis = Math.abs(nextX) >= Math.abs(nextY) * 1.08 ? 'horizontal' : 'vertical';
      if (axis === 'vertical') {
        pointerId = null;
        return;
      }
      surface.setPointerCapture?.(event.pointerId);
    }
    if (axis !== 'horizontal') return;
    const allowedX = nextX > 0 ? (onRight ? nextX : 0) : (onLeft ? nextX : 0);
    dx = Math.max(-maxDrag, Math.min(maxDrag, allowedX));
    if (hasDeck && dx > 0 && onRight && !app?.classList.contains('is-deck-open')) {
      app?.classList.add('is-revealing-deck');
    } else if (dx <= 0) {
      app?.classList.remove('is-revealing-deck');
    }
    if (dx !== 0) {
      surface.classList.add('is-dragging');
      surface.style.setProperty('--v2-drag-x', `${dx}px`);
      if (Math.abs(nextX) > 7) suppressNextClick = true;
    }
    event.preventDefault();
  };
  const up = (event) => {
    if (event.pointerId !== pointerId) return;
    const finalDx = dx;
    const finalAxis = axis;
    surface.releasePointerCapture?.(event.pointerId);
    pointerId = null;
    dx = 0;
    axis = 'pending';
    if (finalAxis === 'horizontal' && finalDx >= threshold) onRight?.();
    else if (finalAxis === 'horizontal' && finalDx <= -threshold) onLeft?.();
    surface.classList.remove('is-dragging');
    surface.style.removeProperty('--v2-drag-x');
    app?.classList.remove('is-revealing-deck');
  };

  const click = (event) => {
    if (!suppressNextClick) return;
    suppressNextClick = false;
    event.preventDefault();
    event.stopPropagation();
  };

  surface.addEventListener('pointerdown', down);
  surface.addEventListener('pointermove', move, { passive: false });
  surface.addEventListener('pointerup', up);
  surface.addEventListener('pointercancel', reset);
  surface.addEventListener('click', click, true);
  return () => {
    surface.removeEventListener('pointerdown', down);
    surface.removeEventListener('pointermove', move);
    surface.removeEventListener('pointerup', up);
    surface.removeEventListener('pointercancel', reset);
    surface.removeEventListener('click', click, true);
  };
}

export function setV2DeckOpen(root, open) {
  const app = root?.matches?.('[data-v2-app]')
    ? root
    : root?.closest?.('[data-v2-app]') || root?.querySelector?.('[data-v2-app]');
  if (!app) return false;
  const next = Boolean(open);
  app.classList.toggle('is-deck-open', next);
  app.classList.remove('is-revealing-deck');
  if (!next) app.classList.remove('is-e-open');
  return next;
}

export function initV2WorkspaceInteraction(root, {
  activeId = '',
  eActiveId = '',
  deckOpen = false,
  eOpen = false,
  onRootSelect = null,
  onSecondarySelect = null,
  onDeckOpenChange = null,
  onEOpenChange = null,
  onZRight = null,
  onZLeft = null,
  bindZ = true,
  threshold = 42,
  maxDrag = 180,
} = {}) {
  const app = root?.matches?.('[data-v2-app]')
    ? root
    : root?.closest?.('[data-v2-app]') || root?.querySelector?.('[data-v2-app]');
  if (!app) return () => {};

  const stage = app.querySelector('.v2-app__stage');
  const front = app.querySelector('[data-v2-front]');
  const deck = app.querySelector('[data-v2-deck]');
  const eDeck = app.querySelector('[data-v2-e-list]');
  const z = app.querySelector('[data-v2-front] > [data-v2-z]');
  if (!stage || !front) return () => {};

  const fCards = [...(deck?.querySelectorAll?.('.v2-deck__card') || [])];
  const eCards = [...(eDeck?.querySelectorAll?.('.v2-e-card') || [])];
  let fActiveIndex = Math.max(0, fCards.findIndex((card) => String(card.getAttribute('data-account-deck-item') || card.getAttribute('data-v2-deck-item') || '') === String(activeId || '')));
  let eActiveIndex = Math.max(0, eCards.findIndex((card) => String(card.getAttribute('data-v2-secondary-item') || card.getAttribute('data-v2-e-item') || '') === String(eActiveId || '')));
  let open = Boolean(deckOpen);
  let secondaryOpen = Boolean(open && eOpen && eCards.length);
  let gesture = null;
  let suppressNextClick = false;
  let suppressTimer = 0;

  const fId = (card) => String(card?.getAttribute('data-account-deck-item') || card?.getAttribute('data-v2-deck-item') || '');
  const eId = (card) => String(card?.getAttribute('data-v2-secondary-item') || card?.getAttribute('data-v2-e-item') || '');

  const clampScroll = (node, value, axis = 'x') => {
    if (!node) return 0;
    const max = axis === 'x'
      ? Math.max(0, Number(node.scrollWidth || 0) - Number(node.clientWidth || 0))
      : Math.max(0, Number(node.scrollHeight || 0) - Number(node.clientHeight || 0));
    return Math.max(0, Math.min(max, Number(value || 0)));
  };

  const centerCard = (scroller, card, axis = 'x') => {
    if (!scroller || !card) return;
    if (axis === 'x') {
      const next = Number(card.offsetLeft || 0) - (Number(scroller.clientWidth || 0) - Number(card.offsetWidth || 0)) / 2;
      scroller.scrollLeft = clampScroll(scroller, next, 'x');
      return;
    }
    const next = Number(card.offsetTop || 0) - (Number(scroller.clientHeight || 0) - Number(card.offsetHeight || 0)) / 2;
    scroller.scrollTop = clampScroll(scroller, next, 'y');
  };

  const centerF = () => centerCard(deck, fCards[fActiveIndex], 'x');
  const centerE = () => centerCard(eDeck, eCards[eActiveIndex], 'y');

  const syncF = () => {
    fCards.forEach((card, index) => {
      const active = index === fActiveIndex;
      card.classList.toggle('is-active', active);
      if (active) card.setAttribute('aria-current', 'true');
      else card.removeAttribute('aria-current');
    });
  };

  const syncE = () => {
    eCards.forEach((card, index) => {
      const active = index === eActiveIndex;
      card.classList.toggle('is-active', active);
      if (active) card.setAttribute('aria-current', 'true');
      else card.removeAttribute('aria-current');
    });
  };

  const horizontalGestureContext = (target) => {
    let node = target?.nodeType === 1 ? target : target?.parentElement;
    let scrollOwner = null;
    while (node && node !== z && node !== stage) {
      if (node.matches?.('[data-v2-stage-gesture-ignore]')) {
        return { blocked: true, scrollOwner: null };
      }
      const style = window.getComputedStyle?.(node);
      const overflowX = style?.overflowX || '';
      if (!scrollOwner && (overflowX === 'auto' || overflowX === 'scroll') && Number(node.scrollWidth || 0) > Number(node.clientWidth || 0) + 2) {
        scrollOwner = node;
      }
      node = node.parentElement;
    }
    return { blocked: false, scrollOwner };
  };

  const markSuppressClick = () => {
    suppressNextClick = true;
    if (suppressTimer) window.clearTimeout(suppressTimer);
    suppressTimer = window.setTimeout(() => {
      suppressNextClick = false;
      suppressTimer = 0;
    }, 350);
  };

  const clearMotion = () => {
    app.classList.remove('is-revealing-deck');
    front.classList.remove('is-dragging');
    front.style.removeProperty('--v2-front-drag-x');
    eDeck?.classList.remove('is-dragging');
    eDeck?.style.removeProperty('--v2-e-drag-x');
  };

  const setEOpen = (nextOpen, notify = true) => {
    secondaryOpen = Boolean(open && nextOpen && eCards.length);
    app.classList.toggle('is-e-open', secondaryOpen);
    clearMotion();
    if (secondaryOpen) requestAnimationFrame(centerE);
    if (notify) onEOpenChange?.(secondaryOpen);
    return secondaryOpen;
  };

  const setOpen = (nextOpen, notify = true) => {
    open = setV2DeckOpen(app, nextOpen);
    if (!open) {
      secondaryOpen = false;
      app.classList.remove('is-e-open');
    }
    clearMotion();
    if (open) requestAnimationFrame(centerF);
    if (notify) onDeckOpenChange?.(open);
    return open;
  };

  const endGesture = () => {
    if (gesture?.captured && gesture.pointerId != null) {
      try { stage.releasePointerCapture?.(gesture.pointerId); } catch {}
    }
    gesture = null;
    clearMotion();
  };

  setOpen(open, false);
  setEOpen(secondaryOpen, false);
  syncF();
  syncE();
  requestAnimationFrame(() => {
    centerF();
    if (secondaryOpen) centerE();
  });

  const down = (event) => {
    if (gesture) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (event.target.closest?.('[data-v2-layer], [data-v2-z-layer]')) return;
    if (app.querySelector('[data-v2-z-layer]')) return;

    let role = '';
    let horizontalContext = null;
    let forceNavigation = false;
    const stageRect = stage.getBoundingClientRect?.();
    const zRect = z?.getBoundingClientRect?.();
    const navigationEdge = Number(zRect?.left || stageRect?.left || 0) + 36;
    const inNavigationGutter = !open && bindZ && Number(event.clientX || 0) <= navigationEdge;

    if (secondaryOpen && eDeck?.contains(event.target)) {
      role = 'e';
    } else if (!open && bindZ && (z?.contains(event.target) || inNavigationGutter)) {
      forceNavigation = inNavigationGutter;
      horizontalContext = forceNavigation ? { blocked: false, scrollOwner: null } : horizontalGestureContext(event.target);
      if (horizontalContext.blocked) return;
      role = 'z';
    } else {
      return;
    }

    gesture = {
      pointerId: event.pointerId,
      role,
      startX: event.clientX,
      startY: event.clientY,
      dx: 0,
      dy: 0,
      axis: 'pending',
      cancelled: false,
      captured: false,
      forceNavigation,
      zScrollTop: role === 'z' ? Number(z?.scrollTop || 0) : 0,
      fScrollLeft: role === 'e' ? Number(deck?.scrollLeft || 0) : 0,
      horizontalContext,
    };
  };

  const move = (event) => {
    if (!gesture || event.pointerId !== gesture.pointerId || gesture.cancelled) return;
    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;
    gesture.dx = dx;
    gesture.dy = dy;

    if (gesture.axis === 'pending') {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 7) return;
      const zRightIntent = gesture.role === 'z' && dx > 0 && Math.abs(dx) >= Math.abs(dy) * .90;
      gesture.axis = zRightIntent || Math.abs(dx) >= Math.abs(dy) * 1.08 ? 'horizontal' : 'vertical';

      if (gesture.role === 'e') {
        if (gesture.axis !== 'horizontal' || dx <= 0) {
          gesture.cancelled = true;
          return;
        }
      } else {
        if (gesture.axis !== 'horizontal') {
          gesture.cancelled = true;
          return;
        }
        const owner = gesture.forceNavigation ? null : gesture.horizontalContext?.scrollOwner;
        if (owner) {
          const maxScrollLeft = Math.max(0, Number(owner.scrollWidth || 0) - Number(owner.clientWidth || 0));
          const scrollLeft = Number(owner.scrollLeft || 0);
          const childCanConsume = (dx > 0 && scrollLeft > 1) || (dx < 0 && scrollLeft < maxScrollLeft - 1);
          if (childCanConsume) {
            gesture.cancelled = true;
            return;
          }
        }
      }

      stage.setPointerCapture?.(event.pointerId);
      gesture.captured = true;
    }

    const dragLimit = Math.max(maxDrag, Number(stage.clientWidth || 0));

    if (gesture.role === 'e') {
      const dragX = Math.max(0, Math.min(dragLimit, dx));
      eDeck?.classList.add('is-dragging');
      eDeck?.style.setProperty('--v2-e-drag-x', `${dragX}px`);
      if (deck && dragX > threshold) {
        const carry = dragX - threshold;
        deck.scrollLeft = clampScroll(deck, gesture.fScrollLeft - carry, 'x');
      }
      if (dragX > 7) markSuppressClick();
      event.preventDefault();
      return;
    }

    if (z && gesture.role === 'z') z.scrollTop = gesture.zScrollTop;
    if (dx > 0 && !onZRight) {
      const dragX = Math.max(0, Math.min(dragLimit, dx));
      front.classList.add('is-dragging');
      front.style.setProperty('--v2-front-drag-x', `${dragX}px`);
      app.classList.add('is-revealing-deck');
    }
    if (Math.abs(dx) > 7) markSuppressClick();
    event.preventDefault();
  };

  const up = (event) => {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    const current = gesture;

    if (current.role === 'e' && !current.cancelled && current.axis === 'horizontal' && current.dx >= threshold) {
      markSuppressClick();
      endGesture();
      setEOpen(false);
      return;
    }

    if (current.role === 'z' && !current.cancelled && current.axis === 'horizontal') {
      if (current.dx >= threshold) {
        markSuppressClick();
        endGesture();
        if (onZRight) onZRight();
        else {
          setOpen(true);
          setEOpen(false, false);
        }
        return;
      }
      if (current.dx <= -threshold && onZLeft) {
        markSuppressClick();
        endGesture();
        onZLeft();
        return;
      }
    }

    endGesture();
  };

  const cancel = (event) => {
    if (!gesture || (event?.pointerId != null && event.pointerId !== gesture.pointerId)) return;
    endGesture();
  };

  const click = (event) => {
    if (suppressNextClick) {
      suppressNextClick = false;
      if (suppressTimer) {
        window.clearTimeout(suppressTimer);
        suppressTimer = 0;
      }
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (!open) return;

    const eCard = secondaryOpen ? event.target.closest?.('.v2-e-card') : null;
    if (eCard && eDeck?.contains(eCard)) {
      const index = eCards.indexOf(eCard);
      if (index >= 0) {
        eActiveIndex = index;
        syncE();
        const id = eId(eCard);
        if (id) onSecondarySelect?.(id);
      }
      return;
    }

    const fCard = event.target.closest?.('.v2-deck__card');
    if (fCard && deck?.contains(fCard)) {
      const index = fCards.indexOf(fCard);
      if (index >= 0) {
        fActiveIndex = index;
        syncF();
        const id = fId(fCard);
        if (id) onRootSelect?.(id);
      }
    }
  };

  stage.addEventListener('pointerdown', down);
  stage.addEventListener('pointermove', move, { passive: false });
  stage.addEventListener('pointerup', up);
  stage.addEventListener('pointercancel', cancel);
  stage.addEventListener('click', click, true);

  return () => {
    if (suppressTimer) window.clearTimeout(suppressTimer);
    endGesture();
    stage.removeEventListener('pointerdown', down);
    stage.removeEventListener('pointermove', move);
    stage.removeEventListener('pointerup', up);
    stage.removeEventListener('pointercancel', cancel);
    stage.removeEventListener('click', click, true);
  };
}

export function initV2StickerSwipe(root, { onRight = null, onLeft = null, threshold = 64, maxDrag = 180 } = {}) {
  const surface = root?.matches?.('[data-v2-sticker]') ? root : root?.querySelector?.('[data-v2-sticker]');
  if (!surface) return () => {};
  let pointerId = null;
  let startX = 0;
  let startY = 0;
  let dx = 0;
  let axis = 'pending';

  const reset = () => {
    surface.style.removeProperty('--v2-sticker-drag-x');
    surface.classList.remove('is-dragging');
    pointerId = null;
    dx = 0;
    axis = 'pending';
  };
  const down = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    dx = 0;
    axis = 'pending';
  };
  const move = (event) => {
    if (event.pointerId !== pointerId) return;
    const nextX = event.clientX - startX;
    const nextY = event.clientY - startY;
    if (axis === 'pending') {
      if (Math.max(Math.abs(nextX), Math.abs(nextY)) < 12) return;
      axis = Math.abs(nextX) > Math.abs(nextY) * 1.25 ? 'horizontal' : 'vertical';
      if (axis === 'vertical') {
        pointerId = null;
        return;
      }
      surface.setPointerCapture?.(event.pointerId);
    }
    if (axis !== 'horizontal') return;
    const allowedX = nextX > 0 ? (onRight ? nextX : 0) : (onLeft ? nextX : 0);
    dx = Math.max(-maxDrag, Math.min(maxDrag, allowedX));
    if (dx !== 0) {
      surface.classList.add('is-dragging');
      surface.style.setProperty('--v2-sticker-drag-x', `${dx}px`);
    }
    event.preventDefault();
  };
  const up = (event) => {
    if (event.pointerId !== pointerId) return;
    const finalDx = dx;
    reset();
    if (finalDx >= threshold) onRight?.();
    else if (finalDx <= -threshold) onLeft?.();
  };
  surface.addEventListener('pointerdown', down);
  surface.addEventListener('pointermove', move, { passive: false });
  surface.addEventListener('pointerup', up);
  surface.addEventListener('pointercancel', reset);
  return () => {
    surface.removeEventListener('pointerdown', down);
    surface.removeEventListener('pointermove', move);
    surface.removeEventListener('pointerup', up);
    surface.removeEventListener('pointercancel', reset);
  };
}
