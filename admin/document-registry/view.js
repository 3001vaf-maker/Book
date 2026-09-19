import {
  getRegistryBookUserDocuments,
  getRegistryUserDocumentBases,
  getRegistryDocument,
} from './catalog.js';
import {
  getDocumentRegistryHistory,
  hydrateDocumentRegistryHistory,
} from './history.js';

let activeView = 'registry';

function formatMoment(value) {
  const date = new Date(value || '');
  return Number.isFinite(date.getTime()) ? date.toLocaleString('ru-RU') : String(value || '');
}

function actionLabel(value) {
  const action = String(value || '').toUpperCase();
  if (action === 'ACCEPTED') return 'Принято';
  if (action === 'ACKNOWLEDGED') return 'Ознакомлен';
  if (action === 'CONSENTED') return 'Согласие дано';
  if (action === 'REVOKED') return 'Отозвано';
  if (action === 'DECLINED') return 'Отклонено';
  return action || 'Событие';
}

function documentRows(items, escapeHtml, group) {
  return items.map((item) => `
    <button type="button" class="admin-document-row" data-registry-document="${escapeHtml(item.key)}" data-registry-document-group="${escapeHtml(group)}">
      <span>
        <strong>${escapeHtml(item.title)}</strong>
        <small>${escapeHtml(item.type || '')}</small>
      </span>
      <span class="admin-document-open">Открыть</span>
    </button>
  `).join('');
}

function openDocument(item, group, escapeHtml, meta = '') {
  if (!item) return;
  const backdrop = document.createElement('div');
  backdrop.className = 'admin-drawer-backdrop';
  backdrop.innerHTML = `
    <aside class="admin-drawer admin-document-drawer">
      <div class="admin-drawer-head">
        <div>
          <h3>${escapeHtml(item.title || item.documentTitle || 'Документ')}</h3>
          <p>${escapeHtml([group, meta].filter(Boolean).join(' · '))}</p>
        </div>
        <button class="admin-close" type="button" data-close aria-label="Закрыть">×</button>
      </div>
      <div class="admin-document-content">${escapeHtml(item.content || item.documentContent || '')}</div>
    </aside>
  `;
  backdrop.querySelector('[data-close]')?.addEventListener('click', () => backdrop.remove());
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) backdrop.remove();
  });
  document.body.append(backdrop);
}

function registryMarkup(escapeHtml) {
  const bookDocuments = getRegistryBookUserDocuments();
  const userBases = getRegistryUserDocumentBases();
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
          <p>Единые основы Реестра документов, из которых формируются документы каждого отдельного Book.</p>
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
  const history = getDocumentRegistryHistory();
  if (!history.length) {
    return `
      <section class="admin-card admin-documents-card">
        <div class="admin-documents-head">
          <div>
            <h3>История Book ↔ пользователь</h3>
            <p>Здесь отображаются сохранённые события принятия документов Book пользователями. История клиентов конкретного Book сюда не попадает.</p>
          </div>
        </div>
        <div class="admin-history-empty">В Реестре пока нет событий.</div>
      </section>
    `;
  }

  return `
    <section class="admin-card admin-documents-card">
      <div class="admin-documents-head">
        <div>
          <h3>История Book ↔ пользователь</h3>
          <p>История читается из сохранённых событий PlatformConsentEvent.</p>
        </div>
        <span class="admin-count">${history.length}</span>
      </div>
      <div class="admin-document-list">
        ${history.map((item) => `
          <button type="button" class="admin-history-row" data-registry-history="${escapeHtml(item.id)}">
            <span>
              <strong>${escapeHtml(item.documentTitle || item.documentKey || 'Документ')}</strong>
              <small>${escapeHtml(item.accountEmail || item.tenantName || 'Пользователь')} · версия ${escapeHtml(item.documentVersion)}</small>
            </span>
            <span>${escapeHtml(actionLabel(item.action))}</span>
            <span>${escapeHtml(formatMoment(item.occurredAt))}</span>
          </button>
        `).join('')}
      </div>
    </section>
  `;
}

export async function renderDocumentRegistry(root, { escapeHtml, setTitle, loadHistory }) {
  if (!root) return;
  setTitle?.('Реестр документов');

  root.innerHTML = '<div class="admin-card admin-history-empty">Загружаем Реестр документов…</div>';
  try {
    const items = typeof loadHistory === 'function' ? await loadHistory() : [];
    hydrateDocumentRegistryHistory(items);
  } catch (error) {
    root.innerHTML = `<div class="admin-card admin-history-empty">Не удалось загрузить историю Реестра: ${escapeHtml(error instanceof Error ? error.message : 'Ошибка')}</div>`;
    return;
  }

  const render = () => {
    root.innerHTML = `
      <div class="admin-heading">
        <div>
          <h2>Реестр документов</h2>
          <p>Документы компании Book, основы документов пользователей и история Book ↔ пользователь.</p>
        </div>
      </div>
      <div class="admin-documents-tabs" role="tablist" aria-label="Реестр документов">
        <button type="button" class="${activeView === 'registry' ? 'is-active' : ''}" data-registry-view="registry">Реестр</button>
        <button type="button" class="${activeView === 'history' ? 'is-active' : ''}" data-registry-view="history">История</button>
      </div>
      ${activeView === 'registry' ? registryMarkup(escapeHtml) : historyMarkup(escapeHtml)}
    `;

    root.querySelectorAll('[data-registry-view]').forEach((button) => {
      button.addEventListener('click', () => {
        activeView = button.dataset.registryView || 'registry';
        render();
      });
    });

    root.querySelectorAll('[data-registry-document]').forEach((button) => {
      button.addEventListener('click', () => {
        const item = getRegistryDocument(button.dataset.registryDocument);
        openDocument(item, button.dataset.registryDocumentGroup || '', escapeHtml);
      });
    });

    root.querySelectorAll('[data-registry-history]').forEach((button) => {
      button.addEventListener('click', () => {
        const item = getDocumentRegistryHistory().find((event) => event.id === button.dataset.registryHistory);
        if (!item) return;
        openDocument(
          item,
          'Подписанная версия',
          escapeHtml,
          `${item.accountEmail || item.tenantName || 'Пользователь'} · версия ${item.documentVersion} · ${formatMoment(item.occurredAt)}`,
        );
      });
    });
  };

  render();
}
