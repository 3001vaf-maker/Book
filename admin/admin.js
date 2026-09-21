import { apiRequest, clearAuthToken, getCurrentAccount, login } from '../core/auth.js';
import { renderDocumentRegistry } from './document-registry/view.js';
import { renderFirstRunAdmin } from './first-run.js';

const app = document.querySelector('#admin-app');
const state = {
  account: null,
  admin: null,
  tenants: [],
  capabilities: [],
  section: 'tenants',
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

function renderLogin(message = '') {
  app.innerHTML = `
    <main class="admin-login">
      <section class="admin-login-card">
        <h1>Администрирование</h1>
        <p>Управление пользователями и рабочими пространствами</p>
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
  const [tenants, capabilities] = await Promise.all([
    adminRequest('/tenants'),
    adminRequest('/capabilities'),
  ]);
  state.tenants = Array.isArray(tenants) ? tenants : [];
  state.capabilities = Array.isArray(capabilities) ? capabilities : [];
}

function renderShell() {
  app.innerHTML = `
    <div class="admin-shell">
      <aside class="admin-sidebar">
        <div class="admin-brand">Панель <span>управления</span></div>
        <nav class="admin-nav">
          <button data-section="overview">Обзор</button>
          <button data-section="owner" class="owner-link">Моё пространство</button>
          <button data-section="document-registry">Реестр документов</button>
          <button data-section="first-run">Первое знакомство</button>
          <button data-section="tenants">Пользователи</button>
          <button data-section="capabilities">Инструменты</button>
        </nav>
        <div class="admin-sidebar-foot">Управление системой</div>
      </aside>
      <header class="admin-toolbar">
        <h1 data-toolbar-title>Пользователи</h1>
        <div class="admin-toolbar-user"><span>${escapeHtml(state.admin?.account?.email || '')}</span><button class="admin-button secondary" data-logout>Выйти</button></div>
      </header>
      <main class="admin-main"><div class="admin-content" data-content></div></main>
    </div>`;

  app.querySelectorAll('[data-section]').forEach((button) => {
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
  if (state.section === 'owner') return renderOwnerBook();
  if (state.section === 'document-registry') {
    return renderDocumentRegistry(app.querySelector('[data-content]'), {
      escapeHtml,
      setTitle: setActiveSection,
      loadHistory: () => adminRequest('/document-registry/history'),
    });
  }
  if (state.section === 'first-run') {
    return renderFirstRunAdmin(app.querySelector('[data-content]'), {
      request: adminRequest,
      escapeHtml,
      setTitle: setActiveSection,
    });
  }
  if (state.section === 'capabilities') return renderCapabilities();
  return renderTenants();
}

function renderOverview() {
  setActiveSection('Обзор');
  const content = app.querySelector('[data-content]');
  const regular = state.tenants.filter((item) => !item.isOwnerBook);
  const active = regular.filter((item) => item.status === 'ACTIVE' && item.ownerProfile).length;
  const pending = regular.filter((item) => !item.ownerProfile && item.invitation?.status === 'PENDING').length;
  content.innerHTML = `
    <div class="admin-heading"><div><h2>Обзор</h2><p>Состояние рабочих пространств</p></div></div>
    <div class="admin-stats">
      <div class="admin-stat"><strong>${regular.length}</strong><span>зарегистрировано</span></div>
      <div class="admin-stat"><strong>${active}</strong><span>активных</span></div>
      <div class="admin-stat"><strong>${pending}</strong><span>ожидают регистрации</span></div>
    </div>`;
}

function renderOwnerBook() {
  setActiveSection('Моё пространство');
  const owner = state.tenants.find((item) => item.isOwnerBook);
  const content = app.querySelector('[data-content]');
  if (!owner) {
    content.innerHTML = '<div class="admin-card" style="padding:20px">Личное рабочее пространство пока не определено.</div>';
    return;
  }
  content.innerHTML = `
    <div class="admin-heading"><div><h2>Моё пространство</h2><p>Личное рабочее пространство администратора остаётся отдельным от списка пользователей.</p></div></div>
    <div class="admin-card" style="padding:20px">
      <strong>${escapeHtml(owner.ownerProfile?.name || owner.tenantName)}</strong>
      <p style="color:#817a74">${escapeHtml(owner.ownerProfile?.email || '')}</p>
      <button class="admin-button" data-edit-owner>Настроить доступы</button>
    </div>`;
  content.querySelector('[data-edit-owner]').addEventListener('click', () => openAccessDrawer(owner.tenantId));
}

function renderTenants() {
  setActiveSection('Пользователи');
  const content = app.querySelector('[data-content]');
  const tenants = state.tenants.filter((item) => !item.isOwnerBook);
  content.innerHTML = `
    <div class="admin-heading"><div><h2>Пользователи</h2><p>Каждый зарегистрированный пользователь работает в своём пространстве.</p></div></div>
    <section class="admin-invite-panel">
      <div class="admin-invite-head">
        <h3>Пригласить пользователя</h3>
        <button class="admin-button secondary" type="button" data-create-invite-link>Регистрационная ссылка</button>
      </div>
      <form class="admin-invite-grid" data-invite-form>
        <label class="admin-field"><span>Имя</span><input name="name" placeholder="Имя"></label>
        <label class="admin-field"><span>Email</span><input name="email" type="email" placeholder="name@example.com" required></label>
        <button class="admin-button" type="submit">Отправить приглашение</button>
      </form>
      <div class="admin-invite-link" data-invite-link hidden>
        <label class="admin-field">
          <span>Ссылка для регистрации</span>
          <input type="text" readonly data-invite-link-value>
        </label>
        <button class="admin-button secondary" type="button" data-copy-invite-link>Копировать</button>
      </div>
      <p class="admin-inline-message" data-invite-message></p>
    </section>
    <div class="admin-card">
      <table class="admin-table">
        <thead><tr><th>Пользователь</th><th>Email</th><th>Состояние</th><th>Набор</th></tr></thead>
        <tbody>${tenants.map(tenantRow).join('') || '<tr><td colspan="4">Пока нет созданных профилей.</td></tr>'}</tbody>
      </table>
    </div>`;

  const form = content.querySelector('[data-invite-form]');
  const message = content.querySelector('[data-invite-message]');
  const createLinkButton = content.querySelector('[data-create-invite-link]');
  const inviteLinkBox = content.querySelector('[data-invite-link]');
  const inviteLinkInput = content.querySelector('[data-invite-link-value]');
  const copyLinkButton = content.querySelector('[data-copy-invite-link]');

  createLinkButton?.addEventListener('click', async () => {
    message.textContent = '';
    message.classList.remove('error');
    createLinkButton.disabled = true;
    createLinkButton.textContent = 'Создаём…';
    try {
      const result = await adminRequest('/invitations/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const url = String(result?.url || '').trim();
      if (!url) throw new Error('Ссылка не получена');
      inviteLinkInput.value = url;
      inviteLinkBox.hidden = false;
      message.textContent = 'Ссылка создана. Она действует 7 дней и используется один раз.';
      await refreshData();
    } catch (error) {
      message.textContent = error instanceof Error ? error.message : 'Не удалось создать ссылку';
      message.classList.add('error');
    } finally {
      createLinkButton.disabled = false;
      createLinkButton.textContent = 'Регистрационная ссылка';
    }
  });

  copyLinkButton?.addEventListener('click', async () => {
    const url = String(inviteLinkInput?.value || '').trim();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      inviteLinkInput.focus();
      inviteLinkInput.select();
      document.execCommand('copy');
    }
    copyLinkButton.textContent = 'Скопировано';
    window.setTimeout(() => { copyLinkButton.textContent = 'Копировать'; }, 1200);
  });

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
      window.setTimeout(renderTenants, 350);
    } catch (error) {
      message.textContent = error instanceof Error ? error.message : 'Не удалось отправить приглашение';
      message.classList.add('error');
    } finally {
      button.disabled = false;
      button.textContent = 'Отправить приглашение';
    }
  });

  content.querySelectorAll('[data-email-tenant]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      openAccessDrawer(button.dataset.emailTenant);
    });
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

function tenantRow(item) {
  const pending = !item.ownerProfile && item.invitation?.status === 'PENDING';
  const name = item.ownerProfile?.name || item.invitation?.name || item.tenantName;
  const email = item.ownerProfile?.email || item.invitation?.email || '';
  const statusClass = item.status === 'SUSPENDED' ? 'suspended' : pending ? 'pending' : 'active';
  const statusLabel = item.status === 'SUSPENDED' ? 'Отключён' : pending ? 'Ждёт входа' : item.ownerProfile ? 'Активен' : 'Создан';
  const registrationLink = Boolean(item.invitation?.registrationLink);
  const resolvedStatusLabel = registrationLink && pending ? 'Ждёт регистрации' : statusLabel;
  const resend = pending && !registrationLink ? `<button class="admin-button secondary" data-resend="${escapeHtml(item.invitation.id)}">Повторить email</button>` : '';
  const technicalEmail = item.ownerProfile?.email
    ? `<button class="admin-button secondary" data-email-tenant="${escapeHtml(item.tenantId)}">Письмо</button>`
    : '';
  return `<tr data-tenant="${escapeHtml(item.tenantId)}"><td><strong>${escapeHtml(name)}</strong></td><td>${email ? escapeHtml(email) : '—'}</td><td><span class="admin-pill ${statusClass}">${resolvedStatusLabel}</span> ${resend} ${technicalEmail}</td><td>${escapeHtml(item.plan?.name || 'Индивидуальный')}</td></tr>`;
}

function renderCapabilities() {
  setActiveSection('Инструменты');
  const content = app.querySelector('[data-content]');
  const groups = new Map();
  state.capabilities.forEach((item) => {
    if (!groups.has(item.groupKey)) groups.set(item.groupKey, []);
    groups.get(item.groupKey).push(item);
  });
  content.innerHTML = `
    <div class="admin-heading"><div><h2>Инструменты</h2><p>Единый каталог функций, которые можно выдавать каждому рабочему пространству.</p></div></div>
    ${[...groups.entries()].map(([group, items]) => `<section class="admin-card" style="padding:18px;margin-bottom:14px"><strong>${escapeHtml(group)}</strong>${items.map((item) => `<div class="admin-capability"><div>${escapeHtml(item.name)}<small>${escapeHtml(item.key)}</small></div><span>${item.valueType === 'LIMIT' ? 'лимит' : 'ON / OFF'}</span></div>`).join('')}</section>`).join('')}`;
}

function openAccessDrawer(tenantId) {
  const tenant = state.tenants.find((item) => item.tenantId === tenantId);
  if (!tenant) return;
  const resolved = new Map((tenant.access?.capabilities || []).map((item) => [item.key, item]));
  const backdrop = document.createElement('div');
  backdrop.className = 'admin-drawer-backdrop';
  backdrop.innerHTML = `
    <aside class="admin-drawer">
      <div class="admin-drawer-head">
        <div><h3>${escapeHtml(tenant.isOwnerBook ? 'Мой Book' : (tenant.ownerProfile?.name || tenant.invitation?.name || tenant.tenantName))}</h3><p>${escapeHtml(tenant.ownerProfile?.email || tenant.invitation?.email || '')}</p></div>
        <button class="admin-close" data-close aria-label="Закрыть">×</button>
      </div>
      <section class="admin-section">
        <h4>Доступ Book</h4>
        ${state.capabilities.map((capability) => capabilityEditor(capability, resolved.get(capability.key))).join('')}
      </section>
      <section class="admin-section">
        <h4>Состояние</h4>
        <button class="admin-button ${tenant.status === 'SUSPENDED' ? '' : 'danger'}" data-status>${tenant.status === 'SUSPENDED' ? 'Включить Book' : 'Отключить Book'}</button>
      </section>
      ${tenant.ownerProfile?.email ? `
      <section class="admin-section">
        <h4>Техническое письмо</h4>
        <p class="admin-service-note">Получатель: ${escapeHtml(tenant.ownerProfile.email)}</p>
        <form class="admin-form" data-technical-email-form>
          <label class="admin-field"><span>Тема</span><input name="subject" maxlength="200" required></label>
          <label class="admin-field"><span>Текст</span><textarea name="body" rows="6" maxlength="20000" required></textarea></label>
          <div><button class="admin-button secondary" type="submit">Отправить письмо</button></div>
          <p class="admin-inline-message" data-technical-email-message></p>
        </form>
      </section>` : ''}
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
    const next = tenant.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
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

  const technicalEmailForm = backdrop.querySelector('[data-technical-email-form]');
  technicalEmailForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = technicalEmailForm.querySelector('button[type="submit"]');
    const message = technicalEmailForm.querySelector('[data-technical-email-message]');
    const data = new FormData(technicalEmailForm);
    message.textContent = '';
    message.classList.remove('error');
    button.disabled = true;
    button.textContent = 'Отправляем…';
    try {
      const result = await adminRequest(`/tenants/${encodeURIComponent(tenantId)}/technical-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: data.get('subject'), body: data.get('body') }),
      });
      message.textContent = `Письмо отправлено на ${result.recipientEmail}.`;
      technicalEmailForm.reset();
    } catch (error) {
      message.textContent = error instanceof Error ? error.message : 'Не удалось отправить письмо';
      message.classList.add('error');
    } finally {
      button.disabled = false;
      button.textContent = 'Отправить письмо';
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
  state.account = await getCurrentAccount();
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
