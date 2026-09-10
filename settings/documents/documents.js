import { actionBlock, button, escapeHtml, field, iconButton, list, modal, mountModal, page, pageHeader, textareaField } from '../../ui/ui.js';
import { createDocument, getDocuments, saveDocument } from './data.js';

function statusText(item) {
  if (!item.clientConsent) return 'Документ';
  return item.required ? 'Обязательное согласие' : 'Необязательное согласие';
}

function openDocumentEditor(item, onSaved) {
  const html = `<form data-document-form>
    <div class="modal-title"><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(statusText(item))}</p></div>
    <div class="compact-form">
      ${field({ label: 'Название', name: 'documentTitle', value: item.title, required: true })}
      ${textareaField({ label: 'Текст документа', name: 'documentText', value: item.text || '', placeholder: 'Введите текст документа' })}
      <div class="modal-actions">${button('Сохранить', { type: 'submit' })}</div>
    </div>
  </form>`;
  const m = mountModal(document.body, modal(html, { title: item.title, variant: 'large', surface: 'app' }));
  if (!m) return;
  m.querySelector('[data-document-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const title = m.querySelector('[name="documentTitle"]')?.value.trim() || '';
    if (!title) return;
    saveDocument({
      ...item,
      title,
      text: m.querySelector('[name="documentText"]')?.value.trim() || ''
    });
    m.remove();
    onSaved?.();
  });
}

function openCreateDocument(onCreated) {
  const html = `<form data-document-create>
    <div class="modal-title"><h2>Новый документ</h2><p>Создайте отдельный контейнер для дополнительного документа.</p></div>
    <div class="compact-form">
      ${field({ label: 'Название', name: 'documentTitle', placeholder: 'Название документа', required: true })}
      ${textareaField({ label: 'Текст документа', name: 'documentText', placeholder: 'Текст можно добавить сейчас или позже' })}
      <div class="modal-actions">${button('Создать', { type: 'submit' })}</div>
    </div>
  </form>`;
  const m = mountModal(document.body, modal(html, { title: 'Новый документ', variant: 'medium', surface: 'app' }));
  if (!m) return;
  m.querySelector('[data-document-create]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const title = m.querySelector('[name="documentTitle"]')?.value.trim() || '';
    if (!title) return;
    createDocument({
      title,
      text: m.querySelector('[name="documentText"]')?.value.trim() || ''
    });
    m.remove();
    onCreated?.();
  });
}

export function render(root, navigateBack = () => {}) {
  const documents = getDocuments();
  const rows = list({
    items: documents.map((item) => ({
      title: item.title,
      secondary: statusText(item),
      interactive: true,
      data: `data-document-id="${escapeHtml(item.id)}"`,
      aria: `Открыть документ ${item.title}`
    }))
  });

  root.innerHTML = page([
    `<div class="entity-page-header">${pageHeader('Документы', 'Шаблоны требуют адаптации под вашу работу и юридической проверки.')}<div class="page-header-action">${iconButton('+', { className: 'icon-button--primary', data: 'data-add-document', aria: 'Добавить документ' })}</div></div>`,
    `<section class="ui-page-section"><p class="muted">Для обработки персональных данных необходимо законное основание. Book даёт общий шаблон, но не гарантирует его соответствие именно вашей ситуации. Перед использованием рекомендуется обратиться к юристу.</p>${rows}</section>`,
    actionBlock(button('Назад', { className: 'ui-button--secondary', data: 'data-documents-back' }))
  ]);

  root.querySelector('[data-documents-back]')?.addEventListener('click', navigateBack);
  root.querySelector('[data-add-document]')?.addEventListener('click', () => openCreateDocument(() => render(root, navigateBack)));
  root.querySelectorAll('[data-document-id]').forEach((row) => row.addEventListener('click', () => {
    const item = getDocuments().find((document) => document.id === row.dataset.documentId);
    if (item) openDocumentEditor(item, () => render(root, navigateBack));
  }));
}
