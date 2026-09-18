import { apiRequest, clearAuthToken, getCurrentUser, login } from '../core/auth.js';

const app = document.querySelector('#admin-app');
const state = {
  account: null,
  admin: null,
  masters: [],
  capabilities: [],
  platformLegal: null,
  documentHistory: [],
  section: 'overview',
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[char]));
}

async function adminRequest(path, options = {}) {
  const response = await apiRequest(`/saas-admin${path}`, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || 'Ошибка панели управления');
  return payload;
}

async function legalRequest(path, options = {}) {
  const response = await apiRequest(`/platform/legal${path}`, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || 'Ошибка юридического раздела');
  return payload;
}

const PRIMARY_DOCUMENT_KEYS = [
  'privacy-policy',
  'saas-agreement',
  'master-pd-consent',
  'marketing-consent',
  'public-profile-consent',
  'dpa',
];

const USER_DOCUMENT_BASE_KEYS = [
  'user-document-pdn-policy',
  'user-document-pdn-consent',
  'user-document-messages-consent',
];

function documentSortIndex(key) {
  const index = PRIMARY_DOCUMENT_KEYS.indexOf(key);
  return index === -1 ? PRIMARY_DOCUMENT_KEYS.length + 1 : index;
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('ru-RU');
}

function documentFileName(title, version) {
  const base = String(title || 'document')
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'document';
  return `${base}-v${version || 1}.html`;
}

function documentHtml(document) {
  const version = document?.currentVersion || {};
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>${escapeHtml(document?.title || 'Документ')}</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;color:#292522;max-width:860px;margin:40px auto;padding:0 28px;line-height:1.5}
h1{font-size:24px;margin:0 0 8px}
.meta{color:#817a74;margin-bottom:28px}
pre{white-space:pre-wrap;font:inherit;margin:0}
@media print{body{margin:0;max-width:none}}
</style>
</head>
<body>
<h1>${escapeHtml(document?.title || 'Документ')}</h1>
<div class="meta">Версия ${Number(version.version || 1)} · ${formatDate(version.publishedAt)}</div>
<pre>${escapeHtml(version.contentSnapshot || '')}</pre>
</body>
</html>`;
}

function renderLogin(message = '') {
  app.innerHTML = `
    <main class="admin-login">
      <section class="admin-login-card">
        <h1>Book Admin</h1>
        <p>Управление персональными Book мастеров</p>
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
  const button = form.querySelector('button[type="submit"]');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    error.textContent = '';
    button.disabled = true;
    const data = new FormData(form);
    try {
      state.account = await login(data.get('email'), data.get('password'));
      await loadAdmin();
    } catch (loginError) {
      error.textContent = loginError instanceof Error ? loginError.message : 'Не удалось войти';
      button.disabled = false;
    }
  });
}

async function loadAdmin() {
  state.admin = await adminRequest('/me');
  await refreshData();
  renderShell();
}

async function refreshData() {
  const [masters, capabilities, platformLegal, documentHistory] = await Promise.all([
    adminRequest('/masters'),
    adminRequest('/capabilities'),
    legalRequest('/readiness'),
    legalRequest('/document-history').catch(() => []),
  ]);
  state.masters = Array.isArray(masters) ? masters : [];
  state.capabilities = Array.isArray(capabilities) ? capabilities : [];
  state.platformLegal = platformLegal || null;
  state.documentHistory = Array.isArray(documentHistory) ? documentHistory : [];
}

function renderShell() {
  app.innerHTML = `
    <div class="admin-shell">
      <aside class="admin-sidebar">
        <div class="admin-brand">Book <span>Admin</span></div>
        <nav class="admin-nav">
          <button data-section="overview">Обзор</button>
          <button data-section="legal">Документы</button>
          <button data-section="owner" class="owner-link">Мой Book</button>
          <button data-section="masters">Мастера</button>
          <button data-section="capabilities">Возможности</button>
        </nav>
        <div class="admin-sidebar-foot">SaaS Control Plane</div>
      </aside>
      <header class="admin-toolbar">
        <h1 data-toolbar-title>Мастера</h1>
        <div class="admin-toolbar-user"><span>${escapeHtml(state.admin?.user?.email || '')}</span><button class="admin-button secondary" data-logout>Выйти</button></div>
      </header>
      <main class="admin-main"><div class="admin-content" data-content></div></main>
    </div>`;

  app.querySelectorAll('[data-section]').forEach((button) => {
    button.disabled = false;
    button.addEventListener('click', () => {
      state.section = button.dataset.section;
      renderCurrentSection();
    });
  });
  app.querySelector('[data-logout]').addEventListener('click', () => {
    clearAuthToken();
    state.account = null;
    state.admin = null;
    renderLogin();
  });
  renderCurrentSection();
}

function setActiveSection(title) {
  app.querySelector('[data-toolbar-title]').textContent = title;
  app.querySelectorAll('[data-section]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.section === state.section);
  });
}

function renderCurrentSection() {
  if (state.section === 'overview') return renderOverview();
  if (state.section === 'legal') return renderLegal();
  if (state.section === 'owner') return renderOwnerBook();
  if (state.section === 'capabilities') return renderCapabilities();
  return renderMasters();
}

function renderOverview() {
  setActiveSection('Обзор');
  const content = app.querySelector('[data-content]');
  const regular = state.masters.filter((item) => !item.isOwnerBook);
  const active = regular.filter((item) => item.status === 'ACTIVE' && item.master).length;
  const pending = regular.filter((item) => !item.master && item.invitation?.status === 'PENDING').length;
  content.innerHTML = `
    <div class="admin-heading"><div><h2>Обзор</h2><p>Состояние персональных Book</p></div></div>
    <div class="admin-stats">
      <div class="admin-stat"><strong>${regular.length}</strong><span>создано Book мастеров</span></div>
      <div class="admin-stat"><strong>${active}</strong><span>активных мастеров</span></div>
      <div class="admin-stat"><strong>${pending}</strong><span>ожидают принятия приглашения</span></div>
    </div>`;
}

function renderOwnerBook() {
  setActiveSection('Мой Book');
  const owner = state.masters.find((item) => item.isOwnerBook);
  const content = app.querySelector('[data-content]');
  if (!owner) {
    content.innerHTML = '<div class="admin-card" style="padding:20px">Мой Book пока не определён.</div>';
    return;
  }
  content.innerHTML = `
    <div class="admin-heading"><div><h2>Мой Book</h2><p>Ваш первый персональный Book остаётся отдельным от списка мастеров.</p></div></div>
    <div class="admin-card" style="padding:20px">
      <strong>${escapeHtml(owner.master?.name || owner.tenantName)}</strong>
      <p style="color:#817a74">${escapeHtml(owner.master?.email || '')}</p>
      <button class="admin-button" data-edit-owner>Настроить доступы</button>
    </div>`;
  content.querySelector('[data-edit-owner]').addEventListener('click', () => openAccessDrawer(owner.tenantId));
}

function renderMasters() {
  setActiveSection('Мастера');
  const content = app.querySelector('[data-content]');
  const masters = state.masters.filter((item) => !item.isOwnerBook);
  const legalReady = state.platformLegal?.state?.status === 'LEGAL_READY';
  content.innerHTML = `
    <div class="admin-heading"><div><h2>Мастера</h2><p>Каждый мастер работает только в своём персональном Book.</p></div></div>
    ${legalReady ? '' : '<div class="admin-card" style="padding:16px;margin-bottom:14px"><strong>Регистрация реальных мастеров закрыта.</strong><p style="margin:6px 0 0;color:#817a74">Сначала завершите раздел «Документы».</p></div>'}
    <section class="admin-invite-panel">
      <h3>Пригласить мастера</h3>
      <form class="admin-invite-grid" data-invite-form>

        <label class="admin-field"><span>Имя</span><input name="name" placeholder="Имя мастера"></label>
        <label class="admin-field"><span>Email</span><input name="email" type="email" placeholder="name@example.com" required></label>
        <button class="admin-button" type="submit" ${legalReady ? '' : 'disabled'}>Отправить приглашение</button>
      </form>
      <p class="admin-inline-message" data-invite-message></p>
    </section>
    <div class="admin-card">
      <table class="admin-table">
        <thead><tr><th>Мастер</th><th>Email</th><th>Состояние</th><th>Набор</th></tr></thead>
        <tbody>${masters.map(masterRow).join('') || '<tr><td colspan="4">Пока нет приглашённых мастеров.</td></tr>'}</tbody>
      </table>
    </div>`;

  const form = content.querySelector('[data-invite-form]');
  const message = content.querySelector('[data-invite-message]');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    message.textContent = '';
    message.classList.remove('error');
    const button = form.querySelector('button[type="submit"]');
    const data = new FormData(form);
    button.disabled = true;
    button.textContent = 'Отправляем…';
    try {
      await adminRequest('/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: data.get('name'), email: data.get('email') }),
      });
      form.reset();
      message.textContent = 'Приглашение отправлено по email.';
      await refreshData();
      window.setTimeout(renderMasters, 350);
    } catch (error) {
      message.textContent = error instanceof Error ? error.message : 'Не удалось отправить приглашение';
      message.classList.add('error');
    } finally {
      button.disabled = false;
      button.textContent = 'Отправить приглашение';
    }
  });

  content.querySelectorAll('[data-tenant]').forEach((row) => {
    row.addEventListener('click', () => openAccessDrawer(row.dataset.tenant));
  });
  content.querySelectorAll('[data-resend]').forEach((button) => {
    button.addEventListener('click', async (event) => {
      event.stopPropagation();
      button.disabled = true;
      try {
        await adminRequest(`/invitations/${encodeURIComponent(button.dataset.resend)}/resend`, { method: 'POST' });
        button.textContent = 'Отправлено';
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Не удалось отправить письмо');
        button.disabled = false;
      }
    });
  });
}

function masterRow(item) {
  const pending = !item.master && item.invitation?.status === 'PENDING';
  const name = item.master?.name || item.invitation?.name || item.tenantName;
  const email = item.master?.email || item.invitation?.email || '';
  const statusClass = item.status === 'SUSPENDED' ? 'suspended' : pending ? 'pending' : 'active';
  const statusLabel = item.status === 'SUSPENDED' ? 'Отключён' : pending ? 'Ждёт входа' : item.master ? 'Активен' : 'Создан';
  const resend = pending ? `<button class="admin-button secondary" data-resend="${escapeHtml(item.invitation.id)}">Повторить email</button>` : '';
  return `<tr data-tenant="${escapeHtml(item.tenantId)}"><td><strong>${escapeHtml(name)}</strong></td><td>${escapeHtml(email)}</td><td><span class="admin-pill ${statusClass}">${statusLabel}</span> ${resend}</td><td>${escapeHtml(item.plan?.name || 'Индивидуальный')}</td></tr>`;
}


function renderLegalDocumentEditor(content, selectedKey = '') {
  const readiness = state.platformLegal || {};
  const documents = Array.isArray(readiness.documents) ? readiness.documents : [];
  const selected = selectedKey ? documents.find((item) => item.key === selectedKey) : null;
  const current = selected?.currentVersion || null;
  const identitySource = current?.operatorIdentitySnapshot
    || documents.find((item) => item.currentVersion?.operatorIdentitySnapshot)?.currentVersion?.operatorIdentitySnapshot
    || {};
  const editor = content.querySelector('[data-legal-editor]');
  const isNew = !selected;
  editor.innerHTML = `
    <section class="admin-card admin-document-editor">
      <div class="admin-document-editor-head">
        <div>
          <h3>${isNew ? 'Новый документ' : `Новая версия: ${escapeHtml(selected.title)}`}</h3>
          <p>${isNew ? 'Дополнительный документ в вашей папке.' : 'Предыдущая версия останется в истории.'}</p>
        </div>
        <button class="admin-close" type="button" data-close-editor aria-label="Закрыть">×</button>
      </div>
      <form class="admin-form" data-platform-document-form>
        <label class="admin-field"><span>Название</span><input name="title" value="${escapeHtml(selected?.title || '')}" required></label>
        <label class="admin-field"><span>Текст документа</span><textarea name="content" rows="20" required>${escapeHtml(current?.contentSnapshot || '')}</textarea></label>
        <p class="admin-inline-message" data-platform-document-message></p>
        <div class="admin-actions">
          <button class="admin-button secondary" type="button" data-close-editor>Отмена</button>
          <button class="admin-button" type="submit">Сохранить версию</button>
        </div>
      </form>
    </section>`;

  editor.querySelectorAll('[data-close-editor]').forEach((button) => {
    button.addEventListener('click', () => { editor.innerHTML = ''; });
  });

  const form = editor.querySelector('[data-platform-document-form]');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = form.querySelector('[data-platform-document-message]');
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    message.textContent = '';
    try {
      const data = new FormData(form);
      const title = String(data.get('title') || '').trim();
      const key = selected?.key || `custom-${Date.now()}`;
      await legalRequest('/documents', {
        method: 'POST',
        body: JSON.stringify({
          key,
          type: selected?.type || 'CUSTOM',
          title,
          content: String(data.get('content') || ''),
          operatorIdentity: identitySource,
          requiredForRegistration: selected?.requiredForRegistration === true,
          requiredForLive: selected?.requiredForLive === true,
          requiredForPublicBooking: selected?.requiredForPublicBooking === true,
        }),
      });
      await refreshData();
      renderLegal();
    } catch (error) {
      message.textContent = error instanceof Error ? error.message : 'Не удалось сохранить документ';
      message.classList.add('error');
      button.disabled = false;
    }
  });
}

function openLegalDocument(item) {
  if (!item?.currentVersion) return;
  const version = item.currentVersion;
  const backdrop = document.createElement('div');
  backdrop.className = 'admin-drawer-backdrop';
  backdrop.innerHTML = `
    <aside class="admin-drawer admin-document-drawer">
      <div class="admin-drawer-head">
        <div>
          <h3>${escapeHtml(item.title)}</h3>
          <p>Версия ${Number(version.version || 1)} · ${formatDate(version.publishedAt)} · действует</p>
        </div>
        <button class="admin-close" data-close aria-label="Закрыть">×</button>
      </div>
      <div class="admin-document-content">${escapeHtml(version.contentSnapshot || '')}</div>
      <div class="admin-actions">
        <button class="admin-button secondary" data-download>Скачать</button>
        <button class="admin-button secondary" data-print>Печать / PDF</button>
        <button class="admin-button" data-new-version>Новая версия</button>
      </div>
    </aside>`;
  document.body.append(backdrop);

  backdrop.querySelector('[data-close]').addEventListener('click', () => backdrop.remove());
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) backdrop.remove(); });

  backdrop.querySelector('[data-download]').addEventListener('click', () => {
    const blob = new Blob([documentHtml(item)], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = documentFileName(item.title, version.version);
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  backdrop.querySelector('[data-print]').addEventListener('click', () => {
    const popup = window.open('', '_blank', 'noopener,noreferrer');
    if (!popup) return;
    popup.document.open();
    popup.document.write(documentHtml(item));
    popup.document.close();
    popup.focus();
    window.setTimeout(() => popup.print(), 150);
  });

  backdrop.querySelector('[data-new-version]').addEventListener('click', () => {
    backdrop.remove();
    const content = document.querySelector('[data-content]');
    renderLegalDocumentEditor(content, item.key);
    content.querySelector('[data-legal-editor]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function renderLegal() {
  setActiveSection('Документы');
  const content = app.querySelector('[data-content]');
  const readiness = state.platformLegal || {};
  const legalState = readiness.state || {};
  const allDocuments = (Array.isArray(readiness.documents) ? readiness.documents : [])
    .filter((item) => item.currentVersion);
  const documents = allDocuments
    .filter((item) => !USER_DOCUMENT_BASE_KEYS.includes(item.key))
    .sort((a, b) => documentSortIndex(a.key) - documentSortIndex(b.key) || String(a.title).localeCompare(String(b.title), 'ru'));
  const userDocumentBases = allDocuments
    .filter((item) => USER_DOCUMENT_BASE_KEYS.includes(item.key))
    .sort((a, b) => USER_DOCUMENT_BASE_KEYS.indexOf(a.key) - USER_DOCUMENT_BASE_KEYS.indexOf(b.key));
  const history = Array.isArray(state.documentHistory) ? state.documentHistory : [];
  const evidence = legalState.evidenceMetadata && typeof legalState.evidenceMetadata === 'object'
    ? legalState.evidenceMetadata
    : {};
  const rknSubmitted = legalState.filingStatus === 'SUBMITTED';
  const rknDate = evidence.submittedDate || legalState.submittedAt;
  const rknNumber = evidence.registrationNumber || legalState.submissionReference || '—';
  const rknCode = evidence.submissionCode || '—';

  content.innerHTML = `
    <div class="admin-heading">
      <div>
        <h2>Документы</h2>
        <p>Действующие документы, сведения Роскомнадзора и история версий.</p>
      </div>
    </div>

    <section class="admin-card admin-rkn-card">
      <div>
        <span class="admin-card-label">Роскомнадзор</span>
        <h3>${rknSubmitted ? 'Зарегистрировано в СЭД Роскомнадзора' : 'Сведения о подаче не зафиксированы'}</h3>
      </div>
      <div class="admin-rkn-details">
        <div><span>Дата</span><strong>${formatDate(rknDate)}</strong></div>
        <div><span>Регистрационный номер</span><strong>${escapeHtml(rknNumber)}</strong></div>
        <div><span>Код уведомления</span><strong>${escapeHtml(rknCode)}</strong></div>
      </div>
    </section>

    <section class="admin-card admin-documents-card">
      <div class="admin-section-head">
        <div>
          <h3>Действующие документы</h3>
          <p>Открыть, скачать или распечатать можно прямо отсюда.</p>
        </div>
        <button class="admin-button secondary" data-add-document>Добавить документ</button>
      </div>
      <div class="admin-document-list">
        ${documents.map((item) => `
          <div class="admin-document-row">
            <div>
              <strong>${escapeHtml(item.title)}</strong>
              <small>Версия ${Number(item.currentVersion?.version || 1)} · ${formatDate(item.currentVersion?.publishedAt)} · действует</small>
            </div>
            <button class="admin-button secondary" data-open-document="${escapeHtml(item.key)}">Открыть</button>
          </div>`).join('') || '<div class="admin-empty">Документы ещё не загружены.</div>'}
      </div>
    </section>

    <section class="admin-card admin-documents-card">
      <div class="admin-section-head">
        <div>
          <h3>Для пользователей</h3>
          <p>Основы документов, которые Book передаёт в персональные документы пользователей.</p>
        </div>
      </div>
      <div class="admin-document-list">
        ${userDocumentBases.map((item) => `
          <div class="admin-document-row">
            <div>
              <strong>${escapeHtml(item.title)}</strong>
              <small>Основа Book · версия ${Number(item.currentVersion?.version || 1)} · ${formatDate(item.currentVersion?.publishedAt)}</small>
            </div>
            <button class="admin-button secondary" data-open-document="${escapeHtml(item.key)}">Открыть</button>
          </div>`).join('') || '<div class="admin-empty">Основы документов ещё не загружены.</div>'}
      </div>
    </section>

    <div data-legal-editor></div>

    <section class="admin-card admin-history-card">
      <div class="admin-section-head">
        <div>
          <h3>История</h3>
          <p>Старые версии не удаляются и не перезаписываются.</p>
        </div>
      </div>
      <div class="admin-history-list">
        ${history.slice(0, 30).map((item) => `
          <div class="admin-history-row">
            <span>${formatDate(item.publishedAt)}</span>
            <strong>${escapeHtml(item.title)}</strong>
            <span>версия ${Number(item.version || 1)}</span>
            <span class="admin-pill ${item.supersededAt ? '' : 'active'}">${item.supersededAt ? 'архив' : 'действует'}</span>
          </div>`).join('') || '<div class="admin-empty">История появится после публикации документов.</div>'}
      </div>
    </section>`;

  content.querySelectorAll('[data-open-document]').forEach((button) => {
    button.addEventListener('click', () => {
      const item = allDocuments.find((document) => document.key === button.dataset.openDocument);
      openLegalDocument(item);
    });
  });

  content.querySelector('[data-add-document]')?.addEventListener('click', () => {
    renderLegalDocumentEditor(content);
    content.querySelector('[data-legal-editor]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function renderCapabilities() {
  setActiveSection('Возможности');
  const content = app.querySelector('[data-content]');
  const groups = new Map();
  state.capabilities.forEach((item) => {
    if (!groups.has(item.groupKey)) groups.set(item.groupKey, []);
    groups.get(item.groupKey).push(item);
  });
  content.innerHTML = `
    <div class="admin-heading"><div><h2>Возможности Book</h2><p>Единый каталог функций, которые можно выдавать каждому Book.</p></div></div>
    ${[...groups.entries()].map(([group, items]) => `<section class="admin-card" style="padding:18px;margin-bottom:14px"><strong>${escapeHtml(group)}</strong>${items.map((item) => `<div class="admin-capability"><div>${escapeHtml(item.name)}<small>${escapeHtml(item.key)}</small></div><span>${item.valueType === 'LIMIT' ? 'лимит' : 'ON / OFF'}</span></div>`).join('')}</section>`).join('')}`;
}

function openAccessDrawer(tenantId) {
  const master = state.masters.find((item) => item.tenantId === tenantId);
  if (!master) return;
  const resolved = new Map((master.access?.capabilities || []).map((item) => [item.key, item]));
  const backdrop = document.createElement('div');
  backdrop.className = 'admin-drawer-backdrop';
  backdrop.innerHTML = `
    <aside class="admin-drawer">
      <div class="admin-drawer-head">
        <div><h3>${escapeHtml(master.isOwnerBook ? 'Мой Book' : (master.master?.name || master.invitation?.name || master.tenantName))}</h3><p>${escapeHtml(master.master?.email || master.invitation?.email || '')}</p></div>
        <button class="admin-close" data-close aria-label="Закрыть">×</button>
      </div>
      <section class="admin-section">
        <h4>Доступ Book</h4>
        ${state.capabilities.map((capability) => capabilityEditor(capability, resolved.get(capability.key))).join('')}
      </section>
      <section class="admin-section">
        <h4>Состояние</h4>
        <button class="admin-button ${master.status === 'SUSPENDED' ? '' : 'danger'}" data-status>${master.status === 'SUSPENDED' ? 'Включить Book' : 'Отключить Book'}</button>
      </section>
      <div class="admin-actions"><button class="admin-button secondary" data-close>Закрыть</button><button class="admin-button" data-save>Сохранить доступы</button></div>
      <p class="admin-inline-message" data-save-message></p>
    </aside>`;
  document.body.append(backdrop);

  backdrop.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => backdrop.remove()));
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) backdrop.remove(); });
  backdrop.querySelectorAll('[data-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      button.classList.toggle('is-on');
      button.dataset.current = button.classList.contains('is-on') ? 'true' : 'false';
    });
  });

  backdrop.querySelector('[data-status]').addEventListener('click', async () => {
    const next = master.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
    try {
      await adminRequest(`/tenants/${encodeURIComponent(tenantId)}/access`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      await refreshData();
      backdrop.remove();
      renderCurrentSection();
    } catch (error) {
      backdrop.querySelector('[data-save-message]').textContent = error instanceof Error ? error.message : 'Не удалось изменить состояние';
      backdrop.querySelector('[data-save-message]').classList.add('error');
    }
  });

  backdrop.querySelector('[data-save]').addEventListener('click', async () => {
    const changes = [];
    backdrop.querySelectorAll('[data-capability]').forEach((element) => {
      const key = element.dataset.capability;
      const type = element.dataset.type;
      if (type === 'BOOLEAN') {
        const current = element.dataset.current === 'true';
        const original = element.dataset.original === 'true';
        if (current !== original) changes.push({ key, enabled: current });
      } else {
        const raw = element.value.trim();
        const current = raw === '' ? null : Number(raw);
        const originalRaw = element.dataset.original;
        const original = originalRaw === '' ? null : Number(originalRaw);
        if (current !== original) changes.push({ key, limit: current });
      }
    });
    const message = backdrop.querySelector('[data-save-message]');
    if (!changes.length) {
      message.textContent = 'Изменений нет.';
      return;
    }
    try {
      await adminRequest(`/tenants/${encodeURIComponent(tenantId)}/access`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capabilities: changes }),
      });
      message.textContent = 'Доступы сохранены.';
      message.classList.remove('error');
      await refreshData();
      window.setTimeout(() => { backdrop.remove(); renderCurrentSection(); }, 300);
    } catch (error) {
      message.textContent = error instanceof Error ? error.message : 'Не удалось сохранить доступы';
      message.classList.add('error');
    }
  });
}

function capabilityEditor(capability, resolved) {
  if (capability.valueType === 'LIMIT') {
    const value = resolved?.limit == null ? '' : String(resolved.limit);
    return `<label class="admin-capability"><div>${escapeHtml(capability.name)}<small>${escapeHtml(capability.key)} · пусто = без ограничения</small></div><input class="admin-limit" type="number" min="0" data-capability="${escapeHtml(capability.key)}" data-type="LIMIT" data-original="${escapeHtml(value)}" value="${escapeHtml(value)}" placeholder="∞"></label>`;
  }
  const enabled = resolved?.enabled !== false;
  return `<div class="admin-capability"><div>${escapeHtml(capability.name)}<small>${escapeHtml(capability.key)}</small></div><button type="button" class="admin-toggle ${enabled ? 'is-on' : ''}" data-toggle data-capability="${escapeHtml(capability.key)}" data-type="BOOLEAN" data-original="${enabled}" data-current="${enabled}" aria-label="${escapeHtml(capability.name)}"></button></div>`;
}

try {
  state.account = await getCurrentUser();
  if (!state.account) {
    renderLogin();
  } else {
    await loadAdmin();
  }
} catch (error) {
  const message = error instanceof Error ? error.message : 'Нет доступа к панели управления';
  clearAuthToken();
  renderLogin(message);
}
