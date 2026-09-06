import { select } from '../selectors/index.js';
import { escapeHtml } from '../utils/escape-html.js';

function normalizeSelected(values = [], tags = []) {
  const ids = new Set(tags.map((tag) => tag.id));
  const byName = new Map(tags.map((tag) => [tag.name, tag.id]));
  return [...new Set((Array.isArray(values) ? values : []).map((value) => ids.has(value) ? value : byName.get(value)).filter(Boolean))];
}

function tagChip(tag) {
  return `<span class="tag" data-tag-id="${escapeHtml(tag.id)}"><span class="tag-entity-row__color" style="background:${escapeHtml(tag.color || '#3B302B')}"></span>${escapeHtml(tag.name)}<button type="button" class="remove-button" data-remove-tag aria-label="Снять ярлык ${escapeHtml(tag.name)}">×</button></span>`;
}

export function tags({ tags: available = [], selected = [], name = 'tags' } = {}) {
  const selectedIds = normalizeSelected(selected, available);
  const selectedSet = new Set(selectedIds);
  const selectedTags = selectedIds.map((id) => available.find((tag) => tag.id === id)).filter(Boolean);
  const options = [{ value: '', label: 'Добавить ярлык' }, ...available.filter((tag) => !selectedSet.has(tag.id)).map((tag) => ({ value: tag.id, label: tag.name }))];
  return `<div class="ui-tags" data-tags="${escapeHtml(name)}"><div class="tag-list" data-tag-list>${selectedTags.map(tagChip).join('')}</div>${available.length ? select({ name: `${name}-add`, value: '', options, aria: 'Добавить ярлык', data: 'data-tag-add' }) : '<span class="muted">Сначала создайте ярлыки в Настройках.</span>'}</div>`;
}

export function initTags(root) {
  root.querySelectorAll('[data-tags]').forEach((host) => {
    if (host.dataset.tagsReady === 'true') return;
    host.dataset.tagsReady = 'true';
    host.addEventListener('click', (event) => {
      const remove = event.target.closest('[data-remove-tag]');
      if (!remove) return;
      remove.closest('[data-tag-id]')?.remove();
      host.dispatchEvent(new Event('change', { bubbles: true }));
    });
    host.querySelector('[data-tag-add]')?.addEventListener('change', (event) => {
      const id = event.target.value;
      if (!id || host.querySelector(`[data-tag-id="${CSS.escape(id)}"]`)) return;
      const option = event.target.selectedOptions?.[0];
      const tag = { id, name: option?.textContent || '', color: '' };
      host.querySelector('[data-tag-list]')?.insertAdjacentHTML('beforeend', tagChip(tag));
      event.target.querySelector(`option[value="${CSS.escape(id)}"]`)?.remove();
      event.target.value = '';
      host.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });
}

export function collectTags(root, name = 'tags') {
  return [...root.querySelectorAll(`[data-tags="${CSS.escape(name)}"] [data-tag-id]`)].map((element) => element.dataset.tagId).filter(Boolean);
}
