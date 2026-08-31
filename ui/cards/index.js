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
  aria = '',
  top = '',
  bottom = '',
  right = ''
} = {}) {
  const tag = interactive ? 'button' : 'section';
  const attrs = interactive
    ? `type="button" ${data} ${aria ? `aria-label="${escapeHtml(aria)}"` : ''}`
    : '';
  const style = image ? ` style="--entity-card-image:url('${escapeHtml(image)}')"` : '';
  const standard = `${id ? `<span class="entity-card__id">${escapeHtml(id)}</span>` : ''}<strong class="entity-card__title">${escapeHtml(title)}</strong>${subtitle ? `<span class="entity-card__subtitle">${escapeHtml(subtitle)}</span>` : ''}`;
  const content = top || bottom || right
    ? `<div class="entity-card__top">${top || standard}</div><div class="entity-card__bottom"><div class="entity-card__bottom-main">${bottom || ''}</div>${right ? `<div class="entity-card__bottom-right">${right}</div>` : ''}</div>`
    : `${standard}${meta.length ? `<div class="entity-card__meta">${meta.map(({ value = '—', label = '' }) => `<span><strong>${escapeHtml(value)}</strong>${label ? `<small>${escapeHtml(label)}</small>` : ''}</span>`).join('')}</div>` : ''}`;
  return `<${tag} class="entity-card ${image ? 'has-image' : ''} ${className}"${attrs}${style}>
    <div class="entity-card__background" aria-hidden="true">${image ? '' : `<span>${escapeHtml(initial)}</span>`}</div>
    <div class="entity-card__content">${content}</div>
  </${tag}>`;
}
