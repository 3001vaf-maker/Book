import { escapeHtml } from '../utils/escape-html.js';
import { button } from '../buttons/index.js';
import { mountV2Layer, v2Layer } from '../v2/index.js';

let modalLevel = 0;

const MODAL_VARIANTS = new Set(['list', 'large', 'medium', 'compact', 'bottom']);
const MODAL_SURFACES = new Set(['app']);

function v2Kind(variant = '') {
  if (variant === 'bottom') return 'quick';
  if (variant === 'compact') return 'system';
  return 'standard';
}

export function modal(content, { title = '', className = '', variant = '', surface = '' } = {}) {
  const resolvedVariant = MODAL_VARIANTS.has(variant) ? variant : '';
  const variantClass = resolvedVariant ? `modal--${resolvedVariant}` : '';
  const surfaceClass = MODAL_SURFACES.has(surface) ? `modal--surface-${surface}` : '';
  const classes = ['modal-sheet', className, variantClass, surfaceClass].filter(Boolean).join(' ');
  let html = v2Layer(content, {
    kind: v2Kind(resolvedVariant),
    title,
    className: classes,
  });
  html = html
    .replace('class="v2-layer-backdrop"', 'class="v2-layer-backdrop modal-backdrop" data-modal')
    .replace('class="v2-layer__close"', 'class="v2-layer__close modal-close" data-modal-close');
  if (resolvedVariant === 'bottom') {
    html = html.replace(/<button type="button" class="v2-layer__close modal-close"[^>]*>×<\/button>/, '');
  }
  return html;
}

export function mountModal(root, html) {
  const m = mountV2Layer(html);
  if (!m) return null;
  modalLevel += 1;
  m.dataset.modalLevel = String(modalLevel);
  m.style.zIndex = String(1200 + modalLevel);

  const close = m.v2Close || (() => m.remove());
  const originalClose = close;
  m.v2Close = () => {
    if (!m.isConnected) return;
    originalClose();
    if (!document.querySelector('[data-modal]')) modalLevel = 0;
  };

  m.addEventListener('click', (event) => {
    if (event.target.closest?.('[data-modal-close]')) m.v2Close?.();
  });

  requestAnimationFrame(() => {
    const explicit = m.querySelector('[data-modal-autofocus]');
    const target = explicit || m.querySelector('.modal-sheet');
    target?.focus?.({ preventScroll: true });
  });
  return m;
}

export function openNotice({ title = 'Внимание', message = '', action = 'ОК', variant = 'compact', surface = 'app' } = {}) {
  const content = `<div class="modal-title"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(message)}</p></div><div class="modal-actions">${button(escapeHtml(action), { data: 'data-notice-close' })}</div>`;
  const m = mountModal(document.body, modal(content, { variant, surface, title }));
  if (!m) return null;
  m.querySelector('[data-notice-close]')?.addEventListener('click', () => m.v2Close?.());
  return m;
}
