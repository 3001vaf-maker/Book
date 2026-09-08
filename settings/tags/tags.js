import { actionBlock, button, colorPicker, emptyState, escapeHtml, field, iconButton, initColorPickers, mountModal, modal, pageHeader, tagManagerList } from '../../ui/ui.js';
import { createTag, getTags, saveTags } from './data.js';

function renderList(root, navigateBack) {
  const items = getTags();
  root.innerHTML = `<div class="entity-page-header">${pageHeader('Ярлыки')}<div class="page-header-action">${iconButton('+', { className: 'icon-button--primary', data: 'data-add-tag', aria: 'Добавить ярлык' })}</div></div>${items.length ? tagManagerList(items) : emptyState('Ярлыков пока нет', 'Добавьте первый ярлык кнопкой «+».')}${actionBlock(button('Назад', { className: 'ui-button--secondary', data: 'data-back-tags' }))}`;
  root.querySelector('[data-add-tag]')?.addEventListener('click', () => openForm(root, navigateBack));
  root.querySelectorAll('[data-edit-tag]').forEach((element) => {
    element.addEventListener('click', () => {
      const tag = getTags().find((item) => item.id === element.dataset.editTag);
      if (tag) openForm(root, navigateBack, tag);
    });
    element.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      element.click();
    });
  });
  root.querySelectorAll('[data-delete-tag]').forEach((element) => element.addEventListener('click', (event) => {
    event.stopPropagation();
    confirmDelete(root, element.dataset.deleteTag, navigateBack);
  }));
  root.querySelector('[data-back-tags]')?.addEventListener('click', navigateBack);
}

function openForm(root, navigateBack, existing = null) {
  const title = existing ? 'Изменить ярлык' : 'Новый ярлык';
  const html = `<form class="compact-form" data-tag-form><div class="modal-title"><h2>${title}</h2></div>${colorPicker({ name: 'tagColor', value: existing?.color || '#F6D32D' })}${field({ label: 'Название ярлыка', name: 'tagName', value: existing?.name || '', placeholder: 'Название ярлыка', required: true })}${button('Сохранить', { type: 'submit' })}</form>`;
  const m = mountModal(root, modal(html, { title }));
  initColorPickers(m);
  m.querySelector('[data-tag-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    saveTag(root, m, navigateBack, existing);
  });
}

function saveTag(root, modalRoot, navigateBack, existing = null) {
  const data = new FormData(modalRoot.querySelector('[data-tag-form]'));
  const name = String(data.get('tagName') || '').trim();
  if (!name) return;
  const color = String(data.get('tagColor') || '#F6D32D');

  if (existing) {
    const updated = {
      ...existing,
      name,
      color,
      updatedAt: new Date().toISOString(),
    };
    saveTags(getTags().map((item) => item.id === existing.id ? updated : item));
  } else {
    const tag = createTag({ name, color });
    saveTags([...getTags(), tag]);
  }

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
