import { escapeHtml } from '../utils/escape-html.js';
import { mountV2Layer, v2Layer } from '../v2/index.js';
import { v2QFrame } from '../v2/z-layout.js';

let modalLevel = 0;

const MODAL_VARIANTS = new Set(['q', 'x', 's', 'technical']);
const MODAL_SURFACES = new Set(['app']);
const X_ROLES = new Set(['action', 'editor', 'picker']);
const S_INTERACTIVE_CONTENT = /<(?:button|form|input|select|textarea)\b/i;

function v2Kind(variant = '') {
  if (variant === 'x') return 'bottom';
  if (variant === 's') return 'top';
  if (variant === 'technical') return 'technical';
  return 'standard';
}

function assertInformationalS(content = '') {
  if (!S_INTERACTIVE_CONTENT.test(String(content || ''))) return;
  throw new Error('S modal is informational only; use X for actions, editors and pickers.');
}

function qContextActionLabel(source, role) {
  if (!source) return '';
  if (role === 'c') return String(source.dataset.v2PrimaryLabel || source.getAttribute('aria-label') || source.textContent || '').trim();
  if (role === 'd') return source.dataset.workspaceDKind === 'chat' ? 'Чат' : String(source.getAttribute('aria-label') || 'Действие').trim();
  const kind = String(source.dataset.workspaceAKind || '');
  if (!kind || kind === 'settings' || source.dataset.workspaceASettingsTag === 'true') return 'Настройки';
  return String(source.dataset.workspaceALabel || source.getAttribute('aria-label') || 'Действие').trim();
}

function bindQWorkspaceContext(layer) {
  if (layer?.dataset?.v2Q !== 'true') return () => {};
  const body = layer.querySelector('[data-v2-q-body]');
  const header = layer.querySelector('[data-v2-q-header-content]');
  if (!body || !header) return () => {};

  const render = () => {
    const context = body.querySelector('[data-workspace-header-context]');
    if (!context) {
      header.replaceChildren();
      return;
    }
    const sources = {
      a: context.querySelector('[data-workspace-context-action]'),
      c: context.querySelector('[data-v2-primary-action]'),
      d: context.querySelector('[data-workspace-d-action]'),
    };
    const title = String(context.dataset.workspaceTitle || '').trim();
    const actions = Object.entries(sources).filter(([role, source]) => {
      if (!source || source.disabled) return false;
      if (role === 'c' && source.dataset.v2PrimaryVisible === 'false') return false;
      return Boolean(qContextActionLabel(source, role));
    });
    if (!title && !actions.length) {
      header.replaceChildren();
      return;
    }
    const actionMarkup = actions.map(([role, source]) => {
      const label = qContextActionLabel(source, role);
      const dangerous = role === 'c' && (source.dataset.v2PrimaryVariant === 'danger' || source.classList.contains('ui-button--danger'));
      return `<button type="button" class="modal-q-context__action${dangerous ? ' modal-q-context__action--danger' : ''}" data-modal-q-context-action="${role}" aria-label="${escapeHtml(source.getAttribute('aria-label') || label)}">${escapeHtml(label)}</button>`;
    }).join('');
    header.innerHTML = `<div class="modal-q-context" data-modal-q-context>
      ${title ? `<h2 class="modal-q-context__title">${escapeHtml(title)}</h2>` : '<span></span>'}
      ${actionMarkup ? `<div class="modal-q-context__actions">${actionMarkup}</div>` : ''}
    </div>`;
    header.querySelectorAll('[data-modal-q-context-action]').forEach((button) => {
      button.addEventListener('click', () => sources[button.dataset.modalQContextAction]?.click());
    });
  };

  render();
  const observer = new MutationObserver(render);
  observer.observe(body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['disabled', 'aria-label', 'data-v2-primary-visible', 'data-v2-primary-label', 'data-v2-primary-variant', 'data-workspace-title'],
  });
  return () => observer.disconnect();
}

export function modal(content, { title = '', className = '', variant = 'q', surface = '', xRole = '' } = {}) {
  const resolvedVariant = MODAL_VARIANTS.has(variant) ? variant : 'q';
  if (resolvedVariant === 's') assertInformationalS(content);
  const kind = v2Kind(resolvedVariant);
  const variantClass = `modal--${kind}`;
  const surfaceClass = MODAL_SURFACES.has(surface) ? `modal--surface-${surface}` : '';
  const classes = ['modal-sheet', className, variantClass, surfaceClass].filter(Boolean).join(' ');
  if (resolvedVariant === 'q') content = v2QFrame(content);
  let html = v2Layer(content, {
    kind,
    title: '',
    className: classes,
  });
  if (resolvedVariant === 'q') html = html.replace('data-v2-layer ', 'data-v2-layer data-v2-q="true" ');
  if (resolvedVariant === 'x') {
    const resolvedRole = X_ROLES.has(xRole) ? xRole : 'editor';
    html = html.replace('data-v2-layer ', `data-v2-layer data-v2-x-role="${resolvedRole}" `);
  }
  if (title) html = html.replace('aria-label=""', `aria-label="${escapeHtml(title)}"`);
  html = html
    .replace('class="v2-layer-backdrop"', 'class="v2-layer-backdrop modal-backdrop" data-modal')
    .replace('class="v2-layer__close"', 'class="v2-layer__close modal-close" data-modal-close');
  if (resolvedVariant === 'x' || resolvedVariant === 's') {
    html = html.replace(/<button type="button" class="v2-layer__close modal-close"[^>]*>×<\/button>/, '');
  }
  return html;
}

export function mountModal(root, html) {
  const m = mountV2Layer(html, { root });
  if (!m) return null;
  modalLevel += 1;
  m.dataset.modalLevel = String(modalLevel);
  const layerZ = String(1200 + modalLevel);
  const portal = m.parentElement?.matches?.('[data-v2-layer-portal]') ? m.parentElement : null;
  if (portal) portal.style.zIndex = layerZ;
  else m.style.zIndex = layerZ;

  const disposeQContext = bindQWorkspaceContext(m);
  const close = m.v2Close || (() => m.remove());
  const originalClose = close;
  m.v2Close = () => {
    if (!m.isConnected) return;
    disposeQContext();
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

export function openNotice({ title = 'Внимание', message = '', surface = 'app' } = {}) {
  const content = `<div class="modal-title"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(message)}</p></div>`;
  return mountModal(document.body, modal(content, { variant: 's', surface, title }));
}
