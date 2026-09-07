import { button, emptyState, escapeHtml, iconButton, mountModal, modal, pageHeader } from '../../ui/ui.js';
import { colorPicker, initColorPickers } from '../../ui/colors/index.js';
import { createTag, getTags, saveTags } from './data.js';

function renderList(root, navigateBack) {
  const items = getTags();
  root.innerHTML = `<div class="entity-page-header">${pageHeader('Ярлыки')}<div class="page-header-action">${iconButton('+', { className: 'icon-button--primary', data: 'data-add-tag', aria: 'Добавить ярлык' })}</div></div>${items.length ? `<div class="tag-entity-list">${items.map(renderRow).join('')}</div>` : emptyState('Ярлыков пока нет', 'Добавьте первый ярлык кнопкой «+».')}<div class="profile-actions">${button('Назад', { className: 'ui-button--secondary', data: 'data-back-tags' })}</div>`;
  root.querySelector('[data-add-tag]')?.addEventListener('click', () => openForm(root, navigateBack));
  root.querySelectorAll('[data-delete-tag]').forEach((element) => element.addEventListener('click', (event) => {
    event.stopPropagation();
    deleteTag(root, element.dataset.deleteTag, navigateBack);
  }));
  root.querySelector('[data-back-tags]')?.addEventListener('click', navigateBack);
}

function renderRow(tag) {
  return `<div class="tag-entity-row"><span class="tag-entity-row__name"><span class="tag-entity-row__color" style="background:${escapeHtml(tag.color)}"></span><strong>${escapeHtml(tag.name)}</strong></span>${iconButton('×', { className: 'tag-entity-row__delete', data: `data-delete-tag="${escapeHtml(tag.id)}"`, aria: `Удалить ярлык ${tag.name}` })}</div>`;
}

function openForm(root, navigateBack) {
  const html = `<form class="compact-form" data-tag-form><div class="modal-title"><h2>Новый ярлык</h2></div>${colorPicker({ name: 'tagColor' })}<label class="field"><span>Название ярлыка *</span><input name="tagName" required placeholder="Название ярлыка"></label>${button('Сохранить', { type: 'submit' })}</form>`;
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
  const tag = createTag({
    name,
    color: String(data.get('tagColor') || '#3B302B'),
  });
  saveTags([...getTags(), tag]);
  modalRoot.remove();
  renderList(root, navigateBack);
}

function deleteTag(root, id, navigateBack) {
  const items = getTags();
  if (!items.some((tag) => tag.id === id)) return;
  saveTags(items.filter((tag) => tag.id !== id));
  renderList(root, navigateBack);
}

export function renderTags(root, navigateBack = () => {}) {
  renderList(root, navigateBack);
}
