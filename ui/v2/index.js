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
    body = '<span class="v2-header__icon" aria-hidden="true">◌</span>';
  } else if (kind === 'contacts') {
    body = '<span class="v2-header__icon" aria-hidden="true">☷</span>';
  } else if (kind === 'attachment') {
    body = '<span class="v2-header__icon" aria-hidden="true">⌕</span>';
  } else if (kind === 'settings') {
    body = '<span class="v2-header__icon" aria-hidden="true">⚙</span>';
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

export function v2FDeck(items = [], { active = '', data = 'data-v2-deck-item' } = {}) {
  const values = (Array.isArray(items) ? items : []).filter(Boolean);
  if (!values.length) return '';
  return `<div class="v2-deck" data-v2-deck>${values.map((item, index) => {
    const id = String(item.id || index);
    const isActive = id === String(active || values[0]?.id || '0');
    const depth = Math.min(index, 4);
    return `<button type="button" class="v2-deck__card${isActive ? ' is-active' : ''}" style="--v2-depth:${depth}" ${data}="${text(id)}" aria-label="${text(item.aria || item.label || '')}"><strong>${text(item.label || '')}</strong></button>`;
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
  return `<div class="v2-layer-backdrop" data-v2-layer><section class="v2-layer v2-layer--${resolved} ${text(className)}" role="dialog" aria-modal="true" aria-label="${text(title)}"><button type="button" class="v2-layer__close" data-v2-layer-close aria-label="Закрыть">×</button>${content}</section></div>`;
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
  let horizontal = false;

  const reset = () => {
    surface.style.removeProperty('--v2-drag-x');
    surface.classList.remove('is-dragging');
    pointerId = null;
    dx = 0;
    horizontal = false;
  };

  const down = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    dx = 0;
    horizontal = false;
    surface.setPointerCapture?.(pointerId);
  };
  const move = (event) => {
    if (event.pointerId !== pointerId) return;
    const nextX = event.clientX - startX;
    const nextY = event.clientY - startY;
    if (!horizontal && Math.abs(nextX) > 10) horizontal = Math.abs(nextX) > Math.abs(nextY) * 1.15;
    if (!horizontal) return;
    dx = Math.max(-maxDrag, Math.min(maxDrag, nextX));
    surface.classList.add('is-dragging');
    surface.style.setProperty('--v2-drag-x', `${dx}px`);
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
