import { escapeHtml } from '../utils/escape-html.js';

/**
 * Canonical compact entry used by entity lists.
 * List Entry is intentionally separate from entityCard(): it renders one
 * item inside a list; entityCard() renders the opened entity.
 */
export function listEntry({
  title = '',
  subtitle = '',
  rightTop = '',
  rightBottom = '',
  image = '',
  initial = '?',
  interactive = true,
  data = '',
  className = '',
  aria = '',
  actionData = '',
  actionAria = '',
  actionIcon = '⚙',
  deleteData = '',
  deleteAria = 'Удалить'
} = {}) {
  const tag = interactive ? 'button' : 'div';
  const attrs = interactive
    ? `type="button" ${data} ${aria ? `aria-label="${escapeHtml(aria)}"` : ''}`
    : '';
  const style = image ? ` style="--list-entry-image:url('${escapeHtml(image)}')"` : '';
  const secondLine = subtitle || '\u00a0';
  const right = rightTop || rightBottom
    ? `<span class="list-entry__right">${rightTop ? `<strong>${rightTop}</strong>` : ''}${rightBottom ? `<small>${rightBottom}</small>` : ''}</span>`
    : '';
  const action = actionData
    ? `<span class="list-entry__action" ${actionData} ${actionAria ? `aria-label="${escapeHtml(actionAria)}"` : ''} role="button" tabindex="0">${escapeHtml(actionIcon)}</span>`
    : '';
  const deleteAction = deleteData
    ? `<span class="list-entry__delete" data-delete-action="${escapeHtml(deleteData)}" aria-label="${escapeHtml(deleteAria)}">×</span>`
    : '';

  return `<${tag} class="list-entry ${image ? 'has-image' : ''} ${className}"${attrs}${style}>
    <span class="list-entry__background" aria-hidden="true">${image ? '' : `<span>${escapeHtml(initial)}</span>`}</span>
    <span class="list-entry__content">
      <span class="list-entry__main"><strong>${escapeHtml(title)}</strong><small>${escapeHtml(secondLine)}</small></span>
      ${right}${action}${deleteAction}
    </span>
  </${tag}>`;
}
