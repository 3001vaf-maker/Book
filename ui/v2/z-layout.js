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

const Z_BODY_STYLE = [
  'min-width:0',
  'box-sizing:border-box',
].join(';');

export function v2ZHeader(content = '') {
  return `<div data-v2-z-header style="${Z_HEADER_STYLE}">${v2ZDismissAffordance()}${content}</div>`;
}

export function v2ZBody(content = '') {
  return `<div data-v2-z-body style="${Z_BODY_STYLE}">${content}</div>`;
}

export function v2ZFrame(content = '', { header = '' } = {}) {
  return `${v2ZHeader(header)}${v2ZBody(content)}`;
}
