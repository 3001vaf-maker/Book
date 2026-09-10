import { escapeHtml } from '../utils/escape-html.js';
import { button } from '../buttons/index.js';

let modalLevel = 0;

const MODAL_VARIANTS = new Set(['list', 'large', 'medium', 'compact', 'bottom']);
const MODAL_SURFACES = new Set(['app']);

export function modal(content, { title = '', className = '', variant = '', surface = '' } = {}) {
  const variantClass = MODAL_VARIANTS.has(variant) ? ` modal--${variant}` : '';
  const surfaceClass = MODAL_SURFACES.has(surface) ? ` modal--surface-${surface}` : '';
  const classes = ['modal-sheet', className].filter(Boolean).join(' ') + variantClass + surfaceClass;
  const closeButton = variant === 'bottom'
    ? ''
    : '<button type="button" class="modal-close" data-modal-close aria-label="Закрыть">×</button>';
  return `<div class="modal-backdrop" data-modal><div class="${classes}" role="dialog" aria-modal="true" tabindex="-1" ${title ? `aria-label="${escapeHtml(title)}"` : ''}>${closeButton}${content}</div></div>`;
}

export function mountModal(root, html) {
  const template = document.createElement('template');
  template.innerHTML = String(html || '').trim();
  const m = template.content.firstElementChild;
  if (!m?.matches('[data-modal]')) return null;

  document.body.appendChild(m);
  modalLevel += 1;
  m.dataset.modalLevel = String(modalLevel);
  m.style.zIndex = String(1000 + modalLevel);

  const close = () => {
    if (!m.isConnected) return;
    m.remove();
    if (!document.querySelector('[data-modal]')) modalLevel = 0;
  };

  m.addEventListener('click', (e) => {
    if (e.target === m || e.target.closest('[data-modal-close]')) close();
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
  m.querySelector('[data-notice-close]')?.addEventListener('click', () => m.remove());
  return m;
}
