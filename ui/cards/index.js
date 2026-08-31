import { escapeHtml } from '../ui.js';

export function entityCard({
  id = '',
  title = '',
  subtitle = '',
  image = '',
  initial = '?',
  meta = [],
  interactive = false,
  data = '',
  className = '',
  aria = ''
} = {}) {
  const tag = interactive ? 'button' : 'section';
  const attrs = interactive
    ? `type="button" ${data} ${aria ? `aria-label="${escapeHtml(aria)}"` : ''}`
    : '';
  const style = image ? ` style="--entity-card-image:url('${escapeHtml(image)}')"` : '';
  return `<${tag} class="entity-card ${image ? 'has-image' : ''} ${className}"${attrs}${style}>
    <div class="entity-card__background" aria-hidden="true">${image ? '' : `<span>${escapeHtml(initial)}</span>`}</div>
    <div class="entity-card__content">
      ${id ? `<span class="entity-card__id">${escapeHtml(id)}</span>` : ''}
      <strong class="entity-card__title">${escapeHtml(title)}</strong>
      ${subtitle ? `<span class="entity-card__subtitle">${escapeHtml(subtitle)}</span>` : ''}
      ${meta.length ? `<div class="entity-card__meta">${meta.map(({ value = '—', label = '' }) => `<span><strong>${escapeHtml(value)}</strong>${label ? `<small>${escapeHtml(label)}</small>` : ''}</span>`).join('')}</div>` : ''}
    </div>
  </${tag}>`;
}
