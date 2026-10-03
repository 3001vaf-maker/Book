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
  const settingsTag = kind === 'avatar' && slot.settingsTag
    ? '<span class="v2-header__settings-tag" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.86 2.86-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.1A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.86-2.86.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.1A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06L7.06 3.8l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.86 2.86-.06.06A1.7 1.7 0 0 0 19.4 9c.13.36.34.7.6 1 .28.3.67.47 1.1.5h.1v4h-.1a1.7 1.7 0 0 0-1.7.5Z"></path></svg></span>'
    : '';
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
  return `<div class="v2-header__slot v2-header__slot--${role}"><button type="button" class="v2-header__control v2-header__control--${kind}${variantClass}"${dataAttributes(slot.data)} aria-label="${aria}"${slot.disabled ? ' disabled' : ''}>${body}${settingsTag}${badge}</button></div>`;
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

export function v2CardDeck(items = [], {
  axis = 'x',
  active = '',
  data = 'data-v2-deck-item',
  className = '',
  role = '',
  level = 'f',
} = {}) {
  const values = (Array.isArray(items) ? items : []).filter(Boolean).slice(0, 7);
  if (!values.length) return '';
  const resolvedAxis = axis === 'y' ? 'y' : 'x';
  const activeId = String(active || values[0]?.id || '0');
  const activeIndex = Math.max(0, values.findIndex((item, index) => String(item.id || index) === activeId));
  const classes = ['v2-card-deck', `v2-card-deck--${resolvedAxis}`, className].filter(Boolean).join(' ');
  const roleData = role ? ` data-v2-deck-role="${text(role)}"` : '';
  return `<div class="${text(classes)}" data-v2-card-deck data-v2-deck-axis="${resolvedAxis}" data-v2-deck-level="${text(level)}" data-v2-deck-count="${values.length}"${roleData}>${values.map((item, index) => {
    const id = String(item.id || index);
    const isActive = index === activeIndex;
    const childrenCount = Number(item.childrenCount || item.children || 0);
    const customData = data ? ` ${data}="${text(id)}"` : '';
    return `<button type="button" class="v2-card-deck__card${isActive ? ' is-active' : ''}" data-v2-card-item="${text(id)}"${customData} data-v2-card-index="${index}" aria-label="${text(item.aria || item.label || '')}"${isActive ? ' aria-current="true"' : ''}>${level === 'f' ? v2NestedMark(childrenCount) : ''}${v2NavigationIcon(item.icon || id)}<strong>${text(item.label || '')}</strong></button>`;
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
      <div class="v2-edge-swipe-zone" data-v2-edge-swipe aria-hidden="true"></div>
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
  if (!stack) host.querySelectorAll('[data-v2-z-layer]').forEach((layer) => {
    if (typeof layer.v2Dispose === 'function') layer.v2Dispose();
    else layer.remove();
  });
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
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    contextObserver.disconnect();
    disposeSwipe();
    if (node.isConnected) node.remove();
    app?.classList.toggle('has-z-layer', Boolean(host.querySelector('[data-v2-z-layer]')));
    notify();
  };
  const close = () => {
    if (disposed) return;
    dispose();
    onClose?.();
  };
  node.addEventListener('click', (event) => {
    if (event.target.closest?.('[data-v2-z-close]')) close();
  });
  disposeSwipe = initV2Swipe(node, { onRight: close, revealDeck: false, threshold: 28, edgeWidth: 36 });
  node.v2Dispose = dispose;
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

function retainV2EdgeHost(host) {
  if (!host) return () => {};
  const next = Number(host.dataset.v2EdgeOwners || 0) + 1;
  host.dataset.v2EdgeOwners = String(next);
  host.classList.add('is-active');
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const count = Math.max(0, Number(host.dataset.v2EdgeOwners || 1) - 1);
    if (count) host.dataset.v2EdgeOwners = String(count);
    else {
      delete host.dataset.v2EdgeOwners;
      host.classList.remove('is-active');
    }
  };
}

export function initV2Swipe(root, {
  onRight = null,
  onLeft = null,
  threshold = 28,
  maxDrag = 180,
  revealDeck = true,
  edgeWidth = 36,
} = {}) {
  const surface = root?.matches?.('[data-v2-z], [data-v2-z-layer]')
    ? root
    : root?.querySelector?.('[data-v2-z], [data-v2-z-layer]');
  if (!surface) return () => {};
  const app = surface.closest?.('[data-v2-app]');
  const stage = app?.querySelector?.('.v2-app__stage') || surface.parentElement;
  const isLayer = surface.matches?.('[data-v2-z-layer]');
  const isBaseZ = surface.matches?.('[data-v2-z]') && !isLayer;
  const front = app?.querySelector?.('[data-v2-front]');
  const dragSurface = isBaseZ && front ? front : surface;
  const dragProperty = isBaseZ && front ? '--v2-front-drag-x' : '--v2-drag-x';
  const hasDeck = revealDeck && isBaseZ && Boolean(app?.querySelector?.('[data-v2-card-deck][data-v2-deck-level="f"]'));
  const edgeHost = onRight ? app?.querySelector?.('[data-v2-edge-swipe]') : null;
  const gestureHost = edgeHost || stage || surface;
  const releaseEdgeHost = retainV2EdgeHost(edgeHost);
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

  const clear = () => {
    dragSurface.style.removeProperty(dragProperty);
    dragSurface.classList.remove('is-dragging');
    app?.classList.remove('is-revealing-deck');
    pointerId = null;
    dx = 0;
    axis = 'pending';
  };

  const down = (event) => {
    if (!isTopmost()) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const stageRect = stage?.getBoundingClientRect?.() || surface.getBoundingClientRect?.();
    const leftEdge = Number(stageRect?.left || 0) + Number(edgeWidth || 36);
    const rightEdge = Number(stageRect?.right || 0) - Number(edgeWidth || 36);
    const wantsRight = Boolean(onRight) && (Boolean(edgeHost) || Number(event.clientX || 0) <= leftEdge);
    const wantsLeft = Boolean(onLeft) && !edgeHost && Number(event.clientX || 0) >= rightEdge;
    if (!wantsRight && !wantsLeft) return;
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
      if (Math.max(Math.abs(nextX), Math.abs(nextY)) < 4) return;
      const horizontal = Math.abs(nextX) >= Math.abs(nextY) * .72;
      const allowedDirection = (nextX > 0 && onRight) || (nextX < 0 && onLeft);
      if (!horizontal || !allowedDirection) {
        clear();
        return;
      }
      axis = 'horizontal';
      gestureHost.setPointerCapture?.(event.pointerId);
    }
    const allowedX = nextX > 0 ? (onRight ? nextX : 0) : (onLeft ? nextX : 0);
    dx = Math.max(-maxDrag, Math.min(maxDrag, allowedX));
    if (hasDeck && dx > 0 && onRight && !app?.classList.contains('is-deck-open')) {
      app?.classList.add('is-revealing-deck');
    }
    dragSurface.classList.add('is-dragging');
    dragSurface.style.setProperty(dragProperty, `${dx}px`);
    if (Math.abs(nextX) > 7) suppressNextClick = true;
    event.preventDefault();
  };

  const up = (event) => {
    if (event.pointerId !== pointerId) return;
    const finalDx = dx;
    const finalAxis = axis;
    try {
      if (gestureHost.hasPointerCapture?.(event.pointerId)) gestureHost.releasePointerCapture?.(event.pointerId);
    } catch {}
    clear();
    if (finalAxis !== 'horizontal') return;
    if (finalDx >= threshold) onRight?.();
    else if (finalDx <= -threshold) onLeft?.();
  };

  const click = (event) => {
    if (!suppressNextClick) return;
    suppressNextClick = false;
    event.preventDefault();
    event.stopPropagation();
  };

  gestureHost.addEventListener('pointerdown', down);
  gestureHost.addEventListener('pointermove', move, { passive: false });
  gestureHost.addEventListener('pointerup', up);
  gestureHost.addEventListener('pointercancel', clear);
  gestureHost.addEventListener('click', click, true);
  return () => {
    gestureHost.removeEventListener('pointerdown', down);
    gestureHost.removeEventListener('pointermove', move);
    gestureHost.removeEventListener('pointerup', up);
    gestureHost.removeEventListener('pointercancel', clear);
    gestureHost.removeEventListener('click', click, true);
    releaseEdgeHost();
  };
}


export function setV2DeckOpen(root, open) {
  const app = root?.matches?.('[data-v2-app]')
    ? root
    : root?.closest?.('[data-v2-app]') || root?.querySelector?.('[data-v2-app]');
  if (!app) return false;
  const next = Boolean(open);
  if (next) app.classList.remove('is-z-entering');
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
  threshold = 28,
  maxDrag = 180,
  edgeWidth = 36,
} = {}) {
  const app = root?.matches?.('[data-v2-app]')
    ? root
    : root?.closest?.('[data-v2-app]') || root?.querySelector?.('[data-v2-app]');
  if (!app) return () => {};

  const stage = app.querySelector('.v2-app__stage');
  const front = app.querySelector('[data-v2-front]');
  const fDeck = app.querySelector('[data-v2-card-deck][data-v2-deck-level="f"]');
  const eDeck = app.querySelector('[data-v2-card-deck][data-v2-deck-level="e"]');
  const z = app.querySelector('[data-v2-front] > [data-v2-z]');
  const edgeHost = app.querySelector('[data-v2-edge-swipe]') || stage;
  if (!stage || !front) return () => {};
  const releaseEdgeHost = retainV2EdgeHost(bindZ && edgeHost?.matches?.('[data-v2-edge-swipe]') ? edgeHost : null);

  const fCards = [...(fDeck?.querySelectorAll?.('[data-v2-card-item]') || [])];
  const eCards = [...(eDeck?.querySelectorAll?.('[data-v2-card-item]') || [])];
  let fActiveIndex = Math.max(0, fCards.findIndex((card) => String(card.getAttribute('data-v2-card-item') || '') === String(activeId || '')));
  let eActiveIndex = Math.max(0, eCards.findIndex((card) => String(card.getAttribute('data-v2-card-item') || '') === String(eActiveId || '')));
  let open = Boolean(deckOpen);
  let secondaryOpen = Boolean(open && eOpen && eCards.length);
  let zGesture = null;
  let eGesture = null;
  let eDismissTimer = 0;
  const disposers = [];
  const scrollFrames = new Map();
  const cardId = (card) => String(card?.getAttribute('data-v2-card-item') || '');

  const setActiveCard = (cards, index) => {
    cards.forEach((card, cardIndex) => {
      const active = cardIndex === index;
      card.classList.toggle('is-active', active);
      if (active) card.setAttribute('aria-current', 'true');
      else card.removeAttribute('aria-current');
    });
  };

  setActiveCard(fCards, fActiveIndex);
  setActiveCard(eCards, eActiveIndex);

  const updateDeckGeometry = (deck, cards, axis) => {
    if (!deck || !cards.length) return -1;
    const center = axis === 'y' ? Number(deck.clientHeight || 0) / 2 : Number(deck.clientWidth || 0) / 2;
    const scroll = axis === 'y' ? Number(deck.scrollTop || 0) : Number(deck.scrollLeft || 0);

    // Read all layout geometry first. Mixing offset reads with style writes card-by-card
    // forces repeated layout work and makes the deck feel behind the finger.
    const metrics = cards.map((card, index) => {
      const cardCenter = axis === 'y'
        ? Number(card.offsetTop || 0) - scroll + Number(card.offsetHeight || 0) / 2
        : Number(card.offsetLeft || 0) - scroll + Number(card.offsetWidth || 0) / 2;
      const span = Math.max(1, axis === 'y' ? Number(card.offsetHeight || 0) : Number(card.offsetWidth || 0));
      const signed = (cardCenter - center) / Math.max(1, span * .72);
      const absolute = Math.min(2.6, Math.abs(signed));
      return {
        card,
        index,
        distance: Math.abs(cardCenter - center),
        depth: -Math.min(180, absolute * 82),
        scale: 1 - Math.min(.13, absolute * .055),
        opacity: 1 - Math.min(.38, absolute * .16),
        brightness: 1 - Math.min(.22, absolute * .09),
        rotation: Math.max(-13, Math.min(13, signed * (axis === 'y' ? -6.5 : 7.5))),
        shift: Math.max(-18, Math.min(18, signed * -8)),
        stack: Math.max(1, 100 - Math.round(absolute * 24)),
      };
    });

    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    metrics.forEach((metric) => {
      const { card } = metric;
      card.style.setProperty('--v2-card-depth', `${metric.depth}px`);
      card.style.setProperty('--v2-card-scale', metric.scale.toFixed(4));
      card.style.setProperty('--v2-card-opacity', metric.opacity.toFixed(4));
      card.style.setProperty('--v2-card-brightness', metric.brightness.toFixed(4));
      card.style.setProperty('--v2-card-rotation', `${metric.rotation.toFixed(3)}deg`);
      card.style.setProperty('--v2-card-shift', `${metric.shift.toFixed(3)}px`);
      card.style.setProperty('--v2-card-stack', String(metric.stack));
      if (metric.distance < nearestDistance) {
        nearestDistance = metric.distance;
        nearestIndex = metric.index;
      }
    });

    setActiveCard(cards, nearestIndex);
    return nearestIndex;
  };

  const scheduleGeometry = (deck, cards, axis, assign) => {
    if (!deck) return;
    const prior = scrollFrames.get(deck);
    if (prior) cancelAnimationFrame(prior);
    const frame = requestAnimationFrame(() => {
      scrollFrames.delete(deck);
      const index = updateDeckGeometry(deck, cards, axis);
      if (index >= 0) assign(index);
    });
    scrollFrames.set(deck, frame);
  };

  const centerCard = (card, axis, behavior = 'auto') => {
    const deck = card?.closest?.('[data-v2-card-deck]');
    if (!card || !deck) return;
    const target = axis === 'y'
      ? Math.max(0, Math.min(
        Math.max(0, Number(deck.scrollHeight || 0) - Number(deck.clientHeight || 0)),
        Number(card.offsetTop || 0) + Number(card.offsetHeight || 0) / 2 - Number(deck.clientHeight || 0) / 2,
      ))
      : Math.max(0, Math.min(
        Math.max(0, Number(deck.scrollWidth || 0) - Number(deck.clientWidth || 0)),
        Number(card.offsetLeft || 0) + Number(card.offsetWidth || 0) / 2 - Number(deck.clientWidth || 0) / 2,
      ));

    if (behavior === 'smooth') {
      if (axis === 'y') deck.scrollTo({ top:target, behavior:'smooth' });
      else deck.scrollTo({ left:target, behavior:'smooth' });
      return;
    }

    // State restore/open must land on the exact semantic card. Native mandatory
    // snap may otherwise reinterpret a large programmatic jump as a fling and
    // choose the neighbouring snap point.
    const previousSnap = deck.style.scrollSnapType;
    deck.style.scrollSnapType = 'none';
    if (axis === 'y') deck.scrollTop = target;
    else deck.scrollLeft = target;
    void deck.offsetWidth;
    deck.style.scrollSnapType = previousSnap;
  };

  const bindNativeDeck = (deck, cards, axis, getActiveIndex, setActiveIndex, onSelect, isEnabled = () => true) => {
    if (!deck || !cards.length) return;
    let pointer = null;
    let suppressClick = false;
    let settleTimer = 0;

    const refresh = () => {
      if (!isEnabled()) return;
      scheduleGeometry(deck, cards, axis, setActiveIndex);
    };
    const settle = () => {
      if (!isEnabled()) return;
      if (settleTimer) window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        if (!isEnabled()) return;
        const next = updateDeckGeometry(deck, cards, axis);
        if (next >= 0) setActiveIndex(next);
      }, 90);
    };
    const down = (event) => {
      if (!isEnabled()) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      pointer = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        dragged: false,
      };
      suppressClick = false;
    };
    const move = (event) => {
      if (!pointer || event.pointerId !== pointer.id) return;
      const dx = event.clientX - pointer.x;
      const dy = event.clientY - pointer.y;
      if (Math.hypot(dx, dy) >= 9) pointer.dragged = true;
    };
    const up = (event) => {
      if (!pointer || event.pointerId !== pointer.id) return;
      suppressClick = pointer.dragged;
      pointer = null;
    };
    const cancel = () => {
      pointer = null;
      suppressClick = true;
    };
    const click = (event) => {
      if (!isEnabled()) return;
      const card = event.target.closest?.('[data-v2-card-item]');
      if (!card || !deck.contains(card)) return;
      if (suppressClick) {
        suppressClick = false;
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      const index = cards.indexOf(card);
      if (index < 0) return;
      setActiveIndex(index);
      setActiveCard(cards, index);
      const id = cardId(card);
      if (id) onSelect?.(id);
    };

    deck.addEventListener('scroll', refresh, { passive: true });
    deck.addEventListener('scroll', settle, { passive: true });
    deck.addEventListener('pointerdown', down, { passive: true });
    deck.addEventListener('pointermove', move, { passive: true });
    deck.addEventListener('pointerup', up, { passive: true });
    deck.addEventListener('pointercancel', cancel, { passive: true });
    deck.addEventListener('click', click, true);
    disposers.push(() => {
      if (settleTimer) window.clearTimeout(settleTimer);
      deck.removeEventListener('scroll', refresh);
      deck.removeEventListener('scroll', settle);
      deck.removeEventListener('pointerdown', down);
      deck.removeEventListener('pointermove', move);
      deck.removeEventListener('pointerup', up);
      deck.removeEventListener('pointercancel', cancel);
      deck.removeEventListener('click', click, true);
    });
  };

  const setEOpen = (nextOpen, notify = true) => {
    if (eDismissTimer) {
      window.clearTimeout(eDismissTimer);
      eDismissTimer = 0;
    }
    secondaryOpen = Boolean(open && nextOpen && eCards.length);
    app.classList.toggle('is-e-open', secondaryOpen);
    eDeck?.style.removeProperty('--v2-e-dismiss-x');
    eDeck?.classList.remove('is-dragging');
    if (secondaryOpen) {
      setActiveCard(eCards, eActiveIndex);
      centerCard(eCards[eActiveIndex], 'y');
      const index = updateDeckGeometry(eDeck, eCards, 'y');
      if (index >= 0) eActiveIndex = index;
    }
    if (notify) onEOpenChange?.(secondaryOpen);
    return secondaryOpen;
  };

  const setOpen = (nextOpen, notify = true) => {
    open = setV2DeckOpen(app, nextOpen);
    if (!open) {
      secondaryOpen = false;
      app.classList.remove('is-e-open');
    }
    front.classList.remove('is-dragging');
    front.style.removeProperty('--v2-front-drag-x');
    if (open) {
      setActiveCard(fCards, fActiveIndex);
      centerCard(fCards[fActiveIndex], 'x');
      const index = updateDeckGeometry(fDeck, fCards, 'x');
      if (index >= 0) fActiveIndex = index;
    }
    if (notify) onDeckOpenChange?.(open);
    return open;
  };

  const clearZEntry = (event) => {
    if (event.animationName === 'v2-z-enter-from-right') app.classList.remove('is-z-entering');
  };
  front.addEventListener('animationend', clearZEntry);
  disposers.push(() => front.removeEventListener('animationend', clearZEntry));

  bindNativeDeck(
    fDeck,
    fCards,
    'x',
    () => fActiveIndex,
    (index) => { fActiveIndex = index; },
    (id) => onRootSelect?.(id),
    () => open && !secondaryOpen,
  );
  bindNativeDeck(
    eDeck,
    eCards,
    'y',
    () => eActiveIndex,
    (index) => { eActiveIndex = index; },
    (id) => onSecondarySelect?.(id),
    () => secondaryOpen,
  );

  const eDown = (event) => {
    if (!secondaryOpen || !eDeck?.contains(event.target)) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    eGesture = { id:event.pointerId, x:event.clientX, y:event.clientY, dx:0, axis:'pending' };
  };
  const eMove = (event) => {
    if (!eGesture || event.pointerId !== eGesture.id) return;
    const dx = event.clientX - eGesture.x;
    const dy = event.clientY - eGesture.y;
    eGesture.dx = dx;
    if (eGesture.axis === 'pending') {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 7) return;
      if (Math.abs(dy) >= Math.abs(dx) * 1.05 || dx <= 0) {
        eGesture = null;
        return;
      }
      eGesture.axis = 'horizontal';
      eDeck.setPointerCapture?.(event.pointerId);
    }
    const dragX = Math.max(0, Math.min(Math.max(maxDrag, Number(stage.clientWidth || 0)), dx));
    eDeck.classList.add('is-dragging');
    eDeck.style.setProperty('--v2-e-dismiss-x', `${dragX}px`);
    event.preventDefault();
  };
  const eUp = (event) => {
    if (!eGesture || event.pointerId !== eGesture.id) return;
    const current = eGesture;
    eGesture = null;
    try {
      if (eDeck.hasPointerCapture?.(event.pointerId)) eDeck.releasePointerCapture?.(event.pointerId);
    } catch {}

    if (current.axis === 'horizontal' && current.dx >= threshold) {
      // Continue from the finger position instead of snapping E back to x=0 first.
      const currentX = Math.max(0, current.dx);
      const exitX = Math.max(Number(stage.clientWidth || 0), currentX);
      eDeck.style.setProperty('--v2-e-dismiss-x', `${currentX}px`);
      eDeck.classList.remove('is-dragging');
      void eDeck.offsetWidth;
      secondaryOpen = false;
      app.classList.remove('is-e-open');
      eDeck.style.setProperty('--v2-e-dismiss-x', `${exitX}px`);
      onEOpenChange?.(false);
      eDismissTimer = window.setTimeout(() => {
        eDismissTimer = 0;
        if (!secondaryOpen) eDeck.style.removeProperty('--v2-e-dismiss-x');
      }, 260);
      return;
    }

    eDeck.classList.remove('is-dragging');
    eDeck.style.removeProperty('--v2-e-dismiss-x');
  };
  const eCancel = () => {
    eGesture = null;
    eDeck?.classList.remove('is-dragging');
    eDeck?.style.removeProperty('--v2-e-dismiss-x');
  };
  eDeck?.addEventListener('pointerdown', eDown);
  eDeck?.addEventListener('pointermove', eMove, { passive:false });
  eDeck?.addEventListener('pointerup', eUp);
  eDeck?.addEventListener('pointercancel', eCancel);
  disposers.push(() => {
    eDeck?.removeEventListener('pointerdown', eDown);
    eDeck?.removeEventListener('pointermove', eMove);
    eDeck?.removeEventListener('pointerup', eUp);
    eDeck?.removeEventListener('pointercancel', eCancel);
  });

  const clearZGesture = () => {
    if (zGesture?.captured && zGesture.id != null) {
      try {
        if (edgeHost.hasPointerCapture?.(zGesture.id)) edgeHost.releasePointerCapture?.(zGesture.id);
      } catch {}
    }
    zGesture = null;
    front.classList.remove('is-dragging');
    front.style.removeProperty('--v2-front-drag-x');
    app.classList.remove('is-revealing-deck');
  };

  const zDown = (event) => {
    if (!bindZ || open || zGesture || app.querySelector('[data-v2-z-layer]')) return;
    if (event.target.closest?.('[data-v2-layer], [data-v2-z-layer]')) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (edgeHost === stage) {
      const rect = stage.getBoundingClientRect();
      if (Number(event.clientX || 0) > rect.left + edgeWidth) return;
    }
    zGesture = {
      id:event.pointerId,
      x:event.clientX,
      y:event.clientY,
      dx:0,
      axis:'pending',
      captured:false,
      scrollTop:Number(z?.scrollTop || 0),
    };
  };
  const zMove = (event) => {
    if (!zGesture || event.pointerId !== zGesture.id) return;
    const dx = event.clientX - zGesture.x;
    const dy = event.clientY - zGesture.y;
    zGesture.dx = dx;
    if (zGesture.axis === 'pending') {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 4) return;
      if (dx <= 0 || Math.abs(dx) < Math.abs(dy) * .72) {
        clearZGesture();
        return;
      }
      zGesture.axis = 'horizontal';
      edgeHost.setPointerCapture?.(event.pointerId);
      zGesture.captured = true;
    }
    if (z) z.scrollTop = zGesture.scrollTop;
    const dragX = Math.max(0, Math.min(Math.max(maxDrag, Number(stage.clientWidth || 0)), dx));
    front.classList.add('is-dragging');
    front.style.setProperty('--v2-front-drag-x', `${dragX}px`);
    app.classList.add('is-revealing-deck');
    event.preventDefault();
  };
  const zUp = (event) => {
    if (!zGesture || event.pointerId !== zGesture.id) return;
    const current = zGesture;
    clearZGesture();
    if (current.axis !== 'horizontal' || current.dx < threshold) return;
    if (onZRight) onZRight();
    else {
      setOpen(true);
      setEOpen(false, false);
    }
  };
  const zCancel = () => clearZGesture();

  edgeHost.addEventListener('pointerdown', zDown);
  edgeHost.addEventListener('pointermove', zMove, { passive:false });
  edgeHost.addEventListener('pointerup', zUp);
  edgeHost.addEventListener('pointercancel', zCancel);
  disposers.push(() => {
    edgeHost.removeEventListener('pointerdown', zDown);
    edgeHost.removeEventListener('pointermove', zMove);
    edgeHost.removeEventListener('pointerup', zUp);
    edgeHost.removeEventListener('pointercancel', zCancel);
  });

  setOpen(open, false);
  setEOpen(secondaryOpen, false);

  return () => {
    clearZGesture();
    eCancel();
    for (const frame of scrollFrames.values()) cancelAnimationFrame(frame);
    scrollFrames.clear();
    if (eDismissTimer) window.clearTimeout(eDismissTimer);
    eDismissTimer = 0;
    disposers.forEach((dispose) => dispose?.());
    releaseEdgeHost();
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
    try {
      if (surface.hasPointerCapture?.(event.pointerId)) surface.releasePointerCapture?.(event.pointerId);
    } catch {}
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
