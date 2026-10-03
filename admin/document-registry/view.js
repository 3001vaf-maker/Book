import { documentTile, documentTiles, openDocumentViewer } from '../../ui/documents/index.js';
import {
  getRegistryBookUserDocuments,
  getRegistryUserHelperTemplates,
  getRegistryUserLegalTemplates,
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

function actionState(value) {
  const action = String(value || '').toUpperCase();
  if (action === 'REVOKED') return 'revoked';
  if (action === 'DECLINED') return 'pending';
  return 'signed';
}

function registryTiles(items, escapeHtml, group) {
  return documentTiles(items.map((item) => documentTile({
    title: item.title || 'Документ',
    version: item.version || '',
    meta: item.type || '',
    data: `data-registry-document="${escapeHtml(item.key)}" data-registry-document-group="${escapeHtml(group)}"`,
    aria: `Открыть ${item.title || 'документ'}`,
  })), { layout: 'rail', className: 'admin-document-rail' });
}

function openDocument(item) {
  if (!item) return null;
  return openDocumentViewer({
    title: item.title || item.documentTitle || 'Документ',
    version: item.version || item.documentVersion || '',
    content: item.content || item.documentContent || '',
  });
}

function registryMarkup(escapeHtml) {
  const platformDocuments = getRegistryBookUserDocuments();
  const legalTemplates = getRegistryUserLegalTemplates();
  const helperTemplates = getRegistryUserHelperTemplates();
  return `
    <section class="admin-card admin-documents-card">
      <div class="admin-documents-head"><div><h3>Платформа ↔ пользователь</h3><p>Корневые документы платформы для отношений с пользователем.</p></div><span class="admin-count">${platformDocuments.length}</span></div>
      ${registryTiles(platformDocuments, escapeHtml, 'Платформа ↔ пользователь')}
    </section>
    <section class="admin-card admin-documents-card">
      <div class="admin-documents-head"><div><h3>Шаблоны основных документов пользователя</h3><p>Три источника, из которых формируются основные текущие документы профиля.</p></div><span class="admin-count">${legalTemplates.length}</span></div>
      ${registryTiles(legalTemplates, escapeHtml, 'Шаблон основного документа')}
    </section>
    <section class="admin-card admin-documents-card">
      <div class="admin-documents-head"><div><h3>Шаблоны помощников</h3><p>Источники вспомогательных файлов. Они не являются согласиями и не имеют истории подписаний.</p></div><span class="admin-count">${helperTemplates.length}</span></div>
      ${registryTiles(helperTemplates, escapeHtml, 'Шаблон помощника')}
    </section>`;
}

function historyMarkup() {
  const history = getDocumentRegistryHistory();
  if (!history.length) {
    return `<section class="admin-card admin-documents-card"><div class="admin-documents-head"><div><h3>История платформы ↔ пользователь</h3><p>Здесь отображаются сохранённые события принятия документов платформы пользователями.</p></div></div><div class="admin-history-empty">В Реестре пока нет событий.</div></section>`;
  }
  return `<section class="admin-card admin-documents-card">
    <div class="admin-documents-head"><div><h3>История платформы ↔ пользователь</h3><p>История читается из сохранённых событий PlatformConsentEvent.</p></div><span class="admin-count">${history.length}</span></div>
    ${documentTiles(history.map((item) => documentTile({
      title: item.documentTitle || item.documentKey || 'Документ',
      version: item.documentVersion || '',
      meta: formatMoment(item.occurredAt),
      status: actionLabel(item.action),
      statusState: actionState(item.action),
      data: `data-registry-history="${String(item.id || '')}"`,
      aria: `Открыть сохранённую версию ${item.documentTitle || item.documentKey || 'документа'}`,
    })), { layout: 'rail', className: 'admin-document-rail' })}
  </section>`;
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
      <div class="admin-heading"><div><h2>Реестр документов</h2><p>Документы платформы, шаблоны основных документов, шаблоны помощников и история подписаний.</p></div></div>
      <div class="admin-documents-tabs" role="tablist" aria-label="Реестр документов">
        <button type="button" class="${activeView === 'registry' ? 'is-active' : ''}" data-registry-view="registry">Реестр</button>
        <button type="button" class="${activeView === 'history' ? 'is-active' : ''}" data-registry-view="history">История</button>
      </div>
      ${activeView === 'registry' ? registryMarkup(escapeHtml) : historyMarkup()}`;

    root.querySelectorAll('[data-registry-view]').forEach((button) => {
      button.addEventListener('click', () => {
        activeView = button.dataset.registryView || 'registry';
        render();
      });
    });
    root.querySelectorAll('[data-registry-document]').forEach((control) => {
      control.addEventListener('click', () => openDocument(getRegistryDocument(control.dataset.registryDocument)));
    });
    root.querySelectorAll('[data-registry-history]').forEach((control) => {
      control.addEventListener('click', () => {
        const item = getDocumentRegistryHistory().find((event) => event.id === control.dataset.registryHistory);
        if (item) openDocument(item);
      });
    });
  };
  render();
}
