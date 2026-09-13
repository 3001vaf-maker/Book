import { escapeHtml } from '../utils/escape-html.js';

function columnLines(lines = []) {
  return (Array.isArray(lines) ? lines : []).slice(0, 3).map((line) => {
    const item = line && typeof line === 'object' && !Array.isArray(line) ? line : { value: line };
    const value = escapeHtml(item.value ?? '');
    const classes = ['list-entry__column-line', item.strong ? 'is-strong' : '', item.muted ? 'is-muted' : '', item.className || ''].filter(Boolean).join(' ');
    return `<span class="${classes}">${value || '&nbsp;'}</span>`;
  }).join('');
}

/**
 * Canonical compact entry used by entity lists.
 * List Entry is intentionally separate from entityCard(): it renders one
 * item inside a list; entityCard() renders the opened entity.
 *
 * `columns` is the canonical dense 3-line list form. It supports up to
 * three columns, each with up to three lines, without creating a feature-
 * specific list component.
 */
export function listEntry({
  overline = '',
  title = '',
  subtitle = '',
  rightTop = '',
  rightBottom = '',
  columns = [],
  image = '',
  initial = '?',
  leadingSwatch = '',
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
  const columnValues = (Array.isArray(columns) ? columns : []).slice(0, 3);
  const columnMode = columnValues.length > 0;
  const tag = interactive ? 'button' : 'div';
  const attrs = interactive
    ? `type="button" ${data} ${aria ? `aria-label="${escapeHtml(aria)}"` : ''}`
    : '';
  const style = image ? ` style="--list-entry-image:url('${escapeHtml(image)}')"` : '';
  const secondLine = subtitle || '\u00a0';
  const swatch = leadingSwatch ? `<span class="list-entry__swatch" style="--list-entry-swatch:${escapeHtml(leadingSwatch)}" aria-hidden="true"></span>` : '';
  const right = rightTop || rightBottom
    ? `<span class="list-entry__right">${rightTop ? `<strong>${escapeHtml(rightTop)}</strong>` : ''}${rightBottom ? `<small>${escapeHtml(rightBottom)}</small>` : ''}</span>`
    : '';
  const action = actionData
    ? `<span class="list-entry__action" ${actionData} ${actionAria ? `aria-label="${escapeHtml(actionAria)}"` : ''} role="button" tabindex="0">${escapeHtml(actionIcon)}</span>`
    : '';
  const deleteAction = deleteData
    ? `<span class="list-entry__delete" data-delete-action="${escapeHtml(deleteData)}" aria-label="${escapeHtml(deleteAria)}">×</span>`
    : '';
  const firstLine = overline ? `<strong>${escapeHtml(overline)}</strong>` : '';
  const classes = ['list-entry', image ? 'has-image' : '', columnMode ? 'list-entry--columns' : '', className].filter(Boolean).join(' ');

  if (columnMode) {
    return `<${tag} class="${classes}"${attrs}${style}>
      <span class="list-entry__background" aria-hidden="true"></span>
      <span class="list-entry__content">
        <span class="list-entry__columns">${columnValues.map((column, index) => `<span class="list-entry__column list-entry__column--${index + 1}">${columnLines(column)}</span>`).join('')}</span>
        ${action}${deleteAction}
      </span>
    </${tag}>`;
  }

  return `<${tag} class="${classes}"${attrs}${style}>
    <span class="list-entry__background" aria-hidden="true">${image ? '' : `<span>${escapeHtml(initial)}</span>`}</span>
    <span class="list-entry__content">
      <span class="list-entry__main${swatch ? ' has-swatch' : ''}">${swatch}<span class="list-entry__text">${firstLine}<strong>${escapeHtml(title)}</strong><small>${escapeHtml(secondLine)}</small></span></span>
      ${right}${action}${deleteAction}
    </span>
  </${tag}>`;
}

export function listEntries(items = []) {
  return `<div class="list-entries">${(Array.isArray(items) ? items : []).join('')}</div>`;
}
