import { escapeHtml } from '../utils/escape-html.js';

function attrs(data = '', aria = '') {
  return `${data ? ` ${String(data).trim()}` : ''}${aria ? ` aria-label="${escapeHtml(aria)}"` : ''}`;
}

function rowMarkup(row = {}) {
  const label = escapeHtml(row.label || '');
  const value = row.checked === true ? '✓' : row.checked === false ? '—' : escapeHtml(row.value || '');
  const content = `<span class="mini-card__row-label">${label}</span><strong class="mini-card__row-value">${value}</strong>`;
  if (row.data) {
    return `<button type="button" class="mini-card__row mini-card__row--action"${attrs(row.data, row.aria || row.label)}>${content}</button>`;
  }
  return `<div class="mini-card__row">${content}</div>`;
}

export function miniCard({
  title = '',
  value = '',
  subtitle = '',
  rows = [],
  image = '',
  imagePosition = '50% 50%',
  initials = '',
  surface = 'default',
  actionLabel = '',
  interactive = false,
  data = '',
  aria = '',
  className = '',
} = {}) {
  const tag = interactive ? 'button' : 'section';
  const resolvedSurface = surface === 'photo' ? 'photo' : 'default';
  const classes = ['mini-card', `mini-card--surface-${resolvedSurface}`, interactive ? 'mini-card--interactive' : '', image ? 'has-image' : '', className].filter(Boolean).join(' ');
  const surfaceStyle = resolvedSurface === 'photo' && image
    ? ` style="--mini-card-surface-image:url('${escapeHtml(image)}');--mini-card-image-position:${escapeHtml(imagePosition)}"`
    : '';
  const actionAttrs = interactive ? ` type="button"${attrs(data, aria || title)}` : '';
  const rowItems = Array.isArray(rows) ? rows : [];
  const media = resolvedSurface === 'default'
    ? (image
      ? `<span class="mini-card__media" style="--mini-card-image:url('${escapeHtml(image)}');--mini-card-image-position:${escapeHtml(imagePosition)}" aria-hidden="true"></span>`
      : initials
        ? `<span class="mini-card__media mini-card__media--initials" aria-hidden="true">${escapeHtml(initials)}</span>`
        : '')
    : '';

  return `<${tag} class="${escapeHtml(classes)}"${surfaceStyle}${actionAttrs}>
    <div class="mini-card__head">
      <span class="mini-card__copy">
        <strong class="mini-card__title">${escapeHtml(title)}</strong>
        ${value ? `<strong class="mini-card__value">${escapeHtml(value)}</strong>` : ''}
        ${subtitle ? `<span class="mini-card__subtitle">${escapeHtml(subtitle)}</span>` : ''}
      </span>
      ${media}
    </div>
    ${actionLabel ? `<span class="mini-card__context-action">${escapeHtml(actionLabel)}</span>` : ''}
    ${rowItems.length ? `<div class="mini-card__rows">${rowItems.map(rowMarkup).join('')}</div>` : ''}
  </${tag}>`;
}

export function miniCardRail(cards = [], { className = '' } = {}) {
  const items = Array.isArray(cards) ? cards : [];
  return `<div class="mini-card-rail${className ? ` ${escapeHtml(className)}` : ''}" data-mini-card-rail>${items.join('')}</div>`;
}

export function miniCardStack(cards = [], { className = '' } = {}) {
  const items = Array.isArray(cards) ? cards : [];
  return `<div class="mini-card-stack${className ? ` ${escapeHtml(className)}` : ''}" data-mini-card-stack>${items.join('')}</div>`;
}
