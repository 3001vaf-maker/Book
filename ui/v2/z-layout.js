import { v2ZDismissAffordance } from './z-affordance.js';

const Z_HEADER_STYLE = [
  'position:sticky',
  'top:0',
  'z-index:20',
  'box-sizing:border-box',
  'min-height:40px',
  'margin:0 -18px',
  'padding:0 18px 20px 0',
  'display:flex',
  'flex-direction:column',
  'background:var(--v2-white,#fff)',
].join(';');

const Z_HEADER_CONTENT_STYLE = [
  'box-sizing:border-box',
  'min-width:0',
  'padding-left:18px',
  'display:flex',
  'flex-direction:column',
  'gap:8px',
].join(';');

const Z_BODY_STYLE = [
  'min-width:0',
  'box-sizing:border-box',
].join(';');

export function v2ZHeader(content = '') {
  return `<div data-v2-z-header style="${Z_HEADER_STYLE}">${v2ZDismissAffordance()}<div data-v2-z-header-content style="${Z_HEADER_CONTENT_STYLE}">${content}</div></div>`;
}

export function v2ZBody(content = '') {
  return `<div data-v2-z-body style="${Z_BODY_STYLE}">${content}</div>`;
}

export function v2ZFrame(content = '', { header = '' } = {}) {
  return `${v2ZHeader(header)}${v2ZBody(content)}`;
}

function resolveZSurface(root) {
  if (!root) return null;
  if (root.matches?.('[data-v2-z],[data-v2-z-layer]')) return root;
  return root.closest?.('[data-v2-z],[data-v2-z-layer]') || null;
}

export function setV2ZHeaderRows(root, rows = []) {
  const surface = resolveZSurface(root);
  const host = surface?.querySelector?.(':scope > [data-v2-z-header] > [data-v2-z-header-content]');
  if (!host) return [];
  const values = (Array.isArray(rows) ? rows : [rows]).filter((row) => String(row || '').trim());
  host.innerHTML = values.map((row, index) => `<div data-v2-z-header-row="${index}" style="min-width:0">${row}</div>`).join('');
  host.querySelectorAll(':scope > [data-v2-z-header-row] > *').forEach((node) => {
    node.style.margin = '0';
  });
  return [...host.querySelectorAll(':scope > [data-v2-z-header-row]')];
}

export function clearV2ZHeaderRows(root) {
  const surface = resolveZSurface(root);
  const host = surface?.querySelector?.(':scope > [data-v2-z-header] > [data-v2-z-header-content]');
  if (host) host.replaceChildren();
}
