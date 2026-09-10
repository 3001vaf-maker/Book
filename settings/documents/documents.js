import { actionBlock, button, escapeHtml, field, headerControl, list, modal, mountModal, page, pageHeader, textareaField } from '../../ui/ui.js';
import { createDocument, getDocuments, saveDocument } from './data.js';

function statusText(document) {
  if (!document.clientConsent) return 'Документ';
  return document.required ? 'Обязательное согласие' : 'Необязательное согласие';
}

function openDocumentEditor(document, onSaved) {
  const html = `<form data-document-form>
    <div class="modal-title"><h2>${escapeHtml(document.title)}</h2><p>${escapeHtml(statusText(document))}</p></div>
    <div class="compact-form">
      ${field({ label: 'Название', name: 'documentTitle', value: document.title, required: true })}
      ${textareaField({ label: 'Текст документа', name: 'documentText', value: document.text || '', placeholder: 'Введите текст документа' })}
      <div class="modal-actions">${button('Сохранить', { type: 'submit' })}</div>
    </div>
  </form>`;
  const m = mountModal(document.body, modal(html, { title: document.title, variant: 'large', surface: 'app' }));
  if (!m) return;
  m.querySelector('[data-document-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const title = m.querySelector('[name="documentTitle"]')?.value.trim() || '';
    if (!title) return;
    saveDocument({
      ...document,
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
    items: documents.map((document) => ({
      title: document.title,
      secondary: statusText(document),
      interactive: true,
      data: `data-document-id="${escapeHtml(document.id)}"`,
      aria: `Открыть документ ${document.title}`
    }))
  });

  root.innerHTML = page([
    pageHeader(
      'Документы',
      'Шаблоны требуют адаптации под вашу работу и юридической проверки.',
      headerControl('+', { data: 'data-add-document', aria: 'Добавить документ', indicator: '', className: 'header-control--primary' })
    ),
    `<section class="ui-page-section"><p class="muted">Для обработки персональных данных необходимо законное основание. Book даёт общий шаблон, но не гарантирует его соответствие именно вашей ситуации. Перед использованием рекомендуется обратиться к юристу.</p>${rows}</section>`,
    actionBlock(button('Назад', { className: 'ui-button--secondary', data: 'data-documents-back' }))
  ]);

  root.querySelector('[data-documents-back]')?.addEventListener('click', navigateBack);
  root.querySelector('[data-add-document]')?.addEventListener('click', () => openCreateDocument(() => render(root, navigateBack)));
  root.querySelectorAll('[data-document-id]').forEach((row) => row.addEventListener('click', () => {
    const document = getDocuments().find((item) => item.id === row.dataset.documentId);
    if (document) openDocumentEditor(document, () => render(root, navigateBack));
  }));
}
