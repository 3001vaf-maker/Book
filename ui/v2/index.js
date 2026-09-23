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
  let body = label;
  if (kind === 'avatar') {
    body = image
      ? `<span class="v2-header__avatar" style="--v2-avatar:url('${text(image)}')" aria-hidden="true"></span>`
      : `<span class="v2-header__avatar v2-header__avatar--initials" aria-hidden="true">${initials}</span>`;
  } else if (kind === 'chat') {
    body = '<span class="v2-header__icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 5.5h16v11H9l-5 3v-14Z"></path></svg></span>';
  } else if (kind === 'contacts') {
    body = '<span class="v2-header__icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="7" cy="8" r="2.2"></circle><path d="M3.8 14.5c.7-2.1 1.8-3.1 3.2-3.1s2.5 1 3.2 3.1M13 7h7M13 12h7M13 17h7"></path></svg></span>';
  } else if (kind === 'attachment') {
    body = '<span class="v2-header__icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m8.5 12.5 6.2-6.2a3.2 3.2 0 0 1 4.5 4.5l-8.3 8.3a5 5 0 0 1-7.1-7.1l8.1-8.1"></path></svg></span>';
  } else if (kind === 'settings') {
    body = '<span class="v2-header__icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"></circle><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"></path></svg></span>';
  }
  return `<div class="v2-header__slot v2-header__slot--${role}"><button type="button" class="v2-header__control v2-header__control--${kind}"${dataAttributes(slot.data)} aria-label="${aria}"${slot.disabled ? ' disabled' : ''}>${body}${badge}</button></div>`;
}

export function v2Header({ a = null, b = '', c = null, d = null } = {}) {
  const title = b && typeof b === 'object'
    ? `<button type="button" class="v2-header__title v2-header__title-control"${dataAttributes(b.data)} aria-label="${text(b.aria || b.label || '')}">${text(b.label || '')}</button>`
    : `<h1 class="v2-header__title">${text(b)}</h1>`;
  return `<header class="v2-header" data-v2-header>
    ${headerControl(a, 'a')}
    ${title}
    ${headerControl(c, 'c')}
    ${headerControl(d, 'd')}
  </header>`;
}

export function v2EList(items = [], { data = 'data-v2-e-item' } = {}) {
  const values = (Array.isArray(items) ? items : []).filter(Boolean);
  if (!values.length) return '';
  return `<nav class="v2-e-list" data-v2-e-list>${values.map((item, index) => {
    const id = String(item.id || index);
    return `<button type="button" class="v2-e-list__item" ${data}="${text(id)}" aria-label="${text(item.aria || item.label || '')}"><strong>${text(item.label || '')}</strong></button>`;
  }).join('')}</nav>`;
}

export function v2FDeck(items = [], { active = '', data = 'data-v2-deck-item' } = {}) {
  const values = (Array.isArray(items) ? items : []).filter(Boolean);
  if (!values.length) return '';
  return `<div class="v2-deck" data-v2-deck>${values.map((item, index) => {
    const id = String(item.id || index);
    const isActive = id === String(active || values[0]?.id || '0');
    const depth = Math.min(index, 4);
    return `<button type="button" class="v2-deck__card${isActive ? ' is-active' : ''}" style="--v2-depth:${depth}" ${data}="${text(id)}" data-v2-deck-index="${index}" aria-label="${text(item.aria || item.label || '')}"><strong>${text(item.label || '')}</strong></button>`;
  }).join('')}</div>`;
}

export function v2Shell({
  header = '',
  body = '',
  deck = '',
  className = '',
  deckOpen = false,
  zData = 'data-v2-z',
} = {}) {
  const classes = ['v2-app', deck ? 'v2-app--with-deck' : '', deckOpen ? 'is-deck-open' : '', className].filter(Boolean).join(' ');
  return `<section class="${classes}" data-v2-app>
    ${header}
    <div class="v2-app__stage">
      ${deck}
      <main class="v2-z" ${zData}>\n${body}\n</main>
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
      <span>${text(item.required ? 'обязательное' : 'необязательное')}</span>
    </button>
    <button type="button" class="v2-legal-card__toggle${item.checked ? ' is-on' : ''}"${dataAttributes(item.toggleData)} aria-pressed="${item.checked ? 'true' : 'false'}" aria-label="${text(item.toggleAria || item.title || 'Согласие')}"><span></span></button>
  </article>`).join('')}</div>`;
}

export function v2Layer(content = '', { kind = 'standard', title = '', className = '' } = {}) {
  const allowed = new Set(['quick', 'standard', 'system']);
  const resolved = allowed.has(kind) ? kind : 'standard';
  return `<div class="v2-layer-backdrop" data-v2-layer><section class="v2-layer v2-layer--${resolved} ${text(className)}" role="dialog" aria-modal="true" aria-label="${text(title)}"><button type="button" class="v2-layer__close" data-v2-layer-close aria-label="Закрыть">×</button>${title ? `<header class="v2-layer__header"><h2>${text(title)}</h2></header>` : ''}${content}</section></div>`;
}

export function mountV2Layer(html) {
  const template = document.createElement('template');
  template.innerHTML = String(html || '').trim();
  const node = template.content.firstElementChild;
  if (!node?.matches('[data-v2-layer]')) return null;
  document.body.appendChild(node);
  const close = () => node.remove();
  node.addEventListener('click', (event) => {
    if (event.target === node || event.target.closest('[data-v2-layer-close]')) close();
  });
  return node;
}

export function initV2Swipe(root, { onRight = null, onLeft = null, threshold = 72, maxDrag = 180 } = {}) {
  const surface = root?.matches?.('[data-v2-z]') ? root : root?.querySelector?.('[data-v2-z]');
  if (!surface) return () => {};
  let pointerId = null;
  let startX = 0;
  let startY = 0;
  let dx = 0;
  let axis = 'pending';

  const reset = () => {
    surface.style.removeProperty('--v2-drag-x');
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
      surface.style.setProperty('--v2-drag-x', `${dx}px`);
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

export function initV2DeckSwipe(root, { activeId = '', onActiveChange = null, threshold = 58 } = {}) {
  const deck = root?.matches?.('[data-v2-deck]') ? root : root?.querySelector?.('[data-v2-deck]');
  if (!deck) return () => {};
  const cards = [...deck.querySelectorAll('.v2-deck__card')];
  if (cards.length < 2) return () => {};
  let activeIndex = Math.max(0, cards.findIndex((card) => String(card.getAttribute('data-account-deck-item') || card.getAttribute('data-v2-deck-item') || '') === String(activeId || '')));
  let pointerId = null;
  let startX = 0;
  let startY = 0;
  let dx = 0;
  let horizontal = false;

  const activeCard = () => cards[activeIndex] || cards[0];
  const reset = () => {
    const card = activeCard();
    card?.style.removeProperty('--v2-deck-drag-x');
    card?.classList.remove('is-dragging');
    pointerId = null;
    dx = 0;
    horizontal = false;
  };
  const down = (event) => {
    const card = activeCard();
    if (!card || !event.target.closest('.v2-deck__card.is-active')) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    card.setPointerCapture?.(pointerId);
  };
  const move = (event) => {
    if (event.pointerId !== pointerId) return;
    const nextX = event.clientX - startX;
    const nextY = event.clientY - startY;
    if (!horizontal && Math.abs(nextX) > 10) horizontal = Math.abs(nextX) > Math.abs(nextY) * 1.15;
    if (!horizontal) return;
    dx = Math.max(-190, Math.min(190, nextX));
    const card = activeCard();
    card?.classList.add('is-dragging');
    card?.style.setProperty('--v2-deck-drag-x', `${dx}px`);
    event.preventDefault();
  };
  const up = (event) => {
    if (event.pointerId !== pointerId) return;
    const finalDx = dx;
    reset();
    if (Math.abs(finalDx) < threshold) return;
    const direction = finalDx < 0 ? 1 : -1;
    const nextIndex = (activeIndex + direction + cards.length) % cards.length;
    const next = cards[nextIndex];
    const id = next?.getAttribute('data-account-deck-item') || next?.getAttribute('data-v2-deck-item') || '';
    if (id) onActiveChange?.(id);
  };

  deck.addEventListener('pointerdown', down);
  deck.addEventListener('pointermove', move, { passive: false });
  deck.addEventListener('pointerup', up);
  deck.addEventListener('pointercancel', reset);
  return () => {
    deck.removeEventListener('pointerdown', down);
    deck.removeEventListener('pointermove', move);
    deck.removeEventListener('pointerup', up);
    deck.removeEventListener('pointercancel', reset);
  };
}
