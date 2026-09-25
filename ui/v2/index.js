import { escapeHtml } from '../utils/escape-html.js';

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
  const variantClass = slot.variant === 'danger' ? ' v2-header__control--danger' : '';
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

export function v2EList(items = [], { active = '', data = 'data-v2-e-item' } = {}) {
  const values = (Array.isArray(items) ? items : []).filter(Boolean).slice(0, 7);
  if (!values.length) return '';
  const activeId = String(active || values[0]?.id || '0');
  const activeIndex = Math.max(0, values.findIndex((item, index) => String(item.id || index) === activeId));
  const count = values.length;
  return `<div class="v2-e-deck" data-v2-e-list data-v2-e-count="${count}">${values.map((item, index) => {
    const id = String(item.id || index);
    const visualDepth = (index - activeIndex + count) % count;
    const isActive = visualDepth === 0;
    const depthX = visualDepth * 8;
    const depthY = visualDepth * 10;
    const stackZ = Math.max(1, count - visualDepth);
    const classes = ['v2-e-card', isActive ? 'is-active' : 'is-stacked'].filter(Boolean).join(' ');
    const itemData = data ? ` ${data}="${text(id)}"` : '';
    return `<button type="button" class="${classes}" style="--v2-e-depth-x:${depthX}px;--v2-e-depth-y:${depthY}px;--v2-e-stack-z:${stackZ}"${itemData} data-v2-e-index="${index}" aria-label="${text(item.aria || item.label || '')}"><strong>${text(item.label || '')}</strong></button>`;
  }).join('')}</div>`;
}

export function v2FDeck(items = [], { active = '', data = 'data-v2-deck-item', className = '', role = '' } = {}) {
  const values = (Array.isArray(items) ? items : []).filter(Boolean).slice(0, 7);
  if (!values.length) return '';
  const activeId = String(active || values[0]?.id || '0');
  const activeIndex = Math.max(0, values.findIndex((item, index) => String(item.id || index) === activeId));
  const count = values.length;
  const depthStepX = count > 1 ? Math.min(10, 18 / (count - 1)) : 0;
  const deckClasses = ['v2-deck', className].filter(Boolean).join(' ');
  const roleData = role ? ` data-v2-deck-role="${text(role)}"` : '';
  return `<div class="${text(deckClasses)}" data-v2-deck data-v2-deck-count="${count}"${roleData}>${values.map((item, index) => {
    const id = String(item.id || index);
    const visualDepth = (index - activeIndex + count) % count;
    const isActive = visualDepth === 0;
    const depthX = Number((visualDepth * depthStepX).toFixed(2));
    const depthY = visualDepth * 8;
    const stackZ = Math.max(1, count - visualDepth);
    const classes = ['v2-deck__card', isActive ? 'is-active' : 'is-stacked'].filter(Boolean).join(' ');
    const customData = data && data !== 'data-v2-deck-item' ? ` ${data}="${text(id)}"` : '';
    return `<button type="button" class="${classes}" style="--v2-depth:${visualDepth};--v2-depth-x:${depthX}px;--v2-depth-y:${depthY}px;--v2-stack-z:${stackZ}" data-v2-deck-item="${text(id)}"${customData} data-v2-f-index="${index}" aria-label="${text(item.aria || item.label || '')}"><strong>${text(item.label || '')}</strong></button>`;
  }).join('')}</div>`;
}

export function v2Shell({
  header = '',
  body = '',
  deck = '',
  eDeck = '',
  className = '',
  deckOpen = false,
  zData = 'data-v2-z',
} = {}) {
  const classes = ['v2-app', deck ? 'v2-app--with-deck' : '', eDeck ? 'has-e-deck' : '', deckOpen ? 'is-deck-open' : '', className].filter(Boolean).join(' ');
  const feDeck = deck || eDeck ? `<div class="v2-fe-deck" data-v2-fe>${eDeck}${deck}</div>` : '';
  return `<section class="${classes}" data-v2-app>
    ${header}
    <div class="v2-app__stage">
      ${feDeck}
      <main class="v2-z" ${zData}>
${body}
</main>
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

export function v2ServiceStickers(items = [], { selected = [], data = 'data-v2-service' } = {}) {
  const selectedSet = new Set((Array.isArray(selected) ? selected : []).map(String));
  return `<div class="v2-sticker-list v2-sticker-list--services">${(Array.isArray(items) ? items : []).map((item) => {
    const id = String(item.id || '');
    const on = selectedSet.has(id);
    return `<button type="button" class="v2-service-sticker${on ? ' is-selected' : ''}" ${data}="${text(id)}" aria-pressed="${on ? 'true' : 'false'}">
      <span class="v2-service-sticker__text"><strong>${text(item.title || '')}</strong><span>${text(item.secondary || '')}</span></span>
      <span class="v2-service-sticker__price">${text(item.right || '')}</span>
      <span class="v2-service-sticker__selector" aria-hidden="true">${on ? '✓' : ''}</span>
    </button>`;
  }).join('')}</div>`;
}

export function v2Sticker({
  eyebrow = '',
  title = '',
  body = '',
  action = '',
  className = '',
  data = 'data-v2-sticker',
} = {}) {
  return `<section class="v2-sticker-screen ${text(className)}" ${data}>
    <article class="v2-sticker">
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
  if (!stage) return null;
  const template = document.createElement('template');
  template.innerHTML = String(html || '').trim();
  const node = template.content.firstElementChild;
  if (!node?.matches?.('[data-v2-z-layer]')) return null;
  if (!stack) stage.querySelectorAll('[data-v2-z-layer]').forEach((layer) => layer.remove());
  const depth = stage.querySelectorAll('[data-v2-z-layer]').length + 1;
  node.dataset.v2ZDepth = String(depth);
  node.style.setProperty('--v2-z-layer-shift', `${depth * 12}px`);
  stage.appendChild(node);
  app?.classList.add('has-z-layer');
  const notify = () => window.dispatchEvent(new CustomEvent('book:v2-context-changed'));
  let disposeSwipe = () => {};
  const close = () => {
    disposeSwipe();
    if (node.isConnected) node.remove();
    app?.classList.toggle('has-z-layer', Boolean(stage.querySelector('[data-v2-z-layer]')));
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

function activeV2ModalSurface(root = null) {
  if (root?.matches?.('[data-v2-z-layer], [data-v2-z]')) return root;
  const closest = root?.closest?.('[data-v2-z-layer], [data-v2-z]');
  if (closest) return closest;
  const app = root?.closest?.('[data-v2-app]') || document.querySelector('[data-v2-app]');
  const layers = [...(app?.querySelectorAll?.('[data-v2-z-layer]') || [])];
  return layers.at(-1)
    || app?.querySelector?.('.v2-app__stage > [data-v2-z]')
    || document.querySelector('.app-content')
    || document.querySelector('#app');
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
  node.classList.add(technical ? 'v2-layer-backdrop--technical' : 'v2-layer-backdrop--contained');
  host.appendChild(node);

  let disposeGesture = () => {};
  const stopPointerPropagation = (event) => event.stopPropagation();
  ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'].forEach((type) => {
    node.addEventListener(type, stopPointerPropagation);
  });

  const close = () => {
    disposeGesture();
    if (node.isConnected) node.remove();
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
  return next;
}

export function initV2WorkspaceInteraction(root, {
  activeId = '',
  eActiveId = '',
  deckOpen = false,
  onRootSelect = null,
  onSecondarySelect = null,
  onDeckOpenChange = null,
  bindZ = true,
} = {}) {
  const app = root?.matches?.('[data-v2-app]')
    ? root
    : root?.closest?.('[data-v2-app]') || root?.querySelector?.('[data-v2-app]');
  if (!app) return () => {};

  const deck = app.querySelector('[data-v2-deck]');
  const z = app.querySelector('.v2-app__stage > [data-v2-z]');
  const disposers = [];

  const setOpen = (open, notify = true) => {
    const next = setV2DeckOpen(app, open);
    if (notify) onDeckOpenChange?.(next);
    return next;
  };

  setOpen(deckOpen, false);

  if (deck) {
    disposers.push(initV2DeckSwipe(deck, {
      activeId,
      eActiveId,
      onActiveChange: (id) => {
        setOpen(true);
        onRootSelect?.(id);
      },
      onEActiveChange: (id) => {
        setOpen(true);
        onSecondarySelect?.(id);
      },
    }));

    const onDeckClick = (event) => {
      const rootItem = event.target.closest('[data-v2-deck-item]');
      if (rootItem && deck.contains(rootItem)) {
        const id = String(rootItem.getAttribute('data-v2-deck-item') || '');
        if (id) {
          setOpen(true);
          onRootSelect?.(id);
        }
        return;
      }
      const secondaryItem = event.target.closest('[data-v2-secondary-item], [data-v2-e-item]');
      if (secondaryItem && app.contains(secondaryItem)) {
        const id = String(secondaryItem.getAttribute('data-v2-secondary-item') || secondaryItem.getAttribute('data-v2-e-item') || '');
        if (id) {
          setOpen(true);
          onSecondarySelect?.(id);
        }
      }
    };
    app.querySelector('[data-v2-fe]')?.addEventListener('click', onDeckClick);
    disposers.push(() => app.querySelector('[data-v2-fe]')?.removeEventListener('click', onDeckClick));
  }

  if (z && bindZ) {
    disposers.push(initV2Swipe(z, {
      onRight: () => setOpen(true),
      onLeft: () => setOpen(false),
    }));
  }

  return () => disposers.forEach((dispose) => dispose?.());
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

export function initV2DeckSwipe(root, { activeId = '', onActiveChange = null, eActiveId = '', onEActiveChange = null, threshold = 42, maxDrag = 150 } = {}) {
  const deck = root?.matches?.('[data-v2-deck]') ? root : root?.querySelector?.('[data-v2-deck]');
  if (!deck) return () => {};
  const cards = [...deck.querySelectorAll('.v2-deck__card')];
  const host = deck.closest?.('[data-v2-fe]') || deck;
  let activeIndex = Math.max(0, cards.findIndex((card) => String(card.getAttribute('data-account-deck-item') || card.getAttribute('data-v2-deck-item') || '') === String(activeId || '')));
  let pointerId = null;
  let startX = 0;
  let startY = 0;
  let dx = 0;
  let axis = 'pending';
  let suppressNextClick = false;
  let settling = false;
  let frameId = 0;
  let transitionTarget = null;
  let transitionHandler = null;

  const activeCard = () => cards[activeIndex] || cards[0];

  const clearTransitionListener = () => {
    if (transitionTarget && transitionHandler) transitionTarget.removeEventListener('transitionend', transitionHandler);
    transitionTarget = null;
    transitionHandler = null;
  };

  const clearPointer = () => {
    pointerId = null;
    dx = 0;
    axis = 'pending';
  };

  const returnToRest = () => {
    const card = activeCard();
    host.classList.remove('is-dragging');
    card?.classList.remove('is-dragging');
    host.style.removeProperty('--v2-fe-drag-x');
  };

  const down = (event) => {
    if (settling) return;
    if (!event.target.closest('.v2-deck__card')) return;
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
      if (Math.max(Math.abs(nextX), Math.abs(nextY)) < 6) return;
      axis = Math.abs(nextX) >= Math.abs(nextY) * 1.05 ? 'horizontal' : 'vertical';
      if (axis === 'vertical') {
        pointerId = null;
        return;
      }
      deck.setPointerCapture?.(event.pointerId);
    }
    if (axis !== 'horizontal') return;
    dx = Math.max(-maxDrag, Math.min(maxDrag, nextX));
    const card = activeCard();
    host.classList.add('is-dragging');
    card?.classList.add('is-dragging');
    host.style.setProperty('--v2-fe-drag-x', `${dx}px`);
    if (Math.abs(nextX) > 6) suppressNextClick = true;
    event.preventDefault();
  };

  const commit = (direction) => {
    const outgoing = activeCard();
    const nextIndex = (activeIndex + direction + cards.length) % cards.length;
    const next = cards[nextIndex];
    if (!outgoing || !next) {
      returnToRest();
      return;
    }
    settling = true;
    host.classList.remove('is-dragging');
    host.classList.add('is-settling');
    outgoing.classList.remove('is-dragging');
    outgoing.classList.add('is-committing');
    next.classList.add('is-next-ready');
    outgoing.getBoundingClientRect();

    const distance = Math.max(deck.getBoundingClientRect().width * 1.35, 180);
    const targetX = direction > 0 ? -distance : distance;
    clearTransitionListener();
    transitionTarget = outgoing;
    transitionHandler = (transitionEvent) => {
      if (transitionEvent.target !== outgoing || transitionEvent.propertyName !== 'transform') return;
      clearTransitionListener();
      activeIndex = nextIndex;
      const id = next.getAttribute('data-account-deck-item') || next.getAttribute('data-v2-deck-item') || '';
      if (id && onActiveChange) {
        onActiveChange(id);
        if (!host.isConnected) return;
        return;
      }
      settling = false;
      host.classList.remove('is-settling');
      host.style.removeProperty('--v2-fe-drag-x');
      outgoing.classList.remove('is-committing');
      next.classList.remove('is-next-ready');
    };
    outgoing.addEventListener('transitionend', transitionHandler);
    frameId = requestAnimationFrame(() => {
      frameId = 0;
      host.style.setProperty('--v2-fe-drag-x', `${targetX}px`);
    });
  };

  const up = (event) => {
    if (event.pointerId !== pointerId) return;
    const finalDx = dx;
    const finalAxis = axis;
    deck.releasePointerCapture?.(event.pointerId);
    clearPointer();
    if (finalAxis !== 'horizontal' || Math.abs(finalDx) < threshold) {
      returnToRest();
      return;
    }
    suppressNextClick = true;
    commit(finalDx < 0 ? 1 : -1);
  };

  const cancel = (event) => {
    if (event?.pointerId != null && event.pointerId !== pointerId) return;
    clearPointer();
    returnToRest();
  };

  const click = (event) => {
    if (!suppressNextClick) return;
    suppressNextClick = false;
    event.preventDefault();
    event.stopPropagation();
  };

  if (cards.length > 1) {
    deck.addEventListener('pointerdown', down);
    deck.addEventListener('pointermove', move, { passive: false });
    deck.addEventListener('pointerup', up);
    deck.addEventListener('pointercancel', cancel);
    deck.addEventListener('click', click, true);
  }

  const eDeck = host.querySelector?.('[data-v2-e-list]');
  const eCards = [...(eDeck?.querySelectorAll?.('.v2-e-card') || [])];
  let ePointerId = null;
  let eStartX = 0;
  let eStartY = 0;
  let eDx = 0;
  let eAxis = 'pending';
  let eSuppressNextClick = false;
  let eSettling = false;
  let eFrameId = 0;
  let eTransitionTarget = null;
  let eTransitionHandler = null;
  let eActiveIndex = Math.max(0, eCards.findIndex((card) => String(card.getAttribute('data-v2-secondary-item') || card.getAttribute('data-v2-e-item') || '') === String(eActiveId || '')));

  const eActiveCard = () => eCards[eActiveIndex] || eCards[0];
  const clearETransition = () => {
    if (eTransitionTarget && eTransitionHandler) eTransitionTarget.removeEventListener('transitionend', eTransitionHandler);
    eTransitionTarget = null;
    eTransitionHandler = null;
  };
  const clearEPointer = () => {
    ePointerId = null;
    eDx = 0;
    eAxis = 'pending';
  };
  const returnEToRest = () => {
    eDeck?.classList.remove('is-dragging');
    eActiveCard()?.classList.remove('is-dragging');
    eDeck?.style.removeProperty('--v2-e-drag-x');
  };
  const eDown = (event) => {
    if (eSettling || !event.target.closest('.v2-e-card')) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    ePointerId = event.pointerId;
    eStartX = event.clientX;
    eStartY = event.clientY;
    eDx = 0;
    eAxis = 'pending';
  };
  const eMove = (event) => {
    if (event.pointerId !== ePointerId) return;
    const nextX = event.clientX - eStartX;
    const nextY = event.clientY - eStartY;
    if (eAxis === 'pending') {
      if (Math.max(Math.abs(nextX), Math.abs(nextY)) < 6) return;
      eAxis = Math.abs(nextX) >= Math.abs(nextY) * 1.05 ? 'horizontal' : 'vertical';
      if (eAxis === 'vertical') {
        ePointerId = null;
        return;
      }
      eDeck?.setPointerCapture?.(event.pointerId);
    }
    if (eAxis !== 'horizontal') return;
    eDx = Math.max(-maxDrag, Math.min(maxDrag, nextX));
    eDeck?.classList.add('is-dragging');
    eActiveCard()?.classList.add('is-dragging');
    eDeck?.style.setProperty('--v2-e-drag-x', `${eDx}px`);
    if (Math.abs(nextX) > 6) eSuppressNextClick = true;
    event.preventDefault();
  };
  const commitE = (direction) => {
    const outgoing = eActiveCard();
    const nextIndex = (eActiveIndex + direction + eCards.length) % eCards.length;
    const next = eCards[nextIndex];
    if (!outgoing || !next) {
      returnEToRest();
      return;
    }
    eSettling = true;
    eDeck.classList.remove('is-dragging');
    eDeck.classList.add('is-settling');
    outgoing.classList.remove('is-dragging');
    outgoing.classList.add('is-committing');
    next.classList.add('is-next-ready');
    outgoing.getBoundingClientRect();
    const distance = Math.max(eDeck.getBoundingClientRect().width * 1.2, 150);
    const targetX = direction > 0 ? -distance : distance;
    clearETransition();
    eTransitionTarget = outgoing;
    eTransitionHandler = (transitionEvent) => {
      if (transitionEvent.target !== outgoing || transitionEvent.propertyName !== 'transform') return;
      clearETransition();
      eActiveIndex = nextIndex;
      const id = next.getAttribute('data-v2-secondary-item') || next.getAttribute('data-v2-e-item') || '';
      if (id && onEActiveChange) {
        onEActiveChange(id);
        if (!host.isConnected) return;
        return;
      }
      eSettling = false;
      eDeck.classList.remove('is-settling');
      eDeck.style.removeProperty('--v2-e-drag-x');
      outgoing.classList.remove('is-committing');
      next.classList.remove('is-next-ready');
    };
    outgoing.addEventListener('transitionend', eTransitionHandler);
    eFrameId = requestAnimationFrame(() => {
      eFrameId = 0;
      eDeck.style.setProperty('--v2-e-drag-x', `${targetX}px`);
    });
  };
  const eUp = (event) => {
    if (event.pointerId !== ePointerId) return;
    const finalDx = eDx;
    const finalAxis = eAxis;
    eDeck?.releasePointerCapture?.(event.pointerId);
    clearEPointer();
    if (finalAxis !== 'horizontal' || Math.abs(finalDx) < threshold) {
      returnEToRest();
      return;
    }
    eSuppressNextClick = true;
    commitE(finalDx < 0 ? 1 : -1);
  };
  const eCancel = (event) => {
    if (event?.pointerId != null && event.pointerId !== ePointerId) return;
    clearEPointer();
    returnEToRest();
  };
  const eClick = (event) => {
    if (!eSuppressNextClick) return;
    eSuppressNextClick = false;
    event.preventDefault();
    event.stopPropagation();
  };

  if (eDeck && eCards.length > 1) {
    eDeck.addEventListener('pointerdown', eDown);
    eDeck.addEventListener('pointermove', eMove, { passive: false });
    eDeck.addEventListener('pointerup', eUp);
    eDeck.addEventListener('pointercancel', eCancel);
    eDeck.addEventListener('click', eClick, true);
  }

  return () => {
    if (frameId) cancelAnimationFrame(frameId);
    if (eFrameId) cancelAnimationFrame(eFrameId);
    clearTransitionListener();
    clearETransition();
    deck.removeEventListener('pointerdown', down);
    deck.removeEventListener('pointermove', move);
    deck.removeEventListener('pointerup', up);
    deck.removeEventListener('pointercancel', cancel);
    deck.removeEventListener('click', click, true);
    eDeck?.removeEventListener('pointerdown', eDown);
    eDeck?.removeEventListener('pointermove', eMove);
    eDeck?.removeEventListener('pointerup', eUp);
    eDeck?.removeEventListener('pointercancel', eCancel);
    eDeck?.removeEventListener('click', eClick, true);
  };
}
