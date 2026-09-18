import { renderMain } from './main/main.js';
import { renderJournal } from './journal/journal.js';
import { renderTimetable } from './timetable/timetable.js';
import { renderSettings } from './settings/settings.js';
import { renderChat } from './chat/chat.js';
import { getWorkplaces as getWorkplaceEntities } from './settings/profile/workplaces/data.js';
import { initializeProfileWorkplaces } from './settings/profile/migration.js';
import { initializeBusinessState } from './business-migration.js';
import { initializeOperationalState } from './operational-migration.js';
import { initializeDocumentState } from './document-migration.js';
import { initializeAuxiliaryState } from './auxiliary-migration.js';
import { getJournalTimeUsages, releaseJournalSoftTimeUsages } from './journal/time-usage-source.js';
import { configureWorkplaceSource } from './core/workplace-time.js';
import { configureTimeUsageSource, configureSoftTimeUsageReleaseSource } from './core/time/index.js';
import { apiRequest, getCurrentUser, login } from './core/auth.js';
import { canUseBookCapability, getBookAccess, loadBookAccess } from './core/access.js';
import { isOnboardingComplete, renderOnboarding } from './onboarding/onboarding.js';
import { startServerBookingSync } from './online-booking/server-sync.js';
import { renderOnlineBooking } from './online-booking/booking.js';
import { startBookingClientRuntime } from './online-booking/client-runtime.js';
import { bottomNavigation } from './ui/ui.js';
import { clearLegacyBusinessStorage } from './core/legacy-browser-business.js';

configureWorkplaceSource(getWorkplaceEntities);
configureTimeUsageSource(getJournalTimeUsages);
configureSoftTimeUsageReleaseSource(releaseJournalSoftTimeUsages);

const routes = {
  main: renderMain,
  timetable: renderTimetable,
  journal: renderJournal,
  chat: renderChat,
  settings: renderSettings,
};

const sectionCapabilities = {
  timetable: 'timetable.access',
  journal: 'journal.access',
  chat: 'chat.access',
};

const state = { activeSection: 'main' };
const app = document.querySelector('#app');
let disposeView = () => {};
let workspaceReady = false;
let authenticatedAccount = null;
let serverBookingSyncStarted = false;

function syncViewport() {
  const vv = window.visualViewport;
  const height = vv?.height || window.innerHeight;
  const width = vv?.width || window.innerWidth;
  document.documentElement.style.setProperty('--visual-vh', `${height}px`);
  document.documentElement.style.setProperty('--visual-vw', `${width}px`);
  document.documentElement.classList.toggle('keyboard-open', vv ? height < window.innerHeight * 0.78 : false);
}

function bookingRoute() {
  const params = new URLSearchParams(location.search);
  const tenantId = String(params.get('booking') || '').trim();
  if (!tenantId) return null;
  return {
    tenantId,
    workplaceKey: String(params.get('workplace') || '').trim(),
    telegramEntry: String(params.get('tg_entry') || '').trim(),
  };
}

function renderPublicBooking(route) {
  workspaceReady = false;
  disposeView();
  disposeView = startBookingClientRuntime(route);
  app.classList.add('app-shell--booking');
  app.innerHTML = '<main class="booking-content" id="app-content"></main>';
  void renderOnlineBooking(document.querySelector('#app-content'), route);
  syncViewport();
}

function ensureServerBookingSync() {
  if (serverBookingSyncStarted || !canUseBookCapability('online_booking.access')) return;
  serverBookingSyncStarted = true;
  startServerBookingSync();
}

function sectionAllowed(section) {
  if (!routes[section]) return false;
  const capability = sectionCapabilities[section];
  return capability ? canUseBookCapability(capability) : true;
}

function allowedSections() {
  return Object.keys(routes).filter(sectionAllowed);
}

function defaultSection() {
  if (sectionAllowed('main')) return 'main';
  if (sectionAllowed('journal')) return 'journal';
  if (sectionAllowed('timetable')) return 'timetable';
  return 'settings';
}

function navigate(section) {
  if (!workspaceReady || !sectionAllowed(section)) return;
  state.activeSection = section;
  renderWorkspace();
  history.replaceState({}, '', `#${section}`);
}

function renderWorkspace() {
  app.classList.remove('app-shell--booking');
  workspaceReady = true;
  disposeView();
  disposeView = () => {};
  if (!sectionAllowed(state.activeSection)) state.activeSection = defaultSection();
  const view = routes[state.activeSection];
  app.innerHTML = `<main class="app-content" id="app-content"></main>${bottomNavigation(state.activeSection, allowedSections())}`;
  const nextDispose = view(document.querySelector('#app-content'), { navigate });
  if (typeof nextDispose === 'function') disposeView = nextDispose;
  app.querySelectorAll('[data-nav]').forEach((button) => {
    button.addEventListener('click', () => navigate(button.dataset.nav));
  });
  syncViewport();
}

function renderServerStatePending() {
  app.classList.remove('app-shell--booking');
  workspaceReady = false;
  disposeView();
  disposeView = () => {};
  app.innerHTML = `
    <main class="auth-view">
      <section class="auth-card">
        <div class="auth-card__heading">
          <h1>Book</h1>
          <p>Серверное состояние Book не подтверждено. Данные из браузера не используются.</p>
        </div>
      </section>
    </main>`;
  syncViewport();
}

function renderSuspended() {
  app.classList.remove('app-shell--booking');
  workspaceReady = false;
  disposeView();
  disposeView = () => {};
  app.innerHTML = `
    <main class="auth-view">
      <section class="auth-card">
        <div class="auth-card__heading">
          <h1>Book временно недоступен</h1>
          <p>Доступ к этому рабочему пространству приостановлен владельцем платформы.</p>
        </div>
      </section>
    </main>`;
  syncViewport();
}


const MASTER_LEGAL_DOCUMENTS = [
  { key: 'privacy-policy', type: 'PRIVACY_POLICY', title: 'Политика обработки персональных данных мастера', requiredForLive: true, requiredForPublicBooking: true },
  { key: 'client-pd-consent', type: 'CLIENT_PD_CONSENT', title: 'Согласие клиента на обработку персональных данных', requiredForLive: true, requiredForPublicBooking: true },
  { key: 'service-offer', type: 'SERVICE_OFFER', title: 'Условия оказания услуг / договор-оферта мастера', requiredForLive: true, requiredForPublicBooking: true },
  { key: 'marketing-consent', type: 'MARKETING_CONSENT', title: 'Согласие клиента на рекламные и маркетинговые сообщения', requiredForLive: false, requiredForPublicBooking: true },
];

const MASTER_LEGAL_CHECKLIST_LABELS = {
  operatorIdentityConfigured: 'Реквизиты оператора зафиксированы',
  privacyPolicyPublished: 'Политика обработки ПД опубликована',
  clientDocumentsPrepared: 'Документы для клиентов подготовлены',
  dpaAccepted: 'Поручение Book на обработку ПД (DPA) принято',
};

async function tenantLegalRequest(path, options = {}) {
  const response = await apiRequest(`/legal${path}`, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || 'Ошибка юридической подготовки');
  return payload;
}

function masterLegalDocumentByKey(readiness, key) {
  return (Array.isArray(readiness?.documents) ? readiness.documents : []).find((item) => item.key === key) || null;
}

function masterLegalIdentity(readiness) {
  for (const document of Array.isArray(readiness?.documents) ? readiness.documents : []) {
    const identity = document?.currentVersion?.operatorIdentitySnapshot;
    if (identity && typeof identity === 'object' && Object.keys(identity).length) return identity;
  }
  return {};
}

async function syncMasterLegalChecklist(readiness) {
  const documents = Array.isArray(readiness?.documents) ? readiness.documents : [];
  const keys = new Set(documents.filter((item) => item.currentVersion).map((item) => item.key));
  const identity = masterLegalIdentity(readiness);
  const patch = {
    operatorIdentityConfigured: Boolean(String(identity.name || '').trim()),
    privacyPolicyPublished: keys.has('privacy-policy'),
    clientDocumentsPrepared: ['privacy-policy', 'client-pd-consent', 'service-offer'].every((key) => keys.has(key)),
  };
  const current = readiness?.state?.checklist || {};
  const changed = Object.entries(patch).some(([key, value]) => current[key] !== value);
  return changed ? tenantLegalRequest('/checklist', { method: 'PUT', body: JSON.stringify({ checklist: patch }) }) : readiness;
}

function renderMasterLegalSetup(account, readiness) {
  workspaceReady = false;
  disposeView();
  disposeView = () => {};
  app.classList.remove('app-shell--booking');
  const legalState = readiness?.state || {};
  const checklist = legalState.checklist && typeof legalState.checklist === 'object' ? legalState.checklist : {};
  const documents = Array.isArray(readiness?.documents) ? readiness.documents : [];
  const identity = masterLegalIdentity(readiness);
  const filing = legalState.filingStatus || 'NOT_PREPARED';

  app.innerHTML = `
    <main class="auth-view" style="align-items:flex-start;padding:24px 12px;overflow:auto">
      <section class="auth-card" style="width:min(760px,100%);max-width:760px">
        <div class="auth-card__heading">
          <h1>Юридическая готовность Book</h1>
          <p>Режим: <strong>${escapeHtmlText(legalState.operationMode || 'DEMO')}</strong>. До LIVE рабочая часть Book закрыта.</p>
        </div>

        <section style="display:grid;gap:10px;margin-top:18px">
          <h2 style="font-size:18px;margin:0">1. Реквизиты оператора</h2>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px">
            <label class="field"><span>Оператор / ИП</span><input data-legal-identity="name" value="${escapeHtmlText(identity.name || '')}"></label>
            <label class="field"><span>ИНН</span><input data-legal-identity="inn" value="${escapeHtmlText(identity.inn || '')}"></label>
            <label class="field"><span>ОГРНИП</span><input data-legal-identity="ogrnip" value="${escapeHtmlText(identity.ogrnip || '')}"></label>
            <label class="field"><span>Email</span><input data-legal-identity="email" type="email" value="${escapeHtmlText(identity.email || account?.user?.email || '')}"></label>
            <label class="field"><span>Телефон</span><input data-legal-identity="phone" value="${escapeHtmlText(identity.phone || '')}"></label>
            <label class="field"><span>Адрес</span><input data-legal-identity="address" value="${escapeHtmlText(identity.address || '')}"></label>
          </div>
        </section>

        <section style="display:grid;gap:10px;margin-top:22px">
          <h2 style="font-size:18px;margin:0">2. Документы мастера</h2>
          ${MASTER_LEGAL_DOCUMENTS.map((preset) => {
            const document = masterLegalDocumentByKey(readiness, preset.key);
            const version = document?.currentVersion;
            return `<button class="ui-button" style="justify-content:space-between" data-master-legal-doc="${escapeHtmlText(preset.key)}"><span>${escapeHtmlText(preset.title)}</span><span>${version ? `v${Number(version.version || 1)}` : 'добавить'}</span></button>`;
          }).join('')}
          <div data-master-legal-editor></div>
        </section>

        <section style="display:grid;gap:8px;margin-top:22px">
          <h2 style="font-size:18px;margin:0">3. Готовность</h2>
          ${(readiness?.checklistKeys || []).map((key) => `<label style="display:flex;gap:9px;align-items:center"><input type="checkbox" data-master-check="${escapeHtmlText(key)}" ${checklist[key] === true ? 'checked' : ''} disabled><span>${escapeHtmlText(MASTER_LEGAL_CHECKLIST_LABELS[key] || key)}</span></label>`).join('')}
          <p class="auth-error" data-master-legal-message></p>
        </section>

        <section style="display:grid;gap:10px;margin-top:22px">
          <h2 style="font-size:18px;margin:0">4. Роскомнадзор</h2>
          ${filing === 'SUBMITTED'
            ? `<p style="margin:0">Подача зафиксирована: ${escapeHtmlText(legalState.submissionReference || '—')}</p>`
            : `<form data-master-submitted-form style="display:grid;gap:10px">
                <label class="field"><span>Регистрационный номер / подтверждение подачи</span><input name="submissionReference" required></label>
                <button class="ui-button" type="submit">Сохранить и начать работу</button>
              </form>`}
        </section>
      </section>
    </main>`;

  app.querySelectorAll('[data-master-legal-doc]').forEach((button) => {
    button.addEventListener('click', () => renderMasterLegalDocumentEditor(account, readiness, button.dataset.masterLegalDoc));
  });

  app.querySelector('[data-master-submitted-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = app.querySelector('[data-master-legal-message]');
    const data = new FormData(event.currentTarget);
    try {
      const next = await tenantLegalRequest('/filing/submitted', {
        method: 'POST',
        body: JSON.stringify({
          submissionReference: String(data.get('submissionReference') || '').trim(),
          evidenceMetadata: { source: 'user-rkn-entry' },
        }),
      });
      if (next?.state?.operationMode !== 'LIVE') throw new Error('После данных Роскомнадзора рабочий режим не включился');
      await renderAuthenticated(account);
    } catch (error) {
      message.textContent = error instanceof Error ? error.message : 'Не удалось завершить подготовку';
    }
  });

  syncViewport();
}

function escapeHtmlText(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  })[char]);
}

function renderMasterLegalDocumentEditor(account, readiness, key) {
  const preset = MASTER_LEGAL_DOCUMENTS.find((item) => item.key === key);
  if (!preset) return;
  const document = masterLegalDocumentByKey(readiness, key);
  const current = document?.currentVersion || null;
  const editor = app.querySelector('[data-master-legal-editor]');
  if (!editor) return;
  editor.innerHTML = `
    <form data-master-document-form style="display:grid;gap:10px;padding:14px;border:1px solid #ddd;border-radius:12px">
      <strong>${escapeHtmlText(preset.title)}</strong>
      <label class="field"><span>Название</span><input name="title" value="${escapeHtmlText(document?.title || preset.title)}" required></label>
      <label class="field"><span>Текст документа</span><textarea name="content" rows="16" required>${escapeHtmlText(current?.contentSnapshot || '')}</textarea></label>
      <p class="auth-error" data-master-document-message></p>
      <button class="ui-button" type="submit">Опубликовать версию</button>
    </form>`;
  const form = editor.querySelector('[data-master-document-form]');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = form.querySelector('[data-master-document-message]');
    const data = new FormData(form);
    const identity = {};
    app.querySelectorAll('[data-legal-identity]').forEach((input) => {
      identity[input.dataset.legalIdentity] = String(input.value || '').trim();
    });
    if (!String(identity.name || '').trim()) {
      message.textContent = 'Укажите оператора / ИП.';
      return;
    }
    try {
      await tenantLegalRequest('/documents', {
        method: 'POST',
        body: JSON.stringify({
          key: preset.key,
          type: preset.type,
          title: String(data.get('title') || preset.title),
          content: String(data.get('content') || ''),
          operatorIdentity: identity,
          requiredForRegistration: false,
          requiredForLive: preset.requiredForLive,
          requiredForPublicBooking: preset.requiredForPublicBooking,
        }),
      });
      let next = await tenantLegalRequest('/readiness');
      next = await syncMasterLegalChecklist(next);
      renderMasterLegalSetup(account, next);
    } catch (error) {
      message.textContent = error instanceof Error ? error.message : 'Не удалось опубликовать документ';
    }
  });
}

async function renderAuthenticated(account = authenticatedAccount) {
  authenticatedAccount = account || authenticatedAccount;

  let access;
  try {
    access = await loadBookAccess();
  } catch {
    renderServerStatePending();
    return;
  }

  if (access.status === 'SUSPENDED') {
    renderSuspended();
    return;
  }

  if (access.isOwnerBook !== true) {
    try {
      let legalReadiness = await tenantLegalRequest('/readiness');
      legalReadiness = await syncMasterLegalChecklist(legalReadiness);
      if (legalReadiness?.state?.operationMode !== 'LIVE') {
        renderMasterLegalSetup(authenticatedAccount, legalReadiness);
        return;
      }
    } catch {
      renderServerStatePending();
      return;
    }
  }

  const migration = await initializeProfileWorkplaces(authenticatedAccount);
  if (!migration.verified) {
    renderServerStatePending();
    return;
  }
  const businessMigration = await initializeBusinessState(authenticatedAccount);
  if (!businessMigration.verified) {
    renderServerStatePending();
    return;
  }
  const operationalMigration = await initializeOperationalState(authenticatedAccount);
  if (!operationalMigration.verified) {
    renderServerStatePending();
    return;
  }
  const documentMigration = await initializeDocumentState(authenticatedAccount);
  if (!documentMigration.verified) {
    renderServerStatePending();
    return;
  }
  const auxiliaryMigration = await initializeAuxiliaryState(authenticatedAccount);
  if (!auxiliaryMigration.verified) {
    renderServerStatePending();
    return;
  }
  clearLegacyBusinessStorage();
  ensureServerBookingSync();

  const serverWorkspaceUnlocked = Boolean(authenticatedAccount?.user?.workspaceUnlocked);
  if (access.isOwnerBook !== true && !serverWorkspaceUnlocked && !isOnboardingComplete()) {
    workspaceReady = false;
    history.replaceState({}, '', location.pathname);
    await renderOnboarding(app, {
      accountEmail: authenticatedAccount?.user?.email || '',
      onComplete: () => {
        state.activeSection = defaultSection();
        history.replaceState({}, '', `#${state.activeSection}`);
        renderWorkspace();
      },
    });
    syncViewport();
    return;
  }

  const requested = location.hash.slice(1);
  state.activeSection = sectionAllowed(requested) ? requested : defaultSection();
  history.replaceState({}, '', `#${state.activeSection}`);
  renderWorkspace();
}

function renderLogin(message = '') {
  app.classList.remove('app-shell--booking');
  workspaceReady = false;
  disposeView();
  disposeView = () => {};
  app.innerHTML = `
    <main class="auth-view">
      <section class="auth-card" aria-labelledby="auth-title">
        <div class="auth-card__heading">
          <h1>Book</h1>
          <p>Вход в рабочее пространство</p>
        </div>
        <form class="auth-form" id="auth-form">
          <label class="field">
            <span>Email</span>
            <input name="email" type="email" autocomplete="username" required>
          </label>
          <label class="field">
            <span>Пароль</span>
            <input name="password" type="password" autocomplete="current-password" required>
          </label>
          <label style="display:flex;align-items:center;gap:9px;font-size:14px;font-weight:600"><input name="showPassword" type="checkbox" style="width:18px;height:18px">Показать пароль</label>
          <label style="display:flex;align-items:center;gap:9px;font-size:14px;font-weight:600"><input name="remember" type="checkbox" checked style="width:18px;height:18px">Запомнить меня на этом устройстве</label>
          <p class="auth-error" id="auth-error" role="alert">${message}</p>
          <button class="ui-button" type="submit">Войти</button>
        </form>
      </section>
    </main>`;

  const form = app.querySelector('#auth-form');
  const error = app.querySelector('#auth-error');
  const button = form.querySelector('button[type="submit"]');
  const passwordInput = form.querySelector('input[name="password"]');
  const showPassword = form.querySelector('input[name="showPassword"]');

  showPassword.addEventListener('change', () => {
    passwordInput.type = showPassword.checked ? 'text' : 'password';
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    error.textContent = '';
    button.disabled = true;
    button.textContent = 'Входим…';
    const data = new FormData(form);

    try {
      const account = await login(
        data.get('email'),
        data.get('password'),
        data.get('remember') === 'on',
      );
      authenticatedAccount = account;
      await renderAuthenticated(account);
    } catch (loginError) {
      error.textContent = loginError instanceof Error ? loginError.message : 'Не удалось войти';
      button.disabled = false;
      button.textContent = 'Войти';
    }
  });

  syncViewport();
}

window.addEventListener('book:access-updated', (event) => {
  if (!workspaceReady || !event?.detail?.changed) return;
  if (getBookAccess().status === 'SUSPENDED') {
    renderSuspended();
    return;
  }
  ensureServerBookingSync();
  renderWorkspace();
  history.replaceState({}, '', `#${state.activeSection}`);
});

window.addEventListener('hashchange', () => {
  if (!workspaceReady) return;
  const section = location.hash.slice(1);
  if (sectionAllowed(section)) {
    state.activeSection = section;
    renderWorkspace();
  } else {
    history.replaceState({}, '', `#${state.activeSection}`);
  }
});
window.addEventListener('resize', syncViewport, { passive: true });
window.visualViewport?.addEventListener('resize', syncViewport, { passive: true });
window.visualViewport?.addEventListener('scroll', syncViewport, { passive: true });

document.addEventListener('focusin', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (!target.matches('input, select, textarea')) return;
  window.setTimeout(() => target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' }), 120);
}, { passive: true });

syncViewport();

const publicBooking = bookingRoute();
if (publicBooking) {
  renderPublicBooking(publicBooking);
} else {
  try {
    const currentUser = await getCurrentUser();
    if (currentUser) {
      authenticatedAccount = currentUser;
      await renderAuthenticated(currentUser);
    } else {
      renderLogin();
    }
  } catch {
    renderLogin('Сервер временно недоступен');
  }
}
