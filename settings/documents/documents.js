import { actionBlock, button, escapeHtml, field, folderList, iconButton, initViewNavigation, list, modal, mountModal, page, pageHeader, shortDateTime, textareaField, viewNavigation } from '../../ui/ui.js';
import { phonesMatch } from '../../core/phone/index.js';
import { getAllClients } from '../../main/clients/data.js';
import { createDocument, getDocuments, saveCustomDocument, useBookBase } from './data.js';
import { getConsents } from './consents.js';
import { getDocumentHistory } from './history.js';

const HISTORY_VIEWS = [
  { id: 'documents', label: 'Документы' },
  { id: 'signatures', label: 'Подписания' },
];

let currentSection = 'root';
let currentHistoryView = 'documents';

function statusText(item) {
  const source = item.sourceMode === 'BOOK' ? 'Основа Book' : 'Свой документ';
  if (!item.clientConsent) return source;
  return `${source} · ${item.required ? 'обязательное согласие' : 'необязательное согласие'}`;
}

function actionText(action) {
  if (action === 'created') return 'Создан';
  if (action === 'version-created') return 'Новая версия';
  if (action === 'superseded') return 'Предыдущая версия';
  if (action === 'renamed') return 'Переименован';
  return 'Изменён';
}

function consentStateText(status) {
  if (status === 'revoked') return 'Отозвано';
  if (status === 'declined') return 'Не дано';
  return 'Дано';
}

function formatMoment(value) {
  return shortDateTime(value, 'Дата не зафиксирована');
}

function documentTextMarkup(text) {
  return `<div style="white-space:pre-wrap;line-height:1.55;padding:14px 0">${escapeHtml(text || '')}</div>`;
}

function openOwnDocumentEditor(item, onSaved) {
  const html = `<form data-document-form>
    <div class="modal-title"><h2>${escapeHtml(item.title)}</h2><p>Свой документ · текущая версия ${escapeHtml(item.version || 1)}</p></div>
    <div class="compact-form">
      ${field({ label: 'Название', name: 'documentTitle', value: item.title, required: true })}
      ${textareaField({ label: 'Текст документа', name: 'documentText', value: item.text || '', placeholder: 'Текст документа' })}
      <div class="modal-actions">
        ${button('Сохранить новую версию', { type: 'submit' })}
        ${item.baseKey ? button('Использовать основу Book', { type: 'button', className: 'ui-button--secondary', data: 'data-use-book-base' }) : ''}
      </div>
    </div>
  </form>`;
  const m = mountModal(document.body, modal(html, { title: item.title, variant: 'large', surface: 'app' }));
  if (!m) return;

  m.querySelector('[data-use-book-base]')?.addEventListener('click', () => {
    useBookBase(item.id);
    m.remove();
    onSaved?.();
  });

  m.querySelector('[data-document-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const title = m.querySelector('[name="documentTitle"]')?.value.trim() || '';
    if (!title) return;
    saveCustomDocument(item, {
      title,
      text: m.querySelector('[name="documentText"]')?.value.trim() || '',
    });
    m.remove();
    onSaved?.();
  });
}

function openDocumentEditor(item, onSaved) {
  if (item.sourceMode !== 'BOOK') {
    openOwnDocumentEditor(item, onSaved);
    return;
  }

  const updateAvailable = Number(item.availableBaseVersion || 0) > Number(item.baseVersion || 0);
  const profileUpdate = Boolean(item.profileUpdateAvailable);
  const updateLabel = updateAvailable
    ? `Перейти на основу Book v${Number(item.availableBaseVersion)}`
    : profileUpdate
      ? 'Обновить данные документа'
      : '';

  const html = `
    <div class="modal-title">
      <h2>${escapeHtml(item.title)}</h2>
      <p>Основа Book · документ версия ${escapeHtml(item.version || 1)} · основа v${escapeHtml(item.baseVersion || 1)}</p>
    </div>
    ${documentTextMarkup(item.text)}
    <div class="modal-actions">
      ${updateLabel ? button(updateLabel, { type: 'button', data: 'data-update-book-base' }) : ''}
      ${button('Использовать свой документ', { type: 'button', className: 'ui-button--secondary', data: 'data-use-own-document' })}
    </div>`;
  const m = mountModal(document.body, modal(html, { title: item.title, variant: 'large', surface: 'app' }));
  if (!m) return;

  m.querySelector('[data-update-book-base]')?.addEventListener('click', () => {
    useBookBase(item.id);
    m.remove();
    onSaved?.();
  });
  m.querySelector('[data-use-own-document]')?.addEventListener('click', () => {
    m.remove();
    openOwnDocumentEditor(item, onSaved);
  });
}

function openCreateDocument(onCreated) {
  const html = `<form data-document-create>
    <div class="modal-title"><h2>Новый документ</h2></div>
    <div class="compact-form">
      ${field({ label: 'Название', name: 'documentTitle', placeholder: 'Название документа', required: true })}
      ${textareaField({ label: 'Текст документа', name: 'documentText', placeholder: 'Текст документа' })}
      <div class="modal-actions">${button('Создать', { type: 'submit' })}</div>
    </div>
  </form>`;
  const m = mountModal(document.body, modal(html, { title: 'Новый документ', variant: 'medium', surface: 'app' }));
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

function openHistorySnapshot(item) {
  if (!item?.snapshot) return;
  const snapshot = item.snapshot;
  const html = `
    <div class="modal-title">
      <h2>${escapeHtml(snapshot.title || item.documentTitle)}</h2>
      <p>Версия ${escapeHtml(item.documentVersion || 1)} · ${escapeHtml(snapshot.sourceMode === 'BOOK' ? 'Основа Book' : 'Свой документ')}</p>
    </div>
    ${documentTextMarkup(snapshot.text || '')}`;
  mountModal(document.body, modal(html, { title: snapshot.title || item.documentTitle, variant: 'large', surface: 'app' }));
}

function rootMarkup() {
  return page([
    pageHeader('Документы'),
    folderList([
      { title: 'Документы', data: 'data-documents-section="templates"', aria: 'Открыть документы' },
      { title: 'История', data: 'data-documents-section="history"', aria: 'Открыть историю документов' },
    ]),
    actionBlock(button('Назад', { className: 'ui-button--secondary', data: 'data-documents-back' }))
  ]);
}

function templatesMarkup() {
  const documents = getDocuments();
  const rows = list({
    items: documents.map((item) => {
      const update = Number(item.availableBaseVersion || 0) > Number(item.baseVersion || 0)
        ? ` · доступна основа Book v${Number(item.availableBaseVersion)}`
        : item.profileUpdateAvailable
          ? ' · данные профиля изменились'
          : '';
      return {
        title: item.title,
        secondary: `Версия ${item.version || 1} · ${item.sourceMode === 'BOOK' ? 'Основа Book' : 'Свой документ'}${update}`,
        interactive: true,
        data: `data-document-id="${escapeHtml(item.id)}"`,
        aria: `Открыть документ ${item.title}`
      };
    })
  });

  return page([
    `<div class="entity-page-header">${pageHeader('Документы')}<div class="page-header-action">${iconButton('+', { className: 'icon-button--primary', data: 'data-add-document', aria: 'Добавить документ' })}</div></div>`,
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
      interactive: Boolean(item.snapshot),
      data: item.snapshot ? `data-document-history-id="${escapeHtml(item.id)}"` : '',
      aria: item.snapshot ? `Открыть версию ${item.documentVersion} документа ${item.documentTitle}` : '',
    }))
  });
}

function consentClient(item, clients) {
  if (item.subjectType === 'BOOKING_ACCOUNT') {
    return clients.find((client) => (client.accounts || []).includes(item.subjectKey)) || null;
  }
  if (item.subjectType !== 'CONTACT_POINT') return null;
  if (item.contactType === 'PHONE') {
    return clients.find((client) => (client.phones || []).some((value) => phonesMatch(value, item.contactValue))) || null;
  }
  if (item.contactType === 'EMAIL') {
    const target = String(item.contactValue || '').trim().toLowerCase();
    return clients.find((client) => (client.emails || []).some((value) => String(value || '').trim().toLowerCase() === target)) || null;
  }
  if (item.contactType === 'TELEGRAM') {
    const target = String(item.contactValue || '').trim();
    return clients.find((client) => (client.telegrams || []).some((value) => String(value || '').trim() === target)) || null;
  }
  return null;
}

function consentSubjectLabel(item, clients) {
  const client = consentClient(item, clients);
  if (client) return [client.name, client.surname].filter(Boolean).join(' ') || client.phones?.[0] || 'Клиент';
  if (item.subjectType === 'CONTACT_POINT') return item.contactValue || 'Contact Point';
  return 'Клиентский аккаунт';
}

function signatureHistoryMarkup() {
  const documents = new Map(getDocuments().map((item) => [item.id, item]));
  const clients = getAllClients();
  const items = [...getConsents()].sort((a, b) => Date.parse(b.eventAt || b.createdAt || 0) - Date.parse(a.eventAt || a.createdAt || 0));
  return list({
    items: items.map((item) => {
      const document = documents.get(item.documentId);
      const subject = consentSubjectLabel(item, clients);
      return {
        title: document?.title || item.documentId,
        secondary: [`${subject} · ${consentStateText(item.status)}`, `Версия ${item.documentVersion} · ${formatMoment(item.eventAt || item.acceptedAt || item.revokedAt || item.createdAt)}`],
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
  root.querySelector('[data-documents-back]')?.addEventListener('click', () => {
    currentSection = 'root';
    navigateBack();
  });
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
  root.querySelectorAll('[data-document-history-id]').forEach((row) => row.addEventListener('click', () => {
    const item = getDocumentHistory().find((historyItem) => historyItem.id === row.dataset.documentHistoryId);
    if (item) openHistorySnapshot(item);
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
