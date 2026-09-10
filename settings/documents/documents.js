import { actionBlock, button, escapeHtml, field, iconButton, initViewNavigation, list, modal, mountModal, page, pageHeader, textareaField, viewNavigation } from '../../ui/ui.js';
import { getAllClients } from '../../main/clients/data.js';
import { createDocument, getDocuments, saveDocument } from './data.js';
import { getLatestClientConsent } from './consents.js';

const VIEWS = [
  { id: 'templates', label: 'Шаблоны' },
  { id: 'consents', label: 'Согласия' },
];

let currentView = 'templates';

function statusText(item) {
  if (!item.clientConsent) return 'Документ';
  return item.required ? 'Обязательное согласие' : 'Необязательное согласие';
}

function consentStateText(fact) {
  if (!fact) return 'Не дано';
  if (fact.status === 'revoked') return 'Отозвано';
  if (fact.status === 'declined') return 'Не дано';
  return 'Дано';
}

function formatMoment(value) {
  if (!value) return 'Дата не зафиксирована';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Дата не зафиксирована';
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

function openDocumentEditor(item, onSaved) {
  const html = `<form data-document-form>
    <div class="modal-title"><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(statusText(item))} · версия ${escapeHtml(item.version || 1)}</p></div>
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

function openClientConsentSummary(client) {
  const documents = getDocuments().filter((item) => item.clientConsent);
  const items = documents.map((document) => {
    const fact = getLatestClientConsent(client.key, document.id);
    return `<div class="entity-details"><div><span>${escapeHtml(document.title)}</span><strong>${escapeHtml(consentStateText(fact))}</strong></div><div><span>Версия</span><strong>${escapeHtml(fact?.documentVersion || document.version || 1)}</strong></div><div><span>Когда</span><strong>${escapeHtml(formatMoment(fact?.acceptedAt || fact?.revokedAt || ''))}</strong></div><div><span>Источник</span><strong>${escapeHtml(fact?.source || '—')}</strong></div></div>`;
  }).join('');
  mountModal(document.body, modal(`<div class="modal-title"><h2>${escapeHtml([client.name, client.surname].filter(Boolean).join(' '))}</h2><p>История согласий клиента</p></div>${items}`, { title: 'Согласия', variant: 'large', surface: 'app' }));
}

function templatesMarkup() {
  const documents = getDocuments();
  const rows = list({
    items: documents.map((item) => ({
      title: item.title,
      secondary: `${statusText(item)} · версия ${item.version || 1}`,
      interactive: true,
      data: `data-document-id="${escapeHtml(item.id)}"`,
      aria: `Открыть документ ${item.title}`
    }))
  });
  return `<div class="ui-list-toolbar"><div></div><div class="ui-list-toolbar__actions">${iconButton('+', { className: 'icon-button--primary', data: 'data-add-document', aria: 'Добавить документ' })}</div></div><section class="ui-page-section"><p class="muted">Для обработки персональных данных необходимо законное основание. Book даёт общий шаблон, но не гарантирует его соответствие именно вашей ситуации. Перед использованием рекомендуется обратиться к юристу.</p>${rows}</section>`;
}

function consentsMarkup() {
  const clients = getAllClients();
  const documents = getDocuments().filter((item) => item.clientConsent);
  if (!clients.length) return '<section class="ui-page-section"><p class="muted">Клиентов пока нет.</p></section>';
  const rows = list({
    items: clients.map((client) => {
      const states = documents.map((document) => `${document.required ? 'ПДн' : 'Рассылки'}: ${consentStateText(getLatestClientConsent(client.key, document.id))}`);
      const title = [client.name, client.surname].filter(Boolean).join(' ') || 'Клиент';
      return {
        title,
        secondary: states,
        interactive: true,
        data: `data-consent-client="${escapeHtml(client.key)}"`,
        aria: `Открыть согласия ${title}`,
      };
    })
  });
  return `<section class="ui-page-section"><p class="muted">Здесь собраны факты согласий по всем клиентам. Карточка клиента показывает эти же данные и не хранит отдельную копию.</p>${rows}</section>`;
}

function bindView(root, navigateBack) {
  initViewNavigation(root, {
    views: VIEWS,
    activeView: currentView,
    onChange: (view) => {
      currentView = view;
      render(root, navigateBack);
    },
  });
}

export function render(root, navigateBack = () => {}) {
  root.innerHTML = page([
    pageHeader('Документы', 'Шаблоны и факты согласий клиентов.'),
    viewNavigation({ views: VIEWS, activeView: currentView, ariaLabel: 'Документы' }),
    currentView === 'templates' ? templatesMarkup() : consentsMarkup(),
    actionBlock(button('Назад', { className: 'ui-button--secondary', data: 'data-documents-back' }))
  ]);

  bindView(root, navigateBack);
  root.querySelector('[data-documents-back]')?.addEventListener('click', navigateBack);
  root.querySelector('[data-add-document]')?.addEventListener('click', () => openCreateDocument(() => render(root, navigateBack)));
  root.querySelectorAll('[data-document-id]').forEach((row) => row.addEventListener('click', () => {
    const item = getDocuments().find((document) => document.id === row.dataset.documentId);
    if (item) openDocumentEditor(item, () => render(root, navigateBack));
  }));
  root.querySelectorAll('[data-consent-client]').forEach((row) => row.addEventListener('click', () => {
    const client = getAllClients().find((item) => item.key === row.dataset.consentClient);
    if (client) openClientConsentSummary(client);
  }));
}
