import {
  getAdminDocument,
  getBookUserDocuments,
  getUserDocumentBases,
} from './catalog.js';
import { getCompanyDocumentHistory } from './history.js';

let activeView = 'documents';

function documentRows(items, escapeHtml, group) {
  return items.map((item) => `
    <button type="button" class="admin-document-row" data-admin-document="${escapeHtml(item.key)}" data-admin-document-group="${escapeHtml(group)}">
      <span>
        <strong>${escapeHtml(item.title)}</strong>
        <small>${escapeHtml(item.type || '')}</small>
      </span>
      <span class="admin-document-open">Открыть</span>
    </button>
  `).join('');
}

function openDocument(item, group, escapeHtml) {
  if (!item) return;
  const backdrop = document.createElement('div');
  backdrop.className = 'admin-drawer-backdrop';
  backdrop.innerHTML = `
    <aside class="admin-drawer admin-document-drawer">
      <div class="admin-drawer-head">
        <div>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(group)}</p>
        </div>
        <button class="admin-close" type="button" data-close aria-label="Закрыть">×</button>
      </div>
      <div class="admin-document-content">${escapeHtml(item.content || '')}</div>
    </aside>
  `;
  backdrop.querySelector('[data-close]')?.addEventListener('click', () => backdrop.remove());
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) backdrop.remove();
  });
  document.body.append(backdrop);
}

function documentsMarkup(escapeHtml) {
  const bookDocuments = getBookUserDocuments();
  const userBases = getUserDocumentBases();
  return `
    <section class="admin-card admin-documents-card">
      <div class="admin-documents-head">
        <div>
          <h3>Book ↔ пользователь</h3>
          <p>Корневые документы компании Book для отношений с пользователем.</p>
        </div>
        <span class="admin-count">${bookDocuments.length}</span>
      </div>
      <div class="admin-document-list">
        ${documentRows(bookDocuments, escapeHtml, 'Book ↔ пользователь')}
      </div>
    </section>

    <section class="admin-card admin-documents-card">
      <div class="admin-documents-head">
        <div>
          <h3>Основы документов пользователя</h3>
          <p>Шаблоны Book, из которых позже формируются собственные документы пользователя с его данными.</p>
        </div>
        <span class="admin-count">${userBases.length}</span>
      </div>
      <div class="admin-document-list">
        ${documentRows(userBases, escapeHtml, 'Основа документа пользователя')}
      </div>
    </section>
  `;
}

function historyMarkup(escapeHtml) {
  const history = getCompanyDocumentHistory();
  if (!history.length) {
    return `
      <section class="admin-card admin-documents-card">
        <div class="admin-documents-head">
          <div>
            <h3>История Book</h3>
            <p>Здесь будет храниться только история действий компании Book с корневыми документами и шаблонами. История пользователя с его клиентами сюда не попадает.</p>
          </div>
        </div>
        <div class="admin-history-empty">История пока пуста.</div>
      </section>
    `;
  }

  return `
    <section class="admin-card admin-documents-card">
      <div class="admin-documents-head"><div><h3>История Book</h3></div></div>
      <div class="admin-document-list">
        ${history.map((item) => `
          <div class="admin-history-row">
            <strong>${escapeHtml(item.documentTitle || item.documentKey || 'Документ')}</strong>
            <span>${escapeHtml(item.action || item.status || '')}</span>
            <span>${escapeHtml(item.createdAt || '')}</span>
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

export function renderAdminDocuments(root, { escapeHtml, setTitle }) {
  if (!root) return;
  setTitle?.('Документы');

  const render = () => {
    root.innerHTML = `
      <div class="admin-heading">
        <div>
          <h2>Документы</h2>
          <p>Корень документов Book. Внутренняя история документов конкретного пользователя остаётся внутри его Book.</p>
        </div>
      </div>
      <div class="admin-documents-tabs" role="tablist" aria-label="Раздел документов">
        <button type="button" class="${activeView === 'documents' ? 'is-active' : ''}" data-documents-view="documents">Документы</button>
        <button type="button" class="${activeView === 'history' ? 'is-active' : ''}" data-documents-view="history">История</button>
      </div>
      ${activeView === 'documents' ? documentsMarkup(escapeHtml) : historyMarkup(escapeHtml)}
    `;

    root.querySelectorAll('[data-documents-view]').forEach((button) => {
      button.addEventListener('click', () => {
        activeView = button.dataset.documentsView || 'documents';
        render();
      });
    });

    root.querySelectorAll('[data-admin-document]').forEach((button) => {
      button.addEventListener('click', () => {
        const item = getAdminDocument(button.dataset.adminDocument);
        openDocument(item, button.dataset.adminDocumentGroup || '', escapeHtml);
      });
    });
  };

  render();
}
