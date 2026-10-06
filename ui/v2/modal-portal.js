import { text } from './html.js';
import { v2ModalPortalGeometry, currentVisualViewport } from './geometry.js';
import {
  activeV2ModalSurface,
  lockV2ModalSurface,
  unlockV2ModalSurface,
  lockV2StageInteraction,
  unlockV2StageInteraction,
} from './lifecycle.js';
import { initV2LayerDismissGesture } from './swipe.js';

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

function lockModalHeader(app, { allowC = false } = {}) {
  const header = app?.querySelector?.('[data-v2-header]');
  if (!header) return () => {};

  const targets = allowC
    ? [
        header.querySelector('.v2-header__slot--a'),
        header.querySelector('.v2-header__title'),
        header.querySelector('.v2-header__slot--d'),
      ].filter(Boolean)
    : [header];

  // Header remains pointer-addressable on purpose: outside input must reach the
  // Shared modal owner so the veil can dismiss the active modal. The capture
  // handler below consumes that input before any underlying Header action runs.
  // Using inert here would make A/B/D dead zones instead of veil-dismiss zones.
  targets.forEach((target) => target.classList.add('is-modal-locked'));

  return () => {
    targets.forEach((target) => target.classList.remove('is-modal-locked'));
  };
}

function closeExistingApplicationModal() {
  const layers = [...document.querySelectorAll('[data-v2-layer]:not([data-v2-layer-kind="technical"])')];
  const current = layers.at(-1);
  if (!current) return;
  if (typeof current.v2Close === 'function') current.v2Close();
  else current.remove();
}

export function mountV2Layer(html, { root = null } = {}) {
  const template = document.createElement('template');
  template.innerHTML = String(html || '').trim();
  const node = template.content.firstElementChild;
  if (!node?.matches('[data-v2-layer]')) return null;
  const kind = node.dataset.v2LayerKind || 'standard';
  const technical = kind === 'technical';
  const qLayer = node.dataset.v2Q === 'true';

  if (!technical) closeExistingApplicationModal();

  const host = technical ? document.body : activeV2ModalSurface(root);
  if (!host) return null;
  const app = technical ? null : host.closest?.('[data-v2-app]');
  const locksHeader = Boolean(app && kind === 'standard' && !qLayer);
  const header = locksHeader ? app.querySelector?.('[data-v2-header]') : null;
  const lockedStage = technical ? null : lockV2StageInteraction(app);
  const releaseHeaderLock = technical
    ? () => {}
    : (qLayer
        ? lockModalHeader(app, { allowC: true })
        : (locksHeader
            ? () => {
                if (!header) return;
                header.inert = false;
                header.classList.remove('is-modal-locked');
              }
            : lockModalHeader(app)));
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
  if (qLayer) {
    app?.classList.add('has-v2-q-modal');
    window.dispatchEvent(new CustomEvent('book:v2-context-changed'));
  }

  let disposeGesture = () => {};
  let consumeClickTimer = 0;
  let consumedPointerTarget = null;
  const stopPointerPropagation = (event) => event.stopPropagation();
  ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'].forEach((type) => {
    node.addEventListener(type, stopPointerPropagation);
  });

  const nativeRemove = node.remove.bind(node);
  let closed = false;

  const eventIsOwnedByModal = (event) => {
    const sheet = node.querySelector(':scope > .v2-layer');
    if (sheet?.contains(event.target)) return true;
    if (!qLayer) return false;
    const qAction = event.target.closest?.('[data-v2-header] .v2-header__slot--c .v2-header__control');
    return Boolean(qAction && app?.contains?.(qAction));
  };

  const consumeFollowUpClick = (event) => {
    if (!consumedPointerTarget) return;
    const sameTarget = event.target === consumedPointerTarget
      || consumedPointerTarget.contains?.(event.target);
    if (!sameTarget) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    consumedPointerTarget = null;
    if (consumeClickTimer) window.clearTimeout(consumeClickTimer);
    consumeClickTimer = 0;
    document.removeEventListener('click', consumeFollowUpClick, true);
  };

  const armFollowUpClickGuard = (target) => {
    consumedPointerTarget = target;
    document.addEventListener('click', consumeFollowUpClick, true);
    if (consumeClickTimer) window.clearTimeout(consumeClickTimer);
    consumeClickTimer = window.setTimeout(() => {
      consumedPointerTarget = null;
      consumeClickTimer = 0;
      document.removeEventListener('click', consumeFollowUpClick, true);
    }, 700);
  };

  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener('pointerdown', handleOutsidePointerDown, true);
    document.removeEventListener('click', handleOutsideClick, true);
    disposeGesture();
    if (node.isConnected) nativeRemove();
    portalOwner?.dispose();
    if (!technical && host.matches?.('[data-v2-z], [data-v2-z-layer]')) unlockV2ModalSurface(host);
    if (!technical) unlockV2StageInteraction(app, lockedStage);
    releaseHeaderLock();
    if (qLayer) {
      app?.classList.remove('has-v2-q-modal');
      window.dispatchEvent(new CustomEvent('book:v2-context-changed'));
    }
  };

  const handleOutsidePointerDown = (event) => {
    if (closed || technical || eventIsOwnedByModal(event)) return;
    // Do not prevent the browser's pointer/touch sequence here. WebKit may
    // otherwise suppress the next trusted tap after the veil dismissal. We
    // stop propagation now and consume the resulting click for the same target.
    event.stopImmediatePropagation();
    armFollowUpClickGuard(event.target);
    close();
  };

  const handleOutsideClick = (event) => {
    if (closed || technical || eventIsOwnedByModal(event)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    close();
  };

  node.v2Close = close;
  node.remove = close;
  document.addEventListener('pointerdown', handleOutsidePointerDown, true);
  document.addEventListener('click', handleOutsideClick, true);
  disposeGesture = initV2LayerDismissGesture(node, {
    kind,
    onDismiss: () => node.v2Close?.(),
  });
  node.addEventListener('click', (event) => {
    if (event.target.closest('[data-v2-layer-close]')) node.v2Close?.();
  });
  return node;
}
