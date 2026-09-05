import { escapeHtml } from '../utils/escape-html.js';
import { list } from '../lists/list.js';

/**
 * Canonical Core UI StateView.
 *
 * Presents a generic current state as independent, clickable data blocks,
 * separated visually from each other and from the final actions.
 * The component does not know what the state represents.
 */
export function stateView({ title = '', blocks = [], actions = [], className = '' } = {}) {
  const safeBlocks = Array.isArray(blocks) ? blocks : [];
  const safeActions = Array.isArray(actions) ? actions : [];

  const renderedBlocks = safeBlocks.map((block = {}, index) => {
    const items = Array.isArray(block.items) ? block.items.map((item = {}) => ({ ...item, interactive: false })) : [];
    const blockId = block.id ?? index;
    const clickable = block.interactive !== false;
    const attrs = [
      `data-state-view-block="${escapeHtml(blockId)}"`,
      clickable ? 'role="button" tabindex="0"' : '',
      block.data || '',
      block.aria ? `aria-label="${escapeHtml(block.aria)}"` : ''
    ].filter(Boolean).join(' ');

    return `${block.heading ? `<div class="ui-state-view__separator"><span>${escapeHtml(block.heading)}</span></div>` : (index ? '<div class="ui-state-view__separator" aria-hidden="true"></div>' : '')}` +
      `<div class="ui-state-view__block${clickable ? ' is-interactive' : ''}" ${attrs}>${list({ items }) || '<div class="ui-state-view__empty">Нет данных</div>'}</div>`;
  }).join('');

  const renderedActions = safeActions.map((action = {}) => {
    const label = escapeHtml(action.label ?? '');
    const type = escapeHtml(action.type ?? 'button');
    const className = escapeHtml(action.className ?? '');
    const data = action.data ? ` ${action.data}` : '';
    const aria = action.aria ? ` aria-label="${escapeHtml(action.aria)}"` : '';
    return `<button type="${type}" class="ui-button${className ? ` ${className}` : ''}"${data}${aria}>${label}</button>`;
  }).join('');

  return `<section class="ui-state-view${className ? ` ${escapeHtml(className)}` : ''}" data-state-view>` +
    `<h1 class="ui-state-view__title">${escapeHtml(title)}</h1>` +
    `<div class="ui-state-view__blocks">${renderedBlocks}</div>` +
    (safeActions.length ? '<div class="ui-state-view__actions-spacer" aria-hidden="true"></div>' : '') +
    (renderedActions ? `<div class="ui-state-view__actions">${renderedActions}</div>` : '') +
    `</section>`;
}

export function initStateView(root, { onBlockSelect = () => {} } = {}) {
  if (!root) return { destroy() {} };

  const handleActivate = (event) => {
    const block = event.target.closest('[data-state-view-block]');
    if (!block || !root.contains(block) || !block.classList.contains('is-interactive')) return;
    if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onBlockSelect(block.dataset.stateViewBlock, block);
  };

  root.addEventListener('click', handleActivate);
  root.addEventListener('keydown', handleActivate);

  return {
    destroy() {
      root.removeEventListener('click', handleActivate);
      root.removeEventListener('keydown', handleActivate);
    }
  };
}
