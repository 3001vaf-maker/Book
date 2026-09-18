import { apiRequest, clearAuthToken, getCurrentUser, login } from '../core/auth.js';
import { BOOK_APP_ORIGIN } from '../core/environment.js';

const app = document.querySelector('#admin-app');

const state = {
  account: null,
  access: null,
  documents: [],
  history: [],
  section: 'overview',
};

const ACTIVE_DOCUMENTS = [
  {
    key: 'privacy-policy',
    group: 'user',
    type: 'PRIVACY_POLICY',
    title: 'Политика обработки персональных данных',
  },
  {
    key: 'user-pd-consent',
    group: 'user',
    type: 'PERSONAL_DATA_CONSENT',
    title: 'Согласие на обработку персональных данных',
  },
  {
    key: 'marketing-consent',
    group: 'user',
    type: 'MARKETING_CONSENT',
    title: 'Согласие на рекламные и маркетинговые сообщения',
  },
  {
    key: 'saas-agreement',
    group: 'platform',
    type: 'SAAS_AGREEMENT',
    title: 'SaaS-соглашение',
  },
  {
    key: 'public-profile-consent',
    group: 'platform',
    type: 'PUBLIC_PROFILE_CONSENT',
    title: 'Согласие на публичный профиль',
  },
  {
    key: 'dpa',
    group: 'platform',
    type: 'DPA',
    title: 'Поручение на обработку персональных данных',
  },
];

const WORKSPACE_DOCUMENT_TEMPLATES = [
  {
    key: 'user-document-pdn-policy',
    type: 'WORKSPACE_PERSONAL_DATA_POLICY',
    title: 'Шаблон политики обработки персональных данных',
  },
  {
    key: 'user-document-pdn-consent',
    type: 'WORKSPACE_PERSONAL_DATA_CONSENT',
    title: 'Шаблон согласия на обработку персональных данных',
  },
  {
    key: 'user-document-messages-consent',
    type: 'WORKSPACE_MESSAGES_CONSENT',
    title: 'Шаблон согласия на сообщения',
  },
];

const ACTIVE_DOCUMENT_KEYS = new Set(ACTIVE_DOCUMENTS.map((item) => item.key));
const WORKSPACE_TEMPLATE_KEYS = new Set(WORKSPACE_DOCUMENT_TEMPLATES.map((item) => item.key));

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  })[char]);
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('ru-RU');
}

async function jsonRequest(path, options = {}, fallback = 'Ошибка запроса') {
  const response = await apiRequest(path, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || fallback);
  return payload;
}

async function loadData() {
  const [account, access, documents, history] = await Promise.all([
    getCurrentUser(),
    jsonRequest('/saas-access/me', {}, 'Не удалось получить доступ рабочего пространства'),
    jsonRequest('/platform-documents', {}, 'Не удалось загрузить документы'),
    jsonRequest('/platform-documents/history', {}, 'Не удалось загрузить историю документов'),
  ]);
  state.account = account;
  state.access = access;
  state.documents = Array.isArray(documents) ? documents : [];
  state.history = Array.isArray(history) ? history : [];
}

function renderLogin(message = '') {
  app.innerHTML = `
    <main class="admin-login">
      <section class="admin-login-card">
        <h1>Platform Owner</h1>
        <p>Вход владельца платформы</p>
        <form class="admin-form" data-login-form>
          <label class="admin-field"><span>Email</span><input name="email" type="email" autocomplete="username" required></label>
          <label class="admin-field"><span>Пароль</span><input name="password" type="password" autocomplete="current-password" required></label>
          <p class="admin-error" data-login-error>${escapeHtml(message)}</p>
          <button class="admin-button" type="submit">Войти</button>
        </form>
      </section>
    </main>`;

  const form = app.querySelector('[data-login-form]');
  const error = app.querySelector('[data-login-error]');
  const submit = form?.querySelector('button[type="submit"]');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    error.textContent = '';
    submit.disabled = true;
    const data = new FormData(form);
    try {
      await login(data.get('email'), data.get('password'), true);
      await openOwnerConsole();
    } catch (loginError) {
      error.textContent = loginError instanceof Error ? loginError.message : 'Не удалось войти';
      submit.disabled = false;
    }
  });
}

function navButton(section, label) {
  return `<button data-section="${section}" class="${state.section === section ? 'is-active' : ''}">${label}</button>`;
}

function renderShell() {
  app.innerHTML = `
    <div class="admin-shell">
      <aside class="admin-sidebar">
        <div class="admin-brand">Platform <span>Owner</span></div>
        <nav class="admin-nav">
          ${navButton('overview', 'Обзор')}
          ${navButton('documents', 'Документы')}
          ${navButton('workspace', 'Мой Workspace')}
          ${navButton('users', 'Пользователи')}
          ${navButton('capabilities', 'Возможности')}
        </nav>
        <div class="admin-sidebar-foot">SaaS architecture</div>
      </aside>
      <header class="admin-toolbar">
        <h1 data-toolbar-title></h1>
        <div class="admin-toolbar-user">
          <span>${escapeHtml(state.account?.user?.email || '')}</span>
          <button class="admin-button secondary" data-logout>Выйти</button>
        </div>
      </header>
      <main class="admin-main"><div class="admin-content" data-content></div></main>
    </div>`;

  app.querySelectorAll('[data-section]').forEach((button) => {
    button.addEventListener('click', () => {
      state.section = button.dataset.section;
      renderShell();
      renderSection();
    });
  });
  app.querySelector('[data-logout]')?.addEventListener('click', () => {
    clearAuthToken();
    state.account = null;
    renderLogin();
  });
}

function setTitle(title) {
  const node = app.querySelector('[data-toolbar-title]');
  if (node) node.textContent = title;
}

function contentNode() {
  return app.querySelector('[data-content]');
}

function renderOverview() {
  setTitle('Обзор');
  const content = contentNode();
  const profileDocument = state.documents.find((item) => item.key === 'user-pd-consent' && item.currentVersion);
  content.innerHTML = `
    <div class="admin-heading"><div><h2>Обзор</h2><p>Архитектурный контур владельца платформы.</p></div></div>
    <div class="admin-stats">
      <div class="admin-stat"><strong>1</strong><span>активный User</span></div>
      <div class="admin-stat"><strong>${profileDocument ? '✓' : '—'}</strong><span>документ создания Profile</span></div>
      <div class="admin-stat"><strong>${state.access?.status || '—'}</strong><span>Workspace</span></div>
    </div>`;
}

function documentDefinitionRows(definitions, badgeKey = '') {
  return definitions.map((definition) => {
    const item = state.documents.find((document) => document.key === definition.key);
    const version = item?.currentVersion || null;
    return `
      <div class="admin-document-row">
        <div>
          <strong>${escapeHtml(definition.title)}</strong>
          <small>${escapeHtml(definition.key)} · ${version ? `версия ${Number(version.version || 1)} · ${formatDate(version.publishedAt)}` : 'не настроен'}</small>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          ${definition.key === badgeKey ? '<span class="admin-pill active">создание Profile</span>' : ''}
          <button class="admin-button secondary"
                  data-defined-document="${escapeHtml(definition.key)}">
            ${version ? 'Открыть' : 'Создать'}
          </button>
        </div>
      </div>`;
  }).join('');
}

function otherPlatformDocumentRows() {
  const items = state.documents.filter((item) => (
    !ACTIVE_DOCUMENT_KEYS.has(item.key)
    && !WORKSPACE_TEMPLATE_KEYS.has(item.key)
  ));
  if (!items.length) return '<div class="admin-empty">Других документов платформы пока нет.</div>';
  return items.map((item) => {
    const version = item.currentVersion;
    return `
      <div class="admin-document-row">
        <div>
          <strong>${escapeHtml(item.title)}</strong>
          <small>${escapeHtml(item.key)} · версия ${Number(version?.version || 0)} · ${formatDate(version?.publishedAt)}</small>
        </div>
        <button class="admin-button secondary" data-edit-document="${escapeHtml(item.key)}">Открыть</button>
      </div>`;
  }).join('');
}

function historyRows() {
  if (!state.history.length) return '<div class="admin-empty">История версий пока пуста.</div>';
  return state.history.map((item) => `
    <div class="admin-history-row">
      <span>${formatDate(item.publishedAt)}</span>
      <strong>${escapeHtml(item.title)}</strong>
      <span>v${Number(item.version || 1)}</span>
      <span class="admin-pill ${item.supersededAt ? '' : 'active'}">${item.supersededAt ? 'архив' : 'действует'}</span>
    </div>
  `).join('');
}

function renderDocumentEditor(selected = null) {
  const content = contentNode();
  const current = selected?.currentVersion || null;
  const isProfileDocument = selected?.key === 'user-pd-consent';
  const form = document.createElement('section');
  form.className = 'admin-card admin-document-editor';
  form.innerHTML = `
    <div class="admin-document-editor-head">
      <div>
        <h3>${selected ? 'Новая версия документа' : 'Новый документ'}</h3>
        <p>${selected ? 'Предыдущая версия останется в истории.' : 'Документ платформы.'}</p>
      </div>
      <button class="admin-close" type="button" data-close-editor>×</button>
    </div>
    <form class="admin-form" data-document-form>
      <label class="admin-field"><span>Key</span><input name="key" value="${escapeHtml(selected?.key || '')}" ${selected ? 'readonly' : ''} required></label>
      <label class="admin-field"><span>Тип</span><input name="type" value="${escapeHtml(selected?.type || (isProfileDocument ? 'PERSONAL_DATA_CONSENT' : 'DOCUMENT'))}" required></label>
      <label class="admin-field"><span>Название</span><input name="title" value="${escapeHtml(selected?.title || '')}" required></label>
      <label class="admin-field"><span>Текст документа</span><textarea name="content" rows="20" required>${escapeHtml(current?.contentSnapshot || '')}</textarea></label>
      <p class="admin-inline-message" data-document-message></p>
      <div class="admin-actions">
        <button class="admin-button secondary" type="button" data-close-editor>Отмена</button>
        <button class="admin-button" type="submit">Сохранить версию</button>
      </div>
    </form>`;
  content.prepend(form);

  form.querySelectorAll('[data-close-editor]').forEach((button) => button.addEventListener('click', () => form.remove()));
  form.querySelector('[data-document-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const message = form.querySelector('[data-document-message]');
    const submit = event.currentTarget.querySelector('button[type="submit"]');
    submit.disabled = true;
    message.textContent = '';
    try {
      await jsonRequest('/platform-documents', {
        method: 'POST',
        body: JSON.stringify({
          key: String(data.get('key') || '').trim(),
          type: String(data.get('type') || '').trim(),
          title: String(data.get('title') || '').trim(),
          content: String(data.get('content') || ''),
          operatorIdentity: {
            userId: state.account?.user?.id || '',
            email: state.account?.user?.email || '',
          },
        }),
      }, 'Не удалось сохранить документ');
      await loadData();
      renderShell();
      renderDocuments();
    } catch (error) {
      message.textContent = error instanceof Error ? error.message : 'Не удалось сохранить документ';
      message.classList.add('error');
      submit.disabled = false;
    }
  });
}

function renderDocuments() {
  setTitle('Документы');
  const content = contentNode();
  const userDocuments = ACTIVE_DOCUMENTS.filter((item) => item.group === 'user');
  const platformDocuments = ACTIVE_DOCUMENTS.filter((item) => item.group === 'platform');

  content.innerHTML = `
    <div class="admin-heading">
      <div>
        <h2>Документы</h2>
        <p>Единый центр системных документов платформы.</p>
      </div>
    </div>

    <section class="admin-card admin-documents-card">
      <div class="admin-section-head">
        <div>
          <h3>Действующие документы — 6</h3>
          <p>Документы сохраняются как самостоятельные сущности и не объединяются с шаблонами.</p>
        </div>
      </div>

      <div class="admin-section-head">
        <div><h3>Для пользователей</h3></div>
      </div>
      <div class="admin-document-list">
        ${documentDefinitionRows(userDocuments, 'user-pd-consent')}
      </div>

      <div class="admin-section-head">
        <div><h3>Для SaaS / платформы</h3></div>
      </div>
      <div class="admin-document-list">
        ${documentDefinitionRows(platformDocuments)}
      </div>
    </section>

    <section class="admin-card admin-documents-card">
      <div class="admin-section-head">
        <div>
          <h3>Шаблоны рабочих документов</h3>
          <p>Базовые документы, из которых формируются документы внутри рабочего пространства.</p>
        </div>
      </div>
      <div class="admin-document-list">
        ${documentDefinitionRows(WORKSPACE_DOCUMENT_TEMPLATES)}
      </div>
    </section>

    <section class="admin-card admin-documents-card">
      <div class="admin-section-head">
        <div>
          <h3>Другие документы платформы</h3>
          <p>Резерв для будущей архитектуры SaaS.</p>
        </div>
        <button class="admin-button secondary" data-add-document>Добавить документ</button>
      </div>
      <div class="admin-document-list">${otherPlatformDocumentRows()}</div>
    </section>

    <section class="admin-card admin-history-card">
      <div class="admin-section-head">
        <div>
          <h3>История</h3>
          <p>Все опубликованные версии документов. Старые версии не перезаписываются.</p>
        </div>
      </div>
      <div class="admin-history-list">${historyRows()}</div>
    </section>`;

  content.querySelector('[data-add-document]')?.addEventListener('click', () => renderDocumentEditor());

  content.querySelectorAll('[data-defined-document]').forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.dataset.definedDocument;
      const definition = [...ACTIVE_DOCUMENTS, ...WORKSPACE_DOCUMENT_TEMPLATES]
        .find((item) => item.key === key);
      if (!definition) return;
      const existing = state.documents.find((item) => item.key === definition.key);
      renderDocumentEditor(existing || {
        key: definition.key,
        type: definition.type,
        title: definition.title,
        currentVersion: null,
      });
    });
  });

  content.querySelectorAll('[data-edit-document]').forEach((button) => {
    button.addEventListener('click', () => {
      const selected = state.documents.find((item) => item.key === button.dataset.editDocument);
      if (selected) renderDocumentEditor(selected);
    });
  });
}

function renderWorkspace() {
  setTitle('Мой Workspace');
  const content = contentNode();
  content.innerHTML = `
    <div class="admin-heading"><div><h2>Мой Workspace</h2><p>Текущий рабочий контур владельца.</p></div></div>
    <section class="admin-card" style="padding:20px">
      <strong>${escapeHtml(state.account?.tenant?.name || 'Workspace')}</strong>
      <p style="color:#817a74">${escapeHtml(state.account?.user?.email || '')}</p>
      <a class="admin-button" href="${escapeHtml(BOOK_APP_ORIGIN)}">Открыть Workspace</a>
    </section>`;
}

function renderUsers() {
  setTitle('Пользователи');
  const content = contentNode();
  content.innerHTML = `
    <div class="admin-heading"><div><h2>Пользователи</h2><p>Архитектурный раздел сохранён.</p></div></div>
    <section class="admin-card" style="padding:20px">
      <strong>Активен только текущий владелец.</strong>
      <p style="color:#817a74">Создание и приглашение дополнительных пользователей временно не подключено, пока полностью не проверен основной Profile.</p>
    </section>`;
}

function renderCapabilities() {
  setTitle('Возможности');
  const content = contentNode();
  const capabilities = Array.isArray(state.access?.capabilities) ? state.access.capabilities : [];
  content.innerHTML = `
    <div class="admin-heading"><div><h2>Возможности</h2><p>Архитектурный раздел сохранён. Для owner-workspace доступ не ограничивается тарифом.</p></div></div>
    <section class="admin-card"><div class="admin-document-list">
      ${capabilities.map((item) => `
        <div class="admin-document-row">
          <div><strong>${escapeHtml(item.name || item.key)}</strong><small>${escapeHtml(item.key)}</small></div>
          <span class="admin-pill ${item.enabled === false ? '' : 'active'}">${item.valueType === 'LIMIT' ? (item.limit ?? '∞') : (item.enabled ? 'ON' : 'OFF')}</span>
        </div>`).join('') || '<div class="admin-empty">Каталог возможностей пуст.</div>'}
    </div></section>`;
}

function renderSection() {
  if (state.section === 'documents') return renderDocuments();
  if (state.section === 'workspace') return renderWorkspace();
  if (state.section === 'users') return renderUsers();
  if (state.section === 'capabilities') return renderCapabilities();
  return renderOverview();
}

async function openOwnerConsole() {
  try {
    await loadData();
    renderShell();
    renderSection();
  } catch (error) {
    renderLogin(error instanceof Error ? error.message : 'Не удалось открыть панель владельца');
  }
}

try {
  const current = await getCurrentUser();
  if (!current) renderLogin();
  else await openOwnerConsole();
} catch {
  renderLogin('Сервер временно недоступен');
}
