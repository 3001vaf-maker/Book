import { modal, mountModal } from '../modals/index.js';
import { escapeHtml } from '../utils/escape-html.js';

function text(value = '') {
  return escapeHtml(String(value ?? ''));
}

function dataAttributes(data = '') {
  const value = String(data || '').trim();
  return value ? ` ${value}` : '';
}

function titleFontSize(value = '') {
  const length = String(value || '').trim().length;
  if (length <= 34) return 16;
  if (length <= 46) return 15;
  if (length <= 58) return 13.5;
  if (length <= 72) return 12;
  return 10.5;
}

export function documentTile({
  title = 'Документ',
  version = '',
  meta = '',
  status = '',
  statusState = '',
  interactive = true,
  data = '',
  aria = '',
  className = '',
} = {}) {
  const tag = interactive ? 'button' : 'article';
  const attrs = interactive
    ? ` type="button"${dataAttributes(data)} aria-label="${text(aria || title)}"`
    : '';
  const state = ['signed', 'revoked', 'pending'].includes(String(statusState || ''))
    ? String(statusState)
    : '';
  const statusSymbol = state === 'signed' ? '✓' : state === 'revoked' ? '×' : state === 'pending' ? '—' : '';
  const statusMarkup = status
    ? `<span class="document-tile__status${state ? ` is-${state}` : ''}" aria-label="${text(status)}" title="${text(status)}"><span class="document-tile__status-mark" aria-hidden="true">${statusSymbol}</span></span>`
    : '';

  return `<${tag} class="document-tile${className ? ` ${text(className)}` : ''}"${attrs}>
    <span class="document-tile__fold" aria-hidden="true"></span>
    <span class="document-tile__body">
      <strong class="document-tile__title" style="--document-title-size:${titleFontSize(title)}px">${text(title)}</strong>
      ${version !== '' ? `<span class="document-tile__version">Версия ${text(version)}</span>` : ''}
    </span>
    <span class="document-tile__footer">
      <small class="document-tile__meta">${meta ? text(meta) : '&nbsp;'}</small>
      ${statusMarkup}
    </span>
  </${tag}>`;
}

export function documentTiles(items = [], { className = '', layout = 'stack' } = {}) {
  const values = (Array.isArray(items) ? items : []).filter(Boolean);
  const layoutClass = layout === 'rail' ? ' document-tiles--rail' : '';
  return `<div class="document-tiles${layoutClass}${className ? ` ${text(className)}` : ''}" data-document-tiles data-document-layout="${layout === 'rail' ? 'rail' : 'stack'}">${values.join('')}</div>`;
}

export function documentPage({ title = 'Документ', version = '', content = '' } = {}) {
  const body = String(content || '').trim()
    ? String(content).trim().split(/\n{2,}/).map((part) => `<p>${text(part).replaceAll('\n', '<br>')}</p>`).join('')
    : '<p>Текст документа не заполнен.</p>';

  return `<article class="document-page">
    ${version !== '' ? `<div class="document-page__version">Версия ${text(version)}</div>` : ''}
    <h1>${text(title)}</h1>
    <div class="document-page__body">${body}</div>
  </article>`;
}

export function openDocumentViewer({
  title = 'Документ',
  version = '',
  content = '',
  pdfDataUrl = '',
} = {}) {
  const body = pdfDataUrl
    ? `<iframe class="document-viewer__pdf" src="${text(pdfDataUrl)}#toolbar=0&navpanes=0" title="${text(title)}"></iframe>`
    : documentPage({ title, version, content });
  const layer = mountModal(document.body, modal(
    `<div class="document-viewer__content">${body}</div>`,
    {
      title,
      variant: 'technical',
      surface: 'app',
      className: 'document-viewer-sheet',
    },
  ));
  layer?.classList.add('document-viewer-backdrop');
  return layer;
}
