import { actionBlock, button, emptyState, escapeHtml, field, iconButton, listEntries, listEntry, mountModal, modal, pageHeader } from '../../ui/ui.js';
import { colorPicker, initColorPickers } from '../../ui/colors/index.js';
import { createTag, getTags, saveTags } from './data.js';

function renderList(root, navigateBack) {
  const items = getTags();
  root.innerHTML = `<div class="entity-page-header">${pageHeader('Ярлыки')}<div class="page-header-action">${iconButton('+', { className: 'icon-button--primary', data: 'data-add-tag', aria: 'Добавить ярлык' })}</div></div>${items.length ? listEntries(items.map(renderRow)) : emptyState('Ярлыков пока нет', 'Добавьте первый ярлык кнопкой «+».')}${actionBlock(button('Назад', { className: 'ui-button--secondary', data: 'data-back-tags' }))}`;
  root.querySelector('[data-add-tag]')?.addEventListener('click', () => openForm(root, navigateBack));
  root.querySelectorAll('[data-delete-action]').forEach((element) => element.addEventListener('click', (event) => {
    event.stopPropagation();
    confirmDelete(root, element.dataset.deleteAction, navigateBack);
  }));
  root.querySelector('[data-back-tags]')?.addEventListener('click', navigateBack);
}

function renderRow(tag) {
  return listEntry({
    title: tag.name,
    leadingSwatch: tag.color,
    interactive: false,
    deleteData: tag.id,
    deleteAria: `Удалить ярлык ${tag.name}`,
  });
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
  const tag = createTag({ name, color: String(data.get('tagColor') || '#3B302B') });
  saveTags([...getTags(), tag]);
  modalRoot.remove();
  renderList(root, navigateBack);
}

function confirmDelete(root,id,navigateBack){
  const tag=getTags().find(item=>item.id===id);if(!tag)return;
  const m=mountModal(root,modal(`<div class="modal-title"><h2>Удалить?</h2><p>${escapeHtml(tag.name)} будет удалён.</p></div><div class="modal-actions">${button('Удалить',{variant:'danger',data:'data-confirm-delete'})}${button('Отмена',{className:'ui-button--secondary',data:'data-cancel-delete'})}</div>`,{variant:'compact'}));
  if(!m)return;
  m.querySelector('[data-cancel-delete]').onclick=()=>m.remove();
  m.querySelector('[data-confirm-delete]').onclick=()=>{saveTags(getTags().filter(item=>item.id!==id));m.remove();renderList(root,navigateBack)};
}

export function renderTags(root, navigateBack = () => {}) {
  renderList(root, navigateBack);
}
