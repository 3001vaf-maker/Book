import { text } from './html.js';
import { v2ModalPortalGeometry } from './modal-geometry.js';

export function v2Layer(content = '', { kind = 'standard', title = '', className = '' } = {}) {
  const allowed = new Set(['top', 'standard', 'bottom', 'technical']);
  const resolved = allowed.has(kind) ? kind : 'standard';
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
const v2StageInteractionLocks = new WeakMap();

function lockV2StageInteraction(app) {
  const stage = app?.querySelector?.('.v2-app__stage');
  if (!app || !stage) return null;
  const next = (v2StageInteractionLocks.get(stage) || 0) + 1;
  v2StageInteractionLocks.set(stage, next);
  stage.inert = true;
  app.classList.add('has-v2-modal');
  return stage;
}

function unlockV2StageInteraction(app, stage) {
  if (!app || !stage) return;
  const next = Math.max(0, (v2StageInteractionLocks.get(stage) || 1) - 1);
  if (next) {
    v2StageInteractionLocks.set(stage, next);
    return;
  }
  v2StageInteractionLocks.delete(stage);
  stage.inert = false;
  app.classList.remove('has-v2-modal');
}

function activeV2ModalSurface(root = null) {
  const explicit = root?.matches?.('[data-v2-z-layer], [data-v2-z]')
    ? root
    : root?.closest?.('[data-v2-z-layer], [data-v2-z]');
  const app = explicit?.closest?.('[data-v2-app]')
    || root?.closest?.('[data-v2-app]')
    || document.querySelector('[data-v2-app]');
  const layers = [...(app?.querySelectorAll?.('[data-v2-z-layer]') || [])];
  const topLayer = layers.at(-1);
  if (topLayer) return topLayer;
  if (explicit) return explicit;
  return app?.querySelector?.('[data-v2-front] > [data-v2-z]')
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
  const qLayer = node.dataset.v2Q === 'true';
  const host = technical ? document.body : activeV2ModalSurface(root);
  if (!host) return null;
  const app = technical ? null : host.closest?.('[data-v2-app]');
  const locksHeader = Boolean(app && kind === 'standard' && !qLayer);
  const header = locksHeader ? app.querySelector?.('[data-v2-header]') : null;
  const lockedStage = technical ? null : lockV2StageInteraction(app);
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
  if (qLayer) window.dispatchEvent(new CustomEvent('book:v2-context-changed'));

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
    if (!technical) unlockV2StageInteraction(app, lockedStage);
    if (qLayer) window.dispatchEvent(new CustomEvent('book:v2-context-changed'));
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
