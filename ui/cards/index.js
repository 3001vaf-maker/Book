import { escapeHtml } from '../utils/escape-html.js';

function titleStyle(value = '') {
  const chars = Math.min(String(value).trim().length, 72);
  return ` style="--entity-card-title-chars:${chars}"`;
}

function topMetaStyle(value = '') {
  const chars = Math.min(String(value).trim().length, 72);
  return ` style="--entity-card-top-meta-chars:${chars}"`;
}

function actionAttrs(data = '', aria = '') {
  return `${data ? ` ${data}` : ''}${aria ? ` aria-label="${escapeHtml(aria)}"` : ''}`;
}

function metricMarkup(items = []) {
  return items.map(({ value = '—', label = '' }) => `<span class="entity-card__metric"><strong>${escapeHtml(value)}</strong>${label ? `<small>${escapeHtml(label)}</small>` : ''}</span>`).join('');
}

function topMetaMarkup(items = [], side = 'left') {
  return items.map(({ value = '—', label = '', weight = 'strong', row = '', data = '', aria = '' }) => {
    const rowClass = [1, 2, 3].includes(Number(row)) ? ` entity-card__top-meta--row-${Number(row)}` : '';
    const className = `entity-card__top-meta entity-card__top-meta--${escapeHtml(side)} entity-card__top-meta--${weight === 'regular' ? 'regular' : 'strong'}${rowClass}${data ? ' entity-card__top-meta--action' : ''}`;
    const content = `<strong${topMetaStyle(value)}>${escapeHtml(value)}</strong>${label ? `<small>${escapeHtml(label)}</small>` : ''}`;
    return data
      ? `<button type="button" class="${className}"${actionAttrs(data, aria)}>${content}</button>`
      : `<span class="${className}">${content}</span>`;
  }).join('');
}

function detailRowsMarkup(items = []) {
  return items.map(({ left = '', right = '', weight = 'regular', data = '', aria = '' }) => {
    const className = `entity-card__detail-row entity-card__detail-row--${weight === 'strong' ? 'strong' : 'regular'}${data ? ' entity-card__detail-row--action' : ''}`;
    const content = `<span>${escapeHtml(left)}</span><span>${escapeHtml(right)}</span>`;
    return data
      ? `<button type="button" class="${className}"${actionAttrs(data, aria)}>${content}</button>`
      : `<div class="${className}">${content}</div>`;
  }).join('');
}

function identityMarkup({ id = '', title = '', subtitle = '', idData = '', idAria = '', titleData = '', titleAria = '', subtitleData = '', subtitleAria = '' } = {}) {
  const idContent = id ? escapeHtml(id) : '';
  const titleContent = escapeHtml(title);
  const subtitleContent = subtitle ? escapeHtml(subtitle) : '';
  const idNode = idData
    ? `<button type="button" class="entity-card__id entity-card__identity-action"${actionAttrs(idData, idAria)}>${idContent}</button>`
    : id ? `<span class="entity-card__id">${idContent}</span>` : '<span class="entity-card__id" aria-hidden="true"></span>';
  const titleNode = titleData
    ? `<button type="button" class="entity-card__title entity-card__identity-action"${titleStyle(title)}${actionAttrs(titleData, titleAria)}>${titleContent}</button>`
    : `<strong class="entity-card__title"${titleStyle(title)}>${titleContent}</strong>`;
  const subtitleNode = subtitleData
    ? `<button type="button" class="entity-card__subtitle entity-card__identity-action"${actionAttrs(subtitleData, subtitleAria)}>${subtitleContent}</button>`
    : subtitle ? `<span class="entity-card__subtitle">${subtitleContent}</span>` : '<span class="entity-card__subtitle" aria-hidden="true"></span>';
  return `${idNode}${titleNode}${subtitleNode}`;
}

export function entityCard({
  id = '',
  title = '',
  subtitle = '',
  idData = '',
  idAria = '',
  titleData = '',
  titleAria = '',
  subtitleData = '',
  subtitleAria = '',
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
    const identity = identityMarkup({ id, title, subtitle, idData, idAria, titleData, titleAria, subtitleData, subtitleAria });
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
