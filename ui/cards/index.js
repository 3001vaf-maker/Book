import { escapeHtml } from '../utils/escape-html.js';

function titleStyle(value = '') {
  const chars = Math.min(String(value).trim().length, 72);
  return ` style="--entity-card-title-chars:${chars}"`;
}

function metricMarkup(items = []) {
  return items.map(({ value = '—', label = '' }) => `<span class="entity-card__metric"><strong>${escapeHtml(value)}</strong>${label ? `<small>${escapeHtml(label)}</small>` : ''}</span>`).join('');
}

function topMetaMarkup(items = [], side = 'left') {
  return items.map(({ value = '—', label = '', weight = 'strong', row = '' }) => {
    const rowClass = [1, 2, 3].includes(Number(row)) ? ` entity-card__top-meta--row-${Number(row)}` : '';
    return `<span class="entity-card__top-meta entity-card__top-meta--${escapeHtml(side)} entity-card__top-meta--${weight === 'regular' ? 'regular' : 'strong'}${rowClass}"><strong>${escapeHtml(value)}</strong>${label ? `<small>${escapeHtml(label)}</small>` : ''}</span>`;
  }).join('');
}

function detailRowsMarkup(items = []) {
  return items.map(({ left = '', right = '', weight = 'regular', data = '', aria = '' }) => {
    const attrs = `${data ? ` ${data}` : ''}${aria ? ` aria-label="${escapeHtml(aria)}"` : ''}`;
    return `<div class="entity-card__detail-row entity-card__detail-row--${weight === 'strong' ? 'strong' : 'regular'}"${attrs}><span>${escapeHtml(left)}</span><span>${escapeHtml(right)}</span></div>`;
  }).join('');
}

export function entityCard({
  id = '',
  title = '',
  subtitle = '',
  image = '',
  initial = '?',
  meta = [],
  topMeta = [],
  topRightMeta = [],
  detailRows = [],
  interactive = false,
  data = '',
  className = '',
  aria = '',
  top = '',
  bottom = '',
  right = '',
  metricsLayout = 'horizontal'
} = {}) {
  const tag = interactive ? 'button' : 'section';
  const attrs = interactive
    ? `type="button" ${data} ${aria ? `aria-label="${escapeHtml(aria)}"` : ''}`
    : '';
  const style = image ? ` style="--entity-card-image:url('${escapeHtml(image)}')"` : '';
  const canonical = className.includes('entity-card--hero') && !top && !bottom && !right;

  if (canonical) {
    const identity = `${id ? `<span class="entity-card__id">${escapeHtml(id)}</span>` : '<span class="entity-card__id" aria-hidden="true"></span>'}<strong class="entity-card__title"${titleStyle(title)}>${escapeHtml(title)}</strong>${subtitle ? `<span class="entity-card__subtitle">${escapeHtml(subtitle)}</span>` : '<span class="entity-card__subtitle" aria-hidden="true"></span>'}`;
    const metrics = meta.length ? `<div class="entity-card__metrics entity-card__metrics--${escapeHtml(metricsLayout)}">${metricMarkup(meta)}</div>` : '';
    const details = detailRows.length ? `<div class="entity-card__details">${detailRowsMarkup(detailRows)}</div>` : '';
    const topLeft = topMeta.length ? `<div class="entity-card__top-meta-list entity-card__top-meta-list--left">${topMetaMarkup(topMeta,'left')}</div>` : '';
    const topRight = topRightMeta.length ? `<div class="entity-card__top-meta-list entity-card__top-meta-list--right">${topMetaMarkup(topRightMeta,'right')}</div>` : '';
    return `<${tag} class="entity-card entity-card--canonical ${image ? 'has-image' : ''} ${className}"${attrs}${style}>
      <div class="entity-card__background" aria-hidden="true"></div>
      <div class="entity-card__content">
        <div class="entity-card__zone entity-card__zone--top">${topLeft}${topRight}</div>
        <div class="entity-card__zone entity-card__zone--media"></div>
        <div class="entity-card__zone entity-card__zone--identity">${identity}</div>
        ${metrics}${details}
      </div>
    </${tag}>`;
  }

  const standard = `${id ? `<span class="entity-card__id">${escapeHtml(id)}</span>` : ''}<strong class="entity-card__title">${escapeHtml(title)}</strong>${subtitle ? `<span class="entity-card__subtitle">${escapeHtml(subtitle)}</span>` : ''}`;
  const content = top || bottom || right
    ? `<div class="entity-card__top">${top || standard}</div><div class="entity-card__bottom"><div class="entity-card__bottom-main">${bottom || ''}</div>${right ? `<div class="entity-card__bottom-right">${right}</div>` : ''}</div>`
    : `${standard}${meta.length ? `<div class="entity-card__meta">${metricMarkup(meta)}</div>` : ''}`;
  return `<${tag} class="entity-card ${image ? 'has-image' : ''} ${className}"${attrs}${style}>
    <div class="entity-card__background" aria-hidden="true">${image ? '' : `<span>${escapeHtml(initial)}</span>`}</div>
    <div class="entity-card__content">${content}</div>
  </${tag}>`;
}
