import { actionBlock, button, escapeHtml, field, folderList, iconButton, initViewNavigation, list, modal, mountModal, page, pageHeader, shortDateTime, textareaField, viewNavigation } from '../../ui/ui.js';
import { downloadRknGuide } from '../../tenant-document-archive.js';
import { phonesMatch } from '../../core/phone/index.js';
import { getAllPeople } from '../../main/people/data.js';
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
  if (!item.personConsent) return 'Документ';
  return item.required ? 'Обязательное согласие' : 'Необязательное согласие';
}

function isAnyRknGuide(item) {
  return item?.attachment?.type === 'RKN_GUIDE_PDF';
}

function isRknGuide(item) {
  return isAnyRknGuide(item)
    && item?.attachment?.templateKey === 'rkn-notification-guide-template'
    && Boolean(item?.attachment?.pdfBase64);
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
  return shortDateTime(value, 'Дата не зафиксирована');
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
      { title: 'Инструкции', data: 'data-documents-section="guides"', aria: 'Открыть сохранённые инструкции' },
      { title: 'История', data: 'data-documents-section="history"', aria: 'Открыть историю документов' },
    ]),
    actionBlock(button('Назад', { className: 'ui-button--secondary', data: 'data-documents-back' }))
  ]);
}

function templatesMarkup() {
  const documents = getDocuments().filter((item) => !isAnyRknGuide(item));
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
    `<div class="entity-page-header">${pageHeader('Шаблоны')}<div class="page-header-action">${iconButton('+', { className: 'icon-button--primary', data: 'data-add-document', aria: 'Добавить шаблон' })}</div></div>`,
    rows,
    actionBlock(button('Назад', { className: 'ui-button--secondary', data: 'data-documents-root' }))
  ]);
}

function openRknGuide(item) {
  const generatedAt = item?.attachment?.generatedAt || '';
  const html = `
    <div class="modal-title">
      <h2>${escapeHtml(item.title || 'Инструкция РКН')}</h2>
      <p>PDF · версия ${escapeHtml(item.version || 1)} · ${escapeHtml(formatMoment(generatedAt))}</p>
    </div>
    <p style="font-size:18px;line-height:1.55;margin:0 0 18px">Это зафиксированная персональная версия инструкции, автоматически собранная из шаблона Реестра и ваших рабочих данных. Её можно скачать повторно в любое время.</p>
    <p class="muted" data-rkn-guide-error></p>
    <div class="modal-actions">
      ${button('Скачать PDF', { data: 'data-rkn-guide-download' })}
      ${button('Закрыть', { className: 'ui-button--secondary', data: 'data-rkn-guide-close' })}
    </div>`;
  const layer = mountModal(document.body, modal(html, { title: item.title || 'Инструкция РКН', variant: 'medium', surface: 'app' }));
  if (!layer) return;
  layer.querySelector('[data-rkn-guide-close]')?.addEventListener('click', () => layer.remove());
  layer.querySelector('[data-rkn-guide-download]')?.addEventListener('click', async (event) => {
    const control = event.currentTarget;
    const errorNode = layer.querySelector('[data-rkn-guide-error]');
    control.disabled = true;
    if (errorNode) errorNode.textContent = '';
    try {
      await downloadRknGuide(item.id, item?.attachment?.fileName || 'rkn-guide.pdf');
    } catch (error) {
      if (errorNode) errorNode.textContent = error instanceof Error ? error.message : 'Не удалось скачать PDF';
      control.disabled = false;
    }
  });
}

function guidesMarkup() {
  const guides = getDocuments()
    .filter(isRknGuide)
    .sort((a, b) => Date.parse(b?.attachment?.generatedAt || 0) - Date.parse(a?.attachment?.generatedAt || 0));
  const rows = guides.length
    ? list({
      items: guides.map((item) => ({
        title: item.title,
        secondary: [`PDF · версия ${item.version || 1}`, formatMoment(item?.attachment?.generatedAt)],
        interactive: true,
        data: `data-rkn-guide-id="${escapeHtml(item.id)}"`,
        aria: `Открыть сохранённую инструкцию ${item.title}`,
      })),
    })
    : '<div class="empty-state">Сохранённых инструкций пока нет.</div>';

  return page([
    pageHeader('Инструкции'),
    '<p class="muted">Персональные инструкции Book формирует автоматически из актуального шаблона Реестра и ваших рабочих данных.</p>',
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

function consentPerson(item, people) {
  if (item.subjectType === 'ACCOUNT') {
    return people.find((person) => (person.accounts || []).includes(item.subjectKey)) || null;
  }
  if (item.subjectType !== 'CONTACT_POINT') return null;
  if (item.contactType === 'PHONE') {
    return people.find((person) => (person.phones || []).some((value) => phonesMatch(value, item.contactValue))) || null;
  }
  if (item.contactType === 'EMAIL') {
    const target = String(item.contactValue || '').trim().toLowerCase();
    return people.find((person) => (person.emails || []).some((value) => String(value || '').trim().toLowerCase() === target)) || null;
  }
  if (item.contactType === 'TELEGRAM') {
    const target = String(item.contactValue || '').trim();
    return people.find((person) => (person.telegrams || []).some((value) => String(value || '').trim() === target)) || null;
  }
  return null;
}

function consentSubjectLabel(item, people) {
  const person = consentPerson(item, people);
  if (person) return [person.name, person.surname].filter(Boolean).join(' ') || person.phones?.[0] || 'Человек';
  if (item.subjectType === 'CONTACT_POINT') return item.contactValue || 'Contact Point';
  return 'Человек';
}

function signedDocumentSnapshot(item) {
  const historical = getDocumentHistory().find((entry) => entry.documentId === item.documentId
    && Number(entry.documentVersion || 0) === Number(item.documentVersion || 0)
    && entry.snapshot);
  if (historical?.snapshot) return historical.snapshot;
  return getDocuments().find((document) => document.id === item.documentId) || null;
}

function openSignedDocument(item) {
  const snapshot = signedDocumentSnapshot(item);
  if (!snapshot) return;
  const html = `
    <div class="modal-title">
      <h2>${escapeHtml(snapshot.title || item.documentId)}</h2>
      <p>Версия ${escapeHtml(item.documentVersion || snapshot.version || 1)} · ${escapeHtml(consentStateText(item.status))}</p>
    </div>
    <div style="white-space:pre-wrap;line-height:1.55;padding:14px 0">${escapeHtml(snapshot.text || '')}</div>`;
  mountModal(document.body, modal(html, { title: snapshot.title || 'Документ', variant: 'large', surface: 'app' }));
}

function signatureHistoryMarkup() {
  const people = getAllPeople();
  const items = [...getConsents()].sort((a, b) => Date.parse(b.eventAt || b.createdAt || 0) - Date.parse(a.eventAt || a.createdAt || 0));
  return list({
    items: items.map((item) => {
      const snapshot = signedDocumentSnapshot(item);
      const subject = consentSubjectLabel(item, people);
      return {
        title: snapshot?.title || item.documentId,
        secondary: [`${subject} · ${consentStateText(item.status)}`, `Версия ${item.documentVersion} · ${formatMoment(item.eventAt || item.acceptedAt || item.revokedAt || item.createdAt)}`],
        interactive: Boolean(snapshot),
        data: snapshot ? `data-signed-document-event="${escapeHtml(item.id)}"` : '',
        aria: snapshot ? `Открыть подписанный документ версии ${item.documentVersion}` : '',
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
  root.querySelectorAll('[data-rkn-guide-id]').forEach((row) => row.addEventListener('click', () => {
    const item = getDocuments().find((document) => document.id === row.dataset.rknGuideId);
    if (item) openRknGuide(item);
  }));
  root.querySelectorAll('[data-signed-document-event]').forEach((row) => row.addEventListener('click', () => {
    const item = getConsents().find((event) => event.id === row.dataset.signedDocumentEvent);
    if (item) openSignedDocument(item);
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
    : currentSection === 'guides'
      ? guidesMarkup()
      : currentSection === 'history'
        ? historyMarkup()
        : rootMarkup();
  bind(root, navigateBack);
}
