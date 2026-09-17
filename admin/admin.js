import { apiRequest, clearAuthToken, getCurrentUser, login } from '../core/auth.js';

const app = document.querySelector('#admin-app');
const state = {
  account: null,
  admin: null,
  masters: [],
  capabilities: [],
  platformLegal: null,
  section: 'masters',
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

const PLATFORM_DOCUMENT_PRESETS = [
  { key: 'privacy-policy', type: 'PRIVACY_POLICY', title: 'Политика обработки персональных данных Book', requiredForRegistration: true },
  { key: 'saas-agreement', type: 'SAAS_AGREEMENT', title: 'Договор-оферта на использование Book', requiredForRegistration: true },
  { key: 'dpa', type: 'DPA', title: 'Поручение на обработку персональных данных (DPA)', requiredForRegistration: true },
  { key: 'master-pd-consent', type: 'MASTER_PD_CONSENT', title: 'Согласие мастера на обработку персональных данных', requiredForRegistration: true },
  { key: 'marketing-consent', type: 'MARKETING_CONSENT', title: 'Согласие на рекламные и маркетинговые сообщения Book', requiredForRegistration: false },
];

const PLATFORM_CHECKLIST_LABELS = {
  operatorDocumentsPublished: 'Документы оператора опубликованы',
  privacyPolicyPublished: 'Политика обработки ПД опубликована',
  consentFormsPrepared: 'Формы согласий подготовлены',
  saasAgreementPublished: 'SaaS-оферта опубликована',
  dpaPublished: 'DPA опубликовано',
  operatorIdentityConfigured: 'Реквизиты оператора зафиксированы',
  rknFilingConfirmed: 'Подача уведомления в Роскомнадзор зафиксирована',
  productionInfrastructureChecked: 'Production-инфраструктура проверена',
};

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
  if (state.platformLegal?.state?.status !== 'LEGAL_READY') state.section = 'legal';
  renderShell();
}

async function refreshData() {
  const [masters, capabilities, platformLegal] = await Promise.all([
    adminRequest('/masters'),
    adminRequest('/capabilities'),
    legalRequest('/readiness'),
  ]);
  state.masters = Array.isArray(masters) ? masters : [];
  state.capabilities = Array.isArray(capabilities) ? capabilities : [];
  state.platformLegal = platformLegal || null;
}

function renderShell() {
  app.innerHTML = `
    <div class="admin-shell">
      <aside class="admin-sidebar">
        <div class="admin-brand">Book <span>Admin</span></div>
        <nav class="admin-nav">
          <button data-section="overview">Обзор</button>
          <button data-section="legal">Документы и запуск</button>
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
    const locked = state.platformLegal?.state?.status !== 'LEGAL_READY' && button.dataset.section !== 'legal';
    button.disabled = locked;
    button.addEventListener('click', () => {
      if (state.platformLegal?.state?.status !== 'LEGAL_READY' && button.dataset.section !== 'legal') {
        state.section = 'legal';
      } else {
        state.section = button.dataset.section;
      }
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
    ${legalReady ? '' : '<div class="admin-card" style="padding:16px;margin-bottom:14px"><strong>Регистрация реальных мастеров закрыта.</strong><p style="margin:6px 0 0;color:#817a74">Сначала завершите раздел «Документы и запуск» и переведите Book в LEGAL_READY.</p></div>'}
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


function legalStatusPill(value, goodValue) {
  const good = value === goodValue;
  return `<span class="admin-pill ${good ? 'active' : 'pending'}">${escapeHtml(value || '—')}</span>`;
}

function renderLegalDocumentEditor(content, selectedKey = '') {
  const readiness = state.platformLegal || {};
  const documents = Array.isArray(readiness.documents) ? readiness.documents : [];
  const preset = PLATFORM_DOCUMENT_PRESETS.find((item) => item.key === selectedKey) || PLATFORM_DOCUMENT_PRESETS[0];
  const selected = documents.find((item) => item.key === preset.key);
  const current = selected?.currentVersion || null;
  const identity = current?.operatorIdentitySnapshot && typeof current.operatorIdentitySnapshot === 'object'
    ? current.operatorIdentitySnapshot
    : {};

  content.querySelector('[data-legal-editor]').innerHTML = `
    <section class="admin-card" style="padding:18px;margin-top:14px">
      <h3 style="margin-top:0">${current ? 'Новая версия документа' : 'Публикация документа'}</h3>
      <form class="admin-form" data-platform-document-form>
        <label class="admin-field"><span>Документ</span>
          <select name="key">${PLATFORM_DOCUMENT_PRESETS.map((item) => `<option value="${escapeHtml(item.key)}" ${item.key === preset.key ? 'selected' : ''}>${escapeHtml(item.title)}</option>`).join('')}</select>
        </label>
        <label class="admin-field"><span>Название</span><input name="title" value="${escapeHtml(selected?.title || preset.title)}" required></label>
        <label class="admin-field"><span>Тип</span><input name="type" value="${escapeHtml(selected?.type || preset.type)}" required></label>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px">
          <label class="admin-field"><span>Оператор / ИП</span><input name="operatorName" value="${escapeHtml(identity.name || '')}" required></label>
          <label class="admin-field"><span>ИНН</span><input name="inn" value="${escapeHtml(identity.inn || '')}"></label>
          <label class="admin-field"><span>ОГРНИП</span><input name="ogrnip" value="${escapeHtml(identity.ogrnip || '')}"></label>
          <label class="admin-field"><span>Email</span><input name="operatorEmail" type="email" value="${escapeHtml(identity.email || '')}"></label>
        </div>
        <label class="admin-field"><span>Текст документа</span><textarea name="content" rows="18" required>${escapeHtml(current?.contentSnapshot || '')}</textarea></label>
        <label style="display:flex;gap:8px;align-items:center"><input name="requiredForRegistration" type="checkbox" ${(selected?.requiredForRegistration ?? preset.requiredForRegistration) ? 'checked' : ''}> Обязателен при регистрации мастера</label>
        <p class="admin-inline-message" data-platform-document-message></p>
        <button class="admin-button" type="submit">Опубликовать версию</button>
      </form>
    </section>`;

  const form = content.querySelector('[data-platform-document-form]');
  const select = form.querySelector('[name="key"]');
  select.addEventListener('change', () => renderLegalDocumentEditor(content, select.value));
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = form.querySelector('[data-platform-document-message]');
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    message.textContent = '';
    try {
      const data = new FormData(form);
      await legalRequest('/documents', {
        method: 'POST',
        body: JSON.stringify({
          key: String(data.get('key') || ''),
          type: String(data.get('type') || ''),
          title: String(data.get('title') || ''),
          content: String(data.get('content') || ''),
          operatorIdentity: {
            name: String(data.get('operatorName') || '').trim(),
            inn: String(data.get('inn') || '').trim(),
            ogrnip: String(data.get('ogrnip') || '').trim(),
            email: String(data.get('operatorEmail') || '').trim(),
          },
          requiredForRegistration: data.get('requiredForRegistration') === 'on',
          requiredForLive: false,
          requiredForPublicBooking: false,
        }),
      });
      await refreshData();
      renderLegal();
    } catch (error) {
      message.textContent = error instanceof Error ? error.message : 'Не удалось опубликовать документ';
      message.classList.add('error');
      button.disabled = false;
    }
  });
}

function renderLegal() {
  setActiveSection('Документы и запуск');
  const content = app.querySelector('[data-content]');
  const readiness = state.platformLegal || {};
  const legalState = readiness.state || {};
  const documents = Array.isArray(readiness.documents) ? readiness.documents : [];
  const checklist = legalState.checklist && typeof legalState.checklist === 'object' ? legalState.checklist : {};

  content.innerHTML = `
    <div class="admin-heading"><div><h2>Документы и запуск Book</h2><p>Единственная точка юридической готовности платформы.</p></div></div>
    <div class="admin-stats">
      <div class="admin-stat"><strong>${legalStatusPill(legalState.status || 'PRE_LAUNCH', 'LEGAL_READY')}</strong><span>режим платформы</span></div>
      <div class="admin-stat"><strong>${legalStatusPill(legalState.filingStatus || 'NOT_PREPARED', 'SUBMITTED')}</strong><span>Роскомнадзор</span></div>
      <div class="admin-stat"><strong>${documents.filter((item) => item.currentVersion).length}</strong><span>опубликовано документов</span></div>
    </div>

    <section class="admin-card" style="padding:18px;margin-top:14px">
      <h3 style="margin-top:0">Документы Book</h3>
      ${PLATFORM_DOCUMENT_PRESETS.map((preset) => {
        const doc = documents.find((item) => item.key === preset.key);
        const version = doc?.currentVersion;
        return `<div class="admin-capability"><div><strong>${escapeHtml(preset.title)}</strong><small>${version ? `версия ${Number(version.version || 1)} · опубликован` : 'не опубликован'}</small></div><button class="admin-button secondary" data-edit-legal="${escapeHtml(preset.key)}">${version ? 'Новая версия' : 'Добавить'}</button></div>`;
      }).join('')}
    </section>

    <div data-legal-editor></div>

    <section class="admin-card" style="padding:18px;margin-top:14px">
      <h3 style="margin-top:0">Проверка готовности</h3>
      ${(readiness.checklistKeys || []).map((key) => {
        const derived = ['operatorDocumentsPublished', 'privacyPolicyPublished', 'consentFormsPrepared', 'saasAgreementPublished', 'dpaPublished', 'operatorIdentityConfigured', 'rknFilingConfirmed'].includes(key);
        return `<label style="display:flex;gap:9px;align-items:center;padding:8px 0"><input type="checkbox" data-platform-check="${escapeHtml(key)}" ${checklist[key] === true ? 'checked' : ''} ${legalState.status === 'LEGAL_READY' || derived ? 'disabled' : ''}><span>${escapeHtml(PLATFORM_CHECKLIST_LABELS[key] || key)}</span></label>`;
      }).join('')}
      <p class="admin-inline-message" data-platform-check-message></p>
    </section>

    <section class="admin-card" style="padding:18px;margin-top:14px">
      <h3 style="margin-top:0">Роскомнадзор и запуск</h3>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="admin-button secondary" data-platform-prepared ${legalState.filingStatus !== 'NOT_PREPARED' ? 'disabled' : ''}>Документы готовы → PREPARED</button>
        <button class="admin-button" data-platform-ready ${!readiness.canBecomeLegalReady || legalState.status === 'LEGAL_READY' ? 'disabled' : ''}>Перевести Book в LEGAL_READY</button>
      </div>
      ${legalState.filingStatus === 'PREPARED' ? `
        <form class="admin-form" data-platform-submitted-form style="margin-top:14px">
          <label class="admin-field"><span>Регистрационный номер / подтверждение подачи</span><input name="submissionReference" required></label>
          <button class="admin-button" type="submit">Зафиксировать SUBMITTED</button>
          <p class="admin-inline-message" data-platform-submit-message></p>
        </form>` : ''}
      ${legalState.filingStatus === 'SUBMITTED' ? `<p style="margin:14px 0 0;color:#817a74">Подача зафиксирована: ${escapeHtml(legalState.submissionReference || 'без номера')}</p>` : ''}
    </section>`;

  content.querySelectorAll('[data-edit-legal]').forEach((button) => {
    button.addEventListener('click', () => renderLegalDocumentEditor(content, button.dataset.editLegal));
  });

  content.querySelectorAll('[data-platform-check]').forEach((checkbox) => {
    checkbox.addEventListener('change', async () => {
      const message = content.querySelector('[data-platform-check-message]');
      checkbox.disabled = true;
      try {
        state.platformLegal = await legalRequest('/checklist', {
          method: 'PUT',
          body: JSON.stringify({ checklist: { [checkbox.dataset.platformCheck]: checkbox.checked } }),
        });
        renderLegal();
      } catch (error) {
        message.textContent = error instanceof Error ? error.message : 'Не удалось сохранить';
        message.classList.add('error');
        checkbox.disabled = false;
      }
    });
  });

  content.querySelector('[data-platform-prepared]')?.addEventListener('click', async () => {
    try {
      state.platformLegal = await legalRequest('/filing/prepared', { method: 'POST', body: '{}' });
      renderLegal();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Не удалось изменить статус');
    }
  });

  content.querySelector('[data-platform-submitted-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const message = form.querySelector('[data-platform-submit-message]');
    try {
      state.platformLegal = await legalRequest('/filing/submitted', {
        method: 'POST',
        body: JSON.stringify({
          submissionReference: String(data.get('submissionReference') || '').trim(),
          evidenceMetadata: { source: 'book-admin' },
        }),
      });
      renderLegal();
    } catch (error) {
      message.textContent = error instanceof Error ? error.message : 'Не удалось зафиксировать подачу';
      message.classList.add('error');
    }
  });

  content.querySelector('[data-platform-ready]')?.addEventListener('click', async () => {
    try {
      state.platformLegal = await legalRequest('/legal-ready', { method: 'POST', body: '{}' });
      await refreshData();
      renderLegal();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Book пока не готов к LEGAL_READY');
    }
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
