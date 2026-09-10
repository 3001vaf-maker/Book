import { actionBlock, button, escapeHtml, field, folderList, iconButton, initViewNavigation, list, modal, mountModal, page, pageHeader, textareaField, viewNavigation } from '../../ui/ui.js';
import { getAllClients } from '../../main/clients/data.js';
import { createDocument, getDocuments, saveDocument } from './data.js';
import { getConsents } from './consents.js';
import { getDocumentHistory } from './history.js';

const HISTORY_VIEWS = [
  { id: 'documents', label: 'Документы' },
  { id: 'signatures', label: 'Подписания' },
];

let currentSection = 'root';
let currentHistoryView = 'documents';

function statusText(item) {
  if (!item.clientConsent) return 'Документ';
  return item.required ? 'Обязательное согласие' : 'Необязательное согласие';
}

function actionText(action) {
  if (action === 'created') return 'Создан';
  if (action === 'version-created') return 'Новая версия';
  if (action === 'renamed') return 'Переименован';
  return 'Изменён';
}

function consentStateText(status) {
  if (status === 'revoked') return 'Отозвано';
  if (status === 'declined') return 'Не дано';
  return 'Дано';
}

function formatMoment(value) {
  if (!value) return 'Дата не зафиксирована';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Дата не зафиксирована';
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

function legalNotice() {
  return `<div class="modal-title"><h2>О шаблоне</h2><p>Для обработки персональных данных необходимо законное основание. Book даёт общий шаблон, но не гарантирует его соответствие именно вашей ситуации. Перед использованием рекомендуется обратиться к юристу.</p></div>`;
}

function openDocumentEditor(item, onSaved) {
  const html = `<form data-document-form>
    <div class="modal-title"><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(statusText(item))} · версия ${escapeHtml(item.version || 1)}</p></div>
    <div class="compact-form">
      ${field({ label: 'Название', name: 'documentTitle', value: item.title, required: true })}
      ${textareaField({ label: 'Текст документа', name: 'documentText', value: item.text || '', placeholder: 'Введите текст документа' })}
      <div class="modal-actions">${button('Сохранить', { type: 'submit' })}${button('О шаблоне', { type: 'button', className: 'ui-button--secondary', data: 'data-document-info' })}</div>
    </div>
  </form>`;
  const m = mountModal(document.body, modal(html, { title: item.title, variant: 'large', surface: 'app' }));
  if (!m) return;
  m.querySelector('[data-document-info]')?.addEventListener('click', () => mountModal(document.body, modal(legalNotice(), { title: 'О шаблоне', variant: 'medium', surface: 'app' })));
  m.querySelector('[data-document-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const title = m.querySelector('[name="documentTitle"]')?.value.trim() || '';
    if (!title) return;
    saveDocument({ ...item, title, text: m.querySelector('[name="documentText"]')?.value.trim() || '' });
    m.remove();
    onSaved?.();
  });
}

function openCreateDocument(onCreated) {
  const html = `<form data-document-create>
    <div class="modal-title"><h2>Новый шаблон</h2></div>
    <div class="compact-form">
      ${field({ label: 'Название', name: 'documentTitle', placeholder: 'Название документа', required: true })}
      ${textareaField({ label: 'Текст документа', name: 'documentText', placeholder: 'Текст можно добавить сейчас или позже' })}
      <div class="modal-actions">${button('Создать', { type: 'submit' })}</div>
    </div>
  </form>`;
  const m = mountModal(document.body, modal(html, { title: 'Новый шаблон', variant: 'medium', surface: 'app' }));
  if (!m) return;
  m.querySelector('[data-document-create]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const title = m.querySelector('[name="documentTitle"]')?.value.trim() || '';
    if (!title) return;
    createDocument({ title, text: m.querySelector('[name="documentText"]')?.value.trim() || '' });
    m.remove();
    onCreated?.();
  });
}

function rootMarkup() {
  return page([
    pageHeader('Документы'),
    folderList([
      { title: 'Шаблоны', data: 'data-documents-section="templates"', aria: 'Открыть шаблоны документов' },
      { title: 'История', data: 'data-documents-section="history"', aria: 'Открыть историю документов' },
    ]),
  ]);
}

function templatesMarkup() {
  const documents = getDocuments();
  const rows = list({
    items: documents.map((item) => ({
      title: item.title,
      secondary: `Версия ${item.version || 1}`,
      interactive: true,
      data: `data-document-id="${escapeHtml(item.id)}"`,
      aria: `Открыть документ ${item.title}`
    }))
  });

  return page([
    pageHeader('Шаблоны'),
    `<div class="ui-list-toolbar"><div></div><div class="ui-list-toolbar__actions">${iconButton('+', { className: 'icon-button--primary', data: 'data-add-document', aria: 'Добавить шаблон' })}</div></div>`,
    rows,
    actionBlock(button('Назад', { className: 'ui-button--secondary', data: 'data-documents-root' }))
  ]);
}

function documentHistoryMarkup() {
  const items = getDocumentHistory();
  return list({
    items: items.map((item) => ({
      title: item.documentTitle,
      secondary: [`${actionText(item.action)} · версия ${item.documentVersion}`, formatMoment(item.createdAt)],
    }))
  });
}

function signatureHistoryMarkup() {
  const documents = new Map(getDocuments().map((item) => [item.id, item]));
  const clients = new Map(getAllClients().map((item) => [item.key, item]));
  const items = [...getConsents()].sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));
  return list({
    items: items.map((item) => {
      const document = documents.get(item.documentId);
      const client = clients.get(item.clientId);
      const clientName = client ? [client.name, client.surname].filter(Boolean).join(' ') : 'Клиент';
      return {
        title: document?.title || item.documentId,
        secondary: [`${clientName} · ${consentStateText(item.status)}`, `Версия ${item.documentVersion} · ${formatMoment(item.acceptedAt || item.revokedAt || item.createdAt)}`],
      };
    })
  });
}

function historyMarkup() {
  return page([
    pageHeader('История'),
    viewNavigation({ views: HISTORY_VIEWS, activeView: currentHistoryView, ariaLabel: 'История документов' }),
    currentHistoryView === 'documents' ? documentHistoryMarkup() : signatureHistoryMarkup(),
    actionBlock(button('Назад', { className: 'ui-button--secondary', data: 'data-documents-root' }))
  ]);
}

function bind(root, navigateBack) {
  root.querySelectorAll('[data-documents-section]').forEach((item) => item.addEventListener('click', () => {
    currentSection = item.dataset.documentsSection;
    render(root, navigateBack);
  }));
  root.querySelector('[data-documents-root]')?.addEventListener('click', () => {
    currentSection = 'root';
    render(root, navigateBack);
  });
  root.querySelector('[data-add-document]')?.addEventListener('click', () => openCreateDocument(() => render(root, navigateBack)));
  root.querySelectorAll('[data-document-id]').forEach((row) => row.addEventListener('click', () => {
    const item = getDocuments().find((document) => document.id === row.dataset.documentId);
    if (item) openDocumentEditor(item, () => render(root, navigateBack));
  }));
  if (currentSection === 'history') {
    initViewNavigation(root, {
      views: HISTORY_VIEWS,
      activeView: currentHistoryView,
      onChange: (view) => {
        currentHistoryView = view;
        render(root, navigateBack);
      },
    });
  }
}

export function render(root, navigateBack = () => {}) {
  root.innerHTML = currentSection === 'templates'
    ? templatesMarkup()
    : currentSection === 'history'
      ? historyMarkup()
      : rootMarkup();
  bind(root, navigateBack);
}
