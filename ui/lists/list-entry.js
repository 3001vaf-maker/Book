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
 * Canonical V2 compact entry used by entity lists.
 * V2 List Entry is intentionally separate from entityCard(): it renders one
 * item inside a list; entityCard() renders the opened entity.
 *
 * `columns` is the canonical dense 3-line list form. It supports up to
 * three columns, each with up to three lines, without creating a feature-
 * specific list component.
 */
export function v2ListEntry({
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
  toggleData = '',
  toggleAria = '',
  toggleChecked = false,
  toggleDisabled = false,
  deleteData = '',
  deleteAria = 'Удалить',
  selected = false
} = {}) {
  const columnValues = (Array.isArray(columns) ? columns : []).slice(0, 3);
  const columnMode = columnValues.length > 0;
  const tag = interactive ? 'button' : 'div';
  const attrs = interactive
    ? `type="button" ${data} aria-pressed="${selected ? 'true' : 'false'}" ${aria ? `aria-label="${escapeHtml(aria)}"` : ''}`
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
  const toggleAction = toggleData
    ? `<button type="button" class="list-entry__toggle${toggleChecked ? ' is-on' : ''}" ${toggleData} aria-pressed="${toggleChecked ? 'true' : 'false'}"${toggleAria ? ` aria-label="${escapeHtml(toggleAria)}"` : ''}${toggleDisabled ? ' disabled' : ''}><span class="app-setting-toggle__switch${toggleChecked ? ' is-on' : ''}" aria-hidden="true"><span></span></span></button>`
    : '';
  const deleteAction = deleteData
    ? `<span class="list-entry__delete" data-delete-action="${escapeHtml(deleteData)}" aria-label="${escapeHtml(deleteAria)}">×</span>`
    : '';
  const firstLine = overline ? `<strong>${escapeHtml(overline)}</strong>` : '';
  const classes = ['list-entry', image ? 'has-image' : '', columnMode ? 'list-entry--columns' : '', selected ? 'is-selected' : '', className].filter(Boolean).join(' ');

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
      ${right}${toggleAction}${action}${deleteAction}
    </span>
  </${tag}>`;
}

export function v2ListEntries(items = []) {
  return `<div class="list-entries">${(Array.isArray(items) ? items : []).join('')}</div>`;
}

/**
 * Shared long-press reorder interaction for an existing V2 list.
 * It does not draw another list or reorder UI: the existing list entries are
 * moved in place after a deliberate hold, then the caller receives the new IDs.
 */
export function initV2ListReorder(root, {
  selector = '[data-reorder-id]',
  idAttribute = 'reorderId',
  holdMs = 360,
  onReorder = () => {},
} = {}) {
  const host = root?.matches?.('.list-entries') ? root : root?.querySelector?.('.list-entries');
  if (!host) return () => {};

  let timer = 0;
  let active = null;
  let source = null;
  let pointerId = null;
  let startX = 0;
  let startY = 0;
  let suppressClick = false;

  const entries = () => [...host.querySelectorAll(selector)];
  const valueOf = (node) => String(node?.dataset?.[idAttribute] || '');
  const clearTimer = () => {
    if (timer) window.clearTimeout(timer);
    timer = 0;
  };
  const resetState = () => {
    clearTimer();
    if (active) active.classList.remove('is-reordering');
    host.classList.remove('is-reordering');
    active = null;
    source = null;
    pointerId = null;
  };
  const finish = (commit = false) => {
    const hadActive = Boolean(active);
    if (commit && hadActive) {
      const ids = entries().map(valueOf).filter(Boolean);
      if (ids.length) onReorder(ids);
      suppressClick = true;
    }
    resetState();
  };
  const activate = () => {
    timer = 0;
    if (!source?.isConnected || pointerId == null) return;
    active = source;
    active.classList.add('is-reordering');
    host.classList.add('is-reordering');
    suppressClick = true;
    try { source.setPointerCapture?.(pointerId); } catch {}
  };
  const schedule = (node, event) => {
    finish(false);
    source = node;
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    timer = window.setTimeout(activate, Math.max(250, Number(holdMs) || 360));
  };
  const moveActive = (clientY) => {
    if (!active) return;
    const candidates = entries().filter((node) => node !== active);
    const target = candidates.find((node) => {
      const rect = node.getBoundingClientRect();
      return clientY >= rect.top && clientY <= rect.bottom;
    });
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const before = clientY < rect.top + rect.height / 2;
    if (before) host.insertBefore(active, target);
    else host.insertBefore(active, target.nextSibling);
  };

  const onPointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const node = event.target.closest(selector);
    if (!node || !host.contains(node)) return;
    schedule(node, event);
  };
  const onPointerMove = (event) => {
    if (!source || event.pointerId !== pointerId) return;
    if (!active) {
      if (Math.hypot(event.clientX - startX, event.clientY - startY) > 7) resetState();
      return;
    }
    event.preventDefault();
    moveActive(event.clientY);
  };
  const onPointerUp = (event) => {
    if (!source || event.pointerId !== pointerId) return;
    if (active) {
      try {
        if (source.hasPointerCapture?.(event.pointerId)) source.releasePointerCapture?.(event.pointerId);
      } catch {}
      finish(true);
      return;
    }
    // A short press is a normal tap/click. Do not cancel or synthesize it:
    // the entry's native click handler must remain the only activation path.
    resetState();
  };
  const onPointerCancel = (event) => {
    if (pointerId != null && event.pointerId !== pointerId) return;
    resetState();
  };
  const onClick = (event) => {
    if (!suppressClick) return;
    const node = event.target.closest(selector);
    if (!node || !host.contains(node)) return;
    event.preventDefault();
    event.stopPropagation();
    suppressClick = false;
  };

  host.addEventListener('pointerdown', onPointerDown, { passive: true });
  host.addEventListener('pointermove', onPointerMove, { passive: false });
  host.addEventListener('pointerup', onPointerUp);
  host.addEventListener('pointercancel', onPointerCancel);
  host.addEventListener('click', onClick, true);

  return () => {
    resetState();
    host.removeEventListener('pointerdown', onPointerDown);
    host.removeEventListener('pointermove', onPointerMove);
    host.removeEventListener('pointerup', onPointerUp);
    host.removeEventListener('pointercancel', onPointerCancel);
    host.removeEventListener('click', onClick, true);
  };
}
