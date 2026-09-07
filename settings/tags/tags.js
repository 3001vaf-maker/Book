import { actionBlock, button, colorPicker, emptyState, escapeHtml, field, iconButton, initColorPickers, mountModal, modal, pageHeader } from '../../ui/ui.js?v=tag-manager-list-20260908';
import { createTag, getTags, saveTags } from './data.js';

function renderList(root, navigateBack) {
  const items = getTags();
  root.innerHTML = `<div class="entity-page-header">${pageHeader('Ярлыки')}<div class="page-header-action">${iconButton('+', { className: 'icon-button--primary', data: 'data-add-tag', aria: 'Добавить ярлык' })}</div></div>${items.length ? renderTagList(items) : emptyState('Ярлыков пока нет', 'Добавьте первый ярлык кнопкой «+».')}${actionBlock(button('Назад', { className: 'ui-button--secondary', data: 'data-back-tags' }))}`;
  root.querySelector('[data-add-tag]')?.addEventListener('click', () => openForm(root, navigateBack));
  root.querySelectorAll('[data-delete-tag]').forEach((element) => element.addEventListener('click', () => {
    confirmDelete(root, element.dataset.deleteTag, navigateBack);
  }));
  root.querySelector('[data-back-tags]')?.addEventListener('click', navigateBack);
}

function renderTagList(items) {
  return `<div class="tag-manager-list">${items.map(renderRow).join('')}</div>`;
}

function renderRow(tag) {
  return `<div class="tag-manager-list__item">
    <span class="tag-manager-list__swatch" style="--tag-manager-color:${escapeHtml(tag.color)}" aria-hidden="true"></span>
    <strong class="tag-manager-list__name">${escapeHtml(tag.name)}</strong>
    <button type="button" class="remove-button tag-manager-list__delete" data-delete-tag="${escapeHtml(tag.id)}" aria-label="Удалить ярлык ${escapeHtml(tag.name)}">×</button>
  </div>`;
}

function openForm(root, navigateBack) {
  const html = `<form class="compact-form" data-tag-form><div class="modal-title"><h2>Новый ярлык</h2></div>${colorPicker({ name: 'tagColor' })}${field({ label: 'Название ярлыка', name: 'tagName', placeholder: 'Название ярлыка', required: true })}${button('Сохранить', { type: 'submit' })}</form>`;
  const m = mountModal(root, modal(html, { title: 'Новый ярлык' }));
  initColorPickers(m);
  m.querySelector('[data-tag-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    saveTag(root, m, navigateBack);
  });
}

function saveTag(root, modalRoot, navigateBack) {
  const data = new FormData(modalRoot.querySelector('[data-tag-form]'));
  const name = String(data.get('tagName') || '').trim();
  if (!name) return;
  const tag = createTag({ name, color: String(data.get('tagColor') || '#F6D32D') });
  saveTags([...getTags(), tag]);
  modalRoot.remove();
  renderList(root, navigateBack);
}

function confirmDelete(root, id, navigateBack) {
  const tag = getTags().find((item) => item.id === id);
  if (!tag) return;
  const m = mountModal(root, modal(`<div class="modal-title"><h2>Удалить?</h2><p>${escapeHtml(tag.name)} будет удалён.</p></div><div class="modal-actions">${button('Удалить', { variant: 'danger', data: 'data-confirm-delete' })}${button('Отмена', { className: 'ui-button--secondary', data: 'data-cancel-delete' })}</div>`, { variant: 'compact' }));
  if (!m) return;
  m.querySelector('[data-cancel-delete]').onclick = () => m.remove();
  m.querySelector('[data-confirm-delete]').onclick = () => {
    saveTags(getTags().filter((item) => item.id !== id));
    m.remove();
    renderList(root, navigateBack);
  };
}

export function renderTags(root, navigateBack = () => {}) {
  renderList(root, navigateBack);
}

export { renderTags as render };
