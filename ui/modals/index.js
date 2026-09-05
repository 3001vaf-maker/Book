import { escapeHtml } from '../utils/escape-html.js';

let modalLevel = 0;

const MODAL_VARIANTS = new Set(['list', 'large', 'medium', 'compact', 'bottom']);

export function modal(content, { title = '', className = '', variant = '' } = {}) {
  const normalizedVariant = MODAL_VARIANTS.has(String(variant).toLowerCase())
    ? String(variant).toLowerCase()
    : '';
  const classes = ['modal-sheet', normalizedVariant ? `modal-sheet--${normalizedVariant}` : '', className].filter(Boolean).join(' ');
  const closeButton = normalizedVariant === 'bottom'
    ? ''
    : '<button type="button" class="modal-close" data-modal-close aria-label="Закрыть">×</button>';
  return `<div class="modal-backdrop" data-modal><div class="${classes}" role="dialog" aria-modal="true" ${title ? `aria-label="${escapeHtml(title)}"` : ''}>${closeButton}${content}</div></div>`;
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

  requestAnimationFrame(() => m.querySelector('input,select,textarea,button:not([data-modal-close])')?.focus());
  return m;
}
