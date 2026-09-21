import { apiRequest, clearAuthToken, getCurrentAccount, login } from '../core/auth.js';
import { renderDocumentRegistry } from './document-registry/view.js';
import { renderFirstRunAdmin } from './first-run.js';
import { DOCUMENT_CATALOG } from './document-registry/catalog.js';

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
  await adminRequest('/document-registry/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documents: DOCUMENT_CATALOG }),
  });
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

  content.querySelectorAll('[data-delete-tenant]').forEach((button) => {
    button.addEventListener('click', async (event) => {
      event.stopPropagation();
      const tenantId = button.dataset.deleteTenant;
      if (!tenantId) return;
      const tenant = state.tenants.find((item) => item.tenantId === tenantId);
      const name = tenant?.ownerProfile?.name || tenant?.invitation?.name || tenant?.tenantName || 'этого пользователя';
      if (!window.confirm(`Полностью удалить «${name}» и все данные этого тестового рабочего пространства? Отменить это действие будет нельзя.`)) return;
      button.disabled = true;
      try {
        await adminRequest(`/tenants/${encodeURIComponent(tenantId)}`, { method: 'DELETE' });
        await refreshData();
        renderTenants();
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Не удалось удалить пользователя');
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
  const remove = `<button class="admin-button danger" data-delete-tenant="${escapeHtml(item.tenantId)}">Удалить</button>`;
  return `<tr data-tenant="${escapeHtml(item.tenantId)}"><td><strong>${escapeHtml(name)}</strong></td><td>${email ? escapeHtml(email) : '—'}</td><td><span class="admin-pill ${statusClass}">${resolvedStatusLabel}</span> ${resend} ${technicalEmail} ${remove}</td><td>${escapeHtml(item.plan?.name || 'Индивидуальный')}</td></tr>`;
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

function formatAdminMoment(value, fallback = '—') {
  const date = new Date(value || 0);
  if (!Number.isFinite(date.getTime())) return fallback;
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function activeTimeText(secondsValue) {
  const seconds = Math.max(0, Number(secondsValue) || 0);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours) return `${hours} ч ${minutes} мин`;
  return `${minutes} мин`;
}

function orderedCapabilityCatalog(tenant) {
  const byKey = new Map(state.capabilities.map((item) => [item.key, item]));
  const order = Array.isArray(tenant.access?.capabilityOrder) ? tenant.access.capabilityOrder : [];
  const result = order.map((key) => byKey.get(key)).filter(Boolean);
  state.capabilities.forEach((item) => {
    if (!result.some((entry) => entry.key === item.key)) result.push(item);
  });
  return result;
}

function activityEventLabel(event, stepTitles) {
  const stepTitle = stepTitles.get(event.stepKey) || event.stepKey || '';
  if (event.eventType === 'INVITATION_ACTIVATED') return 'Открыта регистрационная ссылка';
  if (event.eventType === 'ACCOUNT_CREATED') return 'Создана учётная запись';
  if (event.eventType === 'FIRST_RUN_STARTED') return 'Начато первое знакомство';
  if (event.eventType === 'STEP_MODAL_SHOWN') return stepTitle ? `Показана подсказка «${stepTitle}»` : 'Показана подсказка';
  if (event.eventType === 'STEP_COMPLETED') return stepTitle ? `Завершён этап «${stepTitle}»` : 'Этап завершён';
  if (event.eventType === 'STEP_SKIPPED') return stepTitle ? `Пропущен этап «${stepTitle}»` : 'Этап пропущен';
  if (event.eventType === 'FIRST_RUN_COMPLETED') return 'Первое знакомство завершено';
  if (event.eventType === 'SESSION_STARTED') return 'Вход в систему';
  if (event.eventType === 'SESSION_ENDED') {
    const reason = String(event.metadata?.reason || '');
    return reason === 'LOGOUT' ? 'Выход из системы' : reason === 'TIMEOUT' ? 'Сеанс завершён по отсутствию активности' : 'Сеанс завершён';
  }
  if (event.eventType === 'COMMERCIAL_MODE_CHANGED') return `Режим изменён: ${escapeHtml(event.metadata?.commercialMode || '')}`;
  if (event.eventType === 'DEMO_EXTENDED') return 'DEMO продлено компанией';
  if (event.eventType === 'DEMO_OPERATIONAL_DATA_CLEARED') return 'Учебные операционные данные очищены';
  if (event.eventType === 'FINANCE_SECTION_OPENED') return 'Открыт финансовый раздел';
  return event.eventType;
}

function activityMarkup(activity) {
  const progress = activity?.progress || null;
  const steps = Array.isArray(progress?.steps) ? progress.steps : [];
  const stepTitles = new Map(steps.map((item) => [item.key, item.title]));
  const currentTitle = stepTitles.get(progress?.currentStepKey) || progress?.currentStepKey || '—';
  const sessions = Array.isArray(activity?.sessions) ? activity.sessions : [];
  const events = Array.isArray(activity?.events) ? activity.events : [];
  const firstSession = sessions.length ? sessions[sessions.length - 1] : null;
  return `
    <div class="admin-activity-summary">
      <div><span>Первый вход</span><strong>${escapeHtml(firstSession ? formatAdminMoment(firstSession.startedAt) : 'Не входил')}</strong></div>
      <div><span>Последняя активность</span><strong>${escapeHtml(activity?.lastActivityAt ? formatAdminMoment(activity.lastActivityAt) : 'Нет')}</strong></div>
      <div><span>Сеансов</span><strong>${escapeHtml(sessions.length)}</strong></div>
      <div><span>Активное время</span><strong>${escapeHtml(activeTimeText(activity?.totalActiveSeconds))}</strong></div>
      <div><span>Обучение</span><strong>${escapeHtml(progress ? (progress.status === 'COMPLETED' ? 'Завершено' : currentTitle) : 'Не начато')}</strong></div>
      <div><span>Версия сценария</span><strong>${escapeHtml(progress?.scenarioVersion || '—')}</strong></div>
    </div>
    <div class="admin-activity-timeline">
      ${events.length ? events.map((event) => `<div class="admin-activity-event">
        <time>${escapeHtml(formatAdminMoment(event.occurredAt))}</time>
        <div>${escapeHtml(activityEventLabel(event, stepTitles))}</div>
      </div>`).join('') : '<div class="admin-history-empty">Событий пока нет.</div>'}
    </div>`;
}

function capabilityOrderRow(capability, resolved) {
  return `<div class="admin-capability-order-row" draggable="true" data-capability-row="${escapeHtml(capability.key)}">
    <div class="admin-capability-move">
      <button type="button" data-capability-up aria-label="Поднять">↑</button>
      <button type="button" data-capability-down aria-label="Опустить">↓</button>
    </div>
    <div class="admin-capability-control">${capabilityEditor(capability, resolved)}</div>
  </div>`;
}

function openAccessDrawer(tenantId) {
  const tenant = state.tenants.find((item) => item.tenantId === tenantId);
  if (!tenant) return;
  const resolved = new Map((tenant.access?.capabilities || []).map((item) => [item.key, item]));
  const capabilities = orderedCapabilityCatalog(tenant);
  const mode = String(tenant.access?.commercialMode || 'DEMO');
  const demoActivated = tenant.access?.demoActivatedAt || tenant.invitation?.activatedAt || '';
  const demoExpires = tenant.access?.demoExpiresAt || tenant.invitation?.demoExpiresAt || '';
  const progress = tenant.firstRun || null;
  const backdrop = document.createElement('div');
  backdrop.className = 'admin-drawer-backdrop';
  backdrop.innerHTML = `
    <aside class="admin-drawer">
      <div class="admin-drawer-head">
        <div><h3>${escapeHtml(tenant.ownerProfile?.name || tenant.invitation?.name || tenant.tenantName || 'Пользователь')}</h3><p>${escapeHtml(tenant.ownerProfile?.email || tenant.invitation?.email || '')}</p></div>
        <button class="admin-close" data-close aria-label="Закрыть">×</button>
      </div>

      <section class="admin-section">
        <h4>Режим</h4>
        <div class="admin-mode-card">
          <strong>${escapeHtml(mode)}</strong>
          <span>${demoActivated ? `DEMO активировано ${escapeHtml(formatAdminMoment(demoActivated))}` : 'DEMO ещё не активировано'}</span>
          <span>${demoExpires ? `Срок DEMO до ${escapeHtml(formatAdminMoment(demoExpires))}` : ''}</span>
          <span>${progress ? (progress.status === 'COMPLETED' ? 'Первое знакомство завершено' : `Текущий этап: ${escapeHtml(progress.currentStepKey || '—')}`) : 'Первое знакомство ещё не начато'}</span>
        </div>
        <div class="admin-inline-actions">
          ${mode === 'DEMO' ? '<button class="admin-button secondary" data-extend-demo>Продлить DEMO на 14 дней</button>' : ''}
          ${mode !== 'LIVE' && tenant.ownerProfile ? '<button class="admin-button" data-set-live>Перевести в LIVE</button>' : ''}
        </div>
        <p class="admin-inline-message" data-mode-message></p>
      </section>

      <section class="admin-section">
        <h4>Инструменты</h4>
        <p class="admin-service-note">Порядок индивидуален для этого пользователя и не меняет функциональность инструмента.</p>
        <div data-capability-order-list>
          ${capabilities.map((capability) => capabilityOrderRow(capability, resolved.get(capability.key))).join('')}
        </div>
      </section>

      <section class="admin-section">
        <h4>Состояние пространства</h4>
        <button class="admin-button ${tenant.status === 'SUSPENDED' ? '' : 'danger'}" data-status>${tenant.status === 'SUSPENDED' ? 'Включить пространство' : 'Отключить пространство'}</button>
      </section>

      <section class="admin-section">
        <h4>Журнал активности</h4>
        <div data-activity><div class="admin-history-empty">Загрузка…</div></div>
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

      <div class="admin-actions"><button class="admin-button secondary" data-close>Закрыть</button><button class="admin-button" data-save>Сохранить инструменты</button></div>
      <p class="admin-inline-message" data-save-message></p>
    </aside>`;
  document.body.append(backdrop);

  const close = () => backdrop.remove();
  backdrop.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', close));
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) close(); });

  const capabilityList = backdrop.querySelector('[data-capability-order-list]');
  const originalOrder = capabilities.map((item) => item.key).join('|');
  const moveCapability = (row, direction) => {
    const sibling = direction < 0 ? row.previousElementSibling : row.nextElementSibling;
    if (!sibling) return;
    if (direction < 0) capabilityList.insertBefore(row, sibling);
    else capabilityList.insertBefore(sibling, row);
  };
  capabilityList?.querySelectorAll('[data-capability-row]').forEach((row) => {
    row.querySelector('[data-capability-up]')?.addEventListener('click', () => moveCapability(row, -1));
    row.querySelector('[data-capability-down]')?.addEventListener('click', () => moveCapability(row, 1));
    row.addEventListener('dragstart', (event) => {
      row.classList.add('is-dragging');
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', row.dataset.capabilityRow || '');
    });
    row.addEventListener('dragend', () => row.classList.remove('is-dragging'));
    row.addEventListener('dragover', (event) => {
      event.preventDefault();
      const dragging = capabilityList.querySelector('.is-dragging');
      if (!dragging || dragging === row) return;
      const rect = row.getBoundingClientRect();
      capabilityList.insertBefore(dragging, event.clientY < rect.top + rect.height / 2 ? row : row.nextSibling);
    });
  });

  backdrop.querySelectorAll('[data-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      button.classList.toggle('is-on');
      button.dataset.current = button.classList.contains('is-on') ? 'true' : 'false';
    });
  });

  backdrop.querySelector('[data-status]')?.addEventListener('click', async () => {
    const next = tenant.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
    try {
      await adminRequest(`/tenants/${encodeURIComponent(tenantId)}/access`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      await refreshData();
      close();
      renderCurrentSection();
    } catch (error) {
      const message = backdrop.querySelector('[data-save-message]');
      message.textContent = error instanceof Error ? error.message : 'Не удалось изменить состояние';
      message.classList.add('error');
    }
  });

  backdrop.querySelector('[data-extend-demo]')?.addEventListener('click', async (event) => {
    const message = backdrop.querySelector('[data-mode-message]');
    event.currentTarget.disabled = true;
    try {
      const result = await adminRequest(`/tenants/${encodeURIComponent(tenantId)}/demo/extend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 14 }),
      });
      message.textContent = `DEMO продлено до ${formatAdminMoment(result.expiresAt)}.`;
      await refreshData();
    } catch (error) {
      message.textContent = error instanceof Error ? error.message : 'Не удалось продлить DEMO';
      message.classList.add('error');
      event.currentTarget.disabled = false;
    }
  });

  backdrop.querySelector('[data-set-live]')?.addEventListener('click', async (event) => {
    const message = backdrop.querySelector('[data-mode-message]');
    event.currentTarget.disabled = true;
    try {
      await adminRequest(`/tenants/${encodeURIComponent(tenantId)}/commercial-mode`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'LIVE' }),
      });
      message.textContent = 'Режим LIVE установлен. Незавершённое первое знакомство продолжится.';
      await refreshData();
    } catch (error) {
      message.textContent = error instanceof Error ? error.message : 'Не удалось изменить режим';
      message.classList.add('error');
      event.currentTarget.disabled = false;
    }
  });

  const technicalEmailForm = backdrop.querySelector('[data-technical-email-form]');
  technicalEmailForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const buttonNode = technicalEmailForm.querySelector('button[type="submit"]');
    const message = technicalEmailForm.querySelector('[data-technical-email-message]');
    const data = new FormData(technicalEmailForm);
    message.textContent = '';
    message.classList.remove('error');
    buttonNode.disabled = true;
    buttonNode.textContent = 'Отправляем…';
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
      buttonNode.disabled = false;
      buttonNode.textContent = 'Отправить письмо';
    }
  });

  backdrop.querySelector('[data-save]')?.addEventListener('click', async () => {
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

    const orderKeys = [...capabilityList.querySelectorAll('[data-capability-row]')].map((row) => row.dataset.capabilityRow);
    const orderChanged = orderKeys.join('|') !== originalOrder;
    const message = backdrop.querySelector('[data-save-message]');
    if (!changes.length && !orderChanged) {
      message.textContent = 'Изменений нет.';
      return;
    }

    try {
      if (changes.length) {
        await adminRequest(`/tenants/${encodeURIComponent(tenantId)}/access`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ capabilities: changes }),
        });
      }
      if (orderChanged) {
        await adminRequest(`/tenants/${encodeURIComponent(tenantId)}/capability-order`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keys: orderKeys }),
        });
      }
      message.textContent = 'Инструменты сохранены.';
      message.classList.remove('error');
      await refreshData();
      window.setTimeout(() => { close(); renderCurrentSection(); }, 300);
    } catch (error) {
      message.textContent = error instanceof Error ? error.message : 'Не удалось сохранить инструменты';
      message.classList.add('error');
    }
  });

  void adminRequest(`/tenants/${encodeURIComponent(tenantId)}/activity`)
    .then((activity) => {
      const host = backdrop.querySelector('[data-activity]');
      if (host) host.innerHTML = activityMarkup(activity);
    })
    .catch((error) => {
      const host = backdrop.querySelector('[data-activity]');
      if (host) host.innerHTML = `<div class="admin-history-empty">${escapeHtml(error instanceof Error ? error.message : 'Не удалось загрузить активность')}</div>`;
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
