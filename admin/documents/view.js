let activeView = 'documents';
let documents = [];
let history = [];

function formatMoment(value) {
  const date = new Date(value || '');
  return Number.isFinite(date.getTime()) ? date.toLocaleString('ru-RU') : String(value || '');
}

function documentRows(items, escapeHtml, group) {
  return items.map((item) => `
    <button type="button" class="admin-document-row" data-admin-document="${escapeHtml(item.key)}" data-admin-document-group="${escapeHtml(group)}">
      <span>
        <strong>${escapeHtml(item.title)}</strong>
        <small>Версия ${escapeHtml(item.version || 1)}</small>
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
          <p>${escapeHtml(group)} · версия ${escapeHtml(item.version || 1)}</p>
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
  const bookDocuments = documents.filter((item) => item.type !== 'USER_DOCUMENT_BASE');
  const userBases = documents.filter((item) => item.type === 'USER_DOCUMENT_BASE');
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
          <p>Единые шаблоны Book, из которых формируются документы каждого отдельного Book.</p>
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
  if (!history.length) {
    return `
      <section class="admin-card admin-documents-card">
        <div class="admin-documents-head">
          <div>
            <h3>История Book</h3>
            <p>История компании Book по документам Book ↔ пользователь. История клиентов конкретного Book сюда не попадает.</p>
          </div>
        </div>
        <div class="admin-history-empty">В базе пока нет событий Book ↔ пользователь.</div>
      </section>
    `;
  }

  return `
    <section class="admin-card admin-documents-card">
      <div class="admin-documents-head">
        <div>
          <h3>История Book</h3>
          <p>События подписания и согласий пользователей с документами компании Book.</p>
        </div>
        <span class="admin-count">${history.length}</span>
      </div>
      <div class="admin-document-list">
        ${history.map((item) => `
          <div class="admin-history-row">
            <div>
              <strong>${escapeHtml(item.documentTitle || item.documentKey || 'Документ')}</strong>
              <small>${escapeHtml(item.userEmail || '')} · версия ${escapeHtml(item.documentVersion || 1)}</small>
            </div>
            <span>${escapeHtml(item.action || '')}</span>
            <span>${escapeHtml(formatMoment(item.occurredAt))}</span>
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

export async function renderAdminDocuments(root, { escapeHtml, setTitle, loadDocuments, loadHistory }) {
  if (!root) return;
  setTitle?.('Документы');
  root.innerHTML = '<div class="admin-card admin-history-empty">Загружаем документы…</div>';

  try {
    const [documentRowsValue, historyRowsValue] = await Promise.all([
      loadDocuments?.() || [],
      loadHistory?.() || [],
    ]);
    documents = Array.isArray(documentRowsValue) ? documentRowsValue : [];
    history = Array.isArray(historyRowsValue) ? historyRowsValue : [];
  } catch (error) {
    root.innerHTML = `<div class="admin-card admin-history-empty">Не удалось загрузить документы: ${escapeHtml(error instanceof Error ? error.message : 'Ошибка')}</div>`;
    return;
  }

  const render = () => {
    root.innerHTML = `
      <div class="admin-heading">
        <div>
          <h2>Документы</h2>
          <p>Корень документов Book. Каждый подключённый Book хранит свои сформированные документы и свою историю отдельно по tenant.</p>
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
        const item = documents.find((document) => document.key === button.dataset.adminDocument);
        openDocument(item, button.dataset.adminDocumentGroup || '', escapeHtml);
      });
    });
  };

  render();
}
