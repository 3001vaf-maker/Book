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
import { BOOK_APP_ORIGIN, CLIENT_APP_ORIGIN } from './core/environment.js';
import { canUseCapability, getAccess, loadAccess } from './core/access.js';
import { startServerBookingSync } from './online-booking/server-sync.js';
import { renderOnlineBooking } from './online-booking/booking.js';
import { startBookingClientRuntime } from './online-booking/client-runtime.js';
import { bottomNavigation, modal, mountModal, button, actionBlock, escapeHtml } from './ui/ui.js';
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
let pendingSettingsFolder = '';
let documentSyncRunning = false;
let documentSyncPending = false;

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

function runtimeHostname() {
  return String(location.hostname || '').trim().toLowerCase();
}

function isLocalBookingHost() {
  const host = runtimeHostname();
  return host === 'localhost'
    || host === '127.0.0.1'
    || host === '::1'
    || host.endsWith('.app.github.dev');
}

function renderClientLinkMissing() {
  workspaceReady = false;
  disposeView();
  disposeView = () => {};
  app.classList.add('app-shell--booking');
  app.innerHTML = `
    <main class="auth-view">
      <section class="auth-card">
        <div class="auth-card__heading">
          <h1>Book</h1>
          <p>Ссылка клиента неполная или недействительна.</p>
        </div>
      </section>
    </main>`;
  syncViewport();
}

function redirectBookingToClient() {
  const target = new URL(CLIENT_APP_ORIGIN);
  target.search = location.search;
  target.hash = location.hash;
  location.replace(target.toString());
}

function ensureServerBookingSync() {
  if (serverBookingSyncStarted || !canUseCapability('online_booking.access')) return;
  serverBookingSyncStarted = true;
  startServerBookingSync();
}

function sectionAllowed(section) {
  if (!routes[section]) return false;
  const capability = sectionCapabilities[section];
  return capability ? canUseCapability(capability) : true;
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
  const requestedFolder = state.activeSection === 'settings' ? pendingSettingsFolder : '';
  pendingSettingsFolder = '';
  const nextDispose = view(document.querySelector('#app-content'), { navigate, openFolder: requestedFolder });
  if (typeof nextDispose === 'function') disposeView = nextDispose;
  app.querySelectorAll('[data-nav]').forEach((navButton) => {
    navButton.addEventListener('click', () => navigate(navButton.dataset.nav));
  });
  syncViewport();
}

async function reportStartupFailure(stage, error) {
  const message = error instanceof Error ? error.message : String(error || 'unknown');
  console.error(`[workspace startup] ${stage} failed`, error);
  try {
    await apiRequest('/auth/startup-diagnostic', {
      method: 'POST',
      body: JSON.stringify({ stage, message }),
    });
  } catch {
    // Diagnostics must never block the workspace or replace the original startup error.
  }
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
          <h1>Book временно не загрузился</h1>
          <p>Не удалось получить данные Book с сервера. Подождите несколько секунд и попробуйте ещё раз.</p>
        </div>
        <button class="ui-button" type="button" data-retry-server-state>Повторить</button>
      </section>
    </main>`;
  app.querySelector('[data-retry-server-state]')?.addEventListener('click', () => void renderAuthenticated());
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


function openSettingsTarget(folder) {
  state.activeSection = 'settings';
  pendingSettingsFolder = folder;
  renderWorkspace();
  history.replaceState({}, '', '#settings');
}

function closeModal(node) {
  node?.closest('.modal-backdrop')?.remove();
}

async function syncDocumentsFromProfileContext() {
  if (!authenticatedAccount) return;
  if (documentSyncRunning) {
    documentSyncPending = true;
    return;
  }
  documentSyncRunning = true;
  try {
    const result = await initializeDocumentState(authenticatedAccount);
    if (result?.source === 'server-reconciled') {
      const notice = mountModal(document.body, modal(`
        <div class="modal-title"><h2>Документы обновлены</h2><p>Система сформировала актуальную версию документов из данных профиля.</p></div>
        ${actionBlock(button('Понятно', { data: 'data-doc-sync-done' }))}
      `, { variant: 'compact', surface: 'app' }));
      notice?.querySelector('[data-doc-sync-done]')?.addEventListener('click', () => notice.remove());
    }
  } catch {
    // Profile saving must not be rolled back by a temporary document refresh error.
  } finally {
    documentSyncRunning = false;
    if (documentSyncPending) {
      documentSyncPending = false;
      queueMicrotask(() => void syncDocumentsFromProfileContext());
    }
  }
}

async function hydrateWorkspaceDataAfterOpen() {
  const stages = [
    ['business', () => initializeBusinessState(authenticatedAccount)],
    ['operational', () => initializeOperationalState(authenticatedAccount)],
    ['documents', () => initializeDocumentState(authenticatedAccount)],
    ['auxiliary', () => initializeAuxiliaryState(authenticatedAccount)],
  ];

  let hydrated = false;
  for (const [stage, run] of stages) {
    try {
      const result = await run();
      if (!result?.verified) throw new Error(`${stage} state not verified`);
      hydrated = true;
    } catch (error) {
      await reportStartupFailure(stage, error);
    }
  }

  if (workspaceReady && hydrated) renderWorkspace();
}

async function renderAuthenticated(account = authenticatedAccount) {
  authenticatedAccount = account || authenticatedAccount;

  let access;
  try {
    access = await loadAccess();
  } catch (error) {
    await reportStartupFailure('access', error);
    renderServerStatePending();
    return;
  }

  if (access.status === 'SUSPENDED') {
    renderSuspended();
    return;
  }

  try {
    const profileResult = await initializeProfileWorkplaces(authenticatedAccount);
    if (!profileResult?.verified) throw new Error('profile state not verified');
  } catch (error) {
    await reportStartupFailure('profile', error);
    renderServerStatePending();
    return;
  }

  clearLegacyBusinessStorage();

  const requested = location.hash.slice(1);
  state.activeSection = sectionAllowed(requested) ? requested : defaultSection();
  history.replaceState({}, '', `#${state.activeSection}`);
  renderWorkspace();
  ensureServerBookingSync();
  void hydrateWorkspaceDataAfterOpen();
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

window.addEventListener('book:profile-context-updated', () => {
  void syncDocumentsFromProfileContext();
});

window.addEventListener('workspace:access-updated', (event) => {
  if (!workspaceReady || !event?.detail?.changed) return;
  if (getAccess().status === 'SUSPENDED') {
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
const host = runtimeHostname();
const bookHost = new URL(BOOK_APP_ORIGIN).hostname;
const clientHost = new URL(CLIENT_APP_ORIGIN).hostname;

if (host === clientHost) {
  if (publicBooking) renderPublicBooking(publicBooking);
  else renderClientLinkMissing();
} else if (host === bookHost && publicBooking) {
  redirectBookingToClient();
} else if (isLocalBookingHost() && publicBooking) {
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
