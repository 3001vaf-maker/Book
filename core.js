import { renderMain } from './main/main.js';
import { renderJournal } from './journal/journal.js';
import { renderTimetable } from './timetable/timetable.js';
import { renderSettings } from './settings/settings.js';
import { renderChat } from './chat/chat.js';
import { getWorkplaces as getWorkplaceEntities } from './settings/profile/workplaces/data.js';
import { initializeProfileWorkplaces } from './settings/profile/migration.js';
import { initializeBusinessState } from './business-migration.js';
import { initializeOperationalState } from './operational-migration.js';
import { initializeTenantDocumentArchive } from './tenant-document-archive.js';
import { initializeAuxiliaryState } from './auxiliary-migration.js';
import { getJournalTimeUsages, releaseJournalSoftTimeUsages } from './journal/time-usage-source.js';
import { configureWorkplaceSource } from './core/workplace-time.js';
import { configureTimeUsageSource, configureSoftTimeUsageReleaseSource } from './core/time/index.js';
import { getCurrentAccount, login } from './core/auth.js';
import { canUseBookCapability, getBookAccess, loadBookAccess } from './core/access.js';
import { startServerBookingSync } from './online-booking/server-sync.js';
import { renderOnlineBooking } from './online-booking/booking.js';
import { startAccountRuntime } from './online-booking/account-runtime.js';
import { bottomNavigation } from './ui/ui.js';
import { clearLegacyBusinessStorage } from './core/legacy-browser-business.js';
import { FirstRunRuntime, bindDemoBadgeAction, demoBadgeMarkup, startPlatformSessionTracking } from './first-run/runtime.js';
import { startPlatformNotices } from './core/platform-notices.js';
import { requestDemoExtension, requestLiveMode } from './first-run/api.js';

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
let firstRunRuntime = null;
let firstRunState = null;
let disposePlatformSession = () => {};
let demoBadgeTimer = null;
let disposePlatformNotices = () => {};

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

async function renderPublicBooking(route) {
  workspaceReady = false;
  disposeView();
  app.classList.add('app-shell--booking');
  app.innerHTML = '<main class="booking-content" id="app-content"></main>';
  disposeView = await startAccountRuntime(route);
  await renderOnlineBooking(document.querySelector('#app-content'), route);
  syncViewport();
}

function ensureServerBookingSync() {
  if (serverBookingSyncStarted) return;
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
  if (firstRunState?.progress?.status === 'COMPLETED') {
    const updateBadge = () => {
      app.querySelector('[data-first-run-demo-badge]')?.remove();
      const badge = demoBadgeMarkup(firstRunState);
      if (badge) {
        app.insertAdjacentHTML('beforeend', badge);
        bindDemoBadgeAction(app, firstRunState);
      }
    };
    updateBadge();
    if (firstRunState?.commercialMode === 'DEMO') demoBadgeTimer = window.setInterval(updateBadge, 60_000);
  }
  firstRunRuntime?.afterWorkspaceRender();
  syncViewport();
}

function renderMigrationPending() {
  app.classList.remove('app-shell--booking');
  workspaceReady = false;
  disposeView();
  disposeView = () => {};
  app.innerHTML = `
    <main class="auth-view">
      <section class="auth-card">
        <div class="auth-card__heading">
          <h1>Подготовка рабочего пространства</h1>
          <p>Сервер ожидает безопасный перенос данных из основного браузера. Текущие данные не изменены.</p>
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
          <h1>Рабочее пространство временно недоступно</h1>
          <p>Доступ к этому рабочему пространству приостановлен владельцем платформы.</p>
        </div>
      </section>
    </main>`;
  syncViewport();
}


function renderDemoExpired(firstRun) {
  if (demoBadgeTimer) {
    window.clearInterval(demoBadgeTimer);
    demoBadgeTimer = null;
  }
  app.classList.remove('app-shell--booking');
  workspaceReady = false;
  disposeView();
  disposeView = () => {};
  const expiresAt = firstRun?.demo?.expiresAt
    ? new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(firstRun.demo.expiresAt))
    : '';
  app.innerHTML = `
    <main class="first-run-expired">
      <section class="first-run-expired__card">
        <h1>Срок DEMO завершён</h1>
        <p>${firstRun?.progress?.status === 'COMPLETED'
          ? 'Данные и настройки сохранены. Вы можете запросить переход в LIVE или попросить продлить DEMO.'
          : 'Данные и настройки сохранены. Для продолжения знакомства потребуется продление DEMO или включение LIVE администратором.'}</p>
        ${expiresAt ? `<p style="margin-top:12px">DEMO завершено: ${expiresAt}</p>` : ''}
        <div class="first-run-expired__actions">
          ${firstRun?.progress?.status === 'COMPLETED' ? '<button class="ui-button" type="button" data-request-live>Запросить LIVE</button>' : ''}
          <button class="ui-button ui-button--secondary" type="button" data-request-demo-extension>Запросить продление DEMO</button>
        </div>
        <p class="first-run-expired__status" data-request-status></p>
      </section>
    </main>`;
  const status = app.querySelector('[data-request-status]');
  app.querySelector('[data-request-live]')?.addEventListener('click', async (event) => {
    const control = event.currentTarget;
    control.disabled = true;
    if (status) status.textContent = 'Отправляем запрос…';
    try {
      const result = await requestLiveMode();
      if (status) status.textContent = result?.alreadyLive ? 'LIVE уже активен.' : 'Запрос на LIVE отправлен компании.';
      control.textContent = 'Запрос отправлен';
    } catch (error) {
      control.disabled = false;
      if (status) status.textContent = error instanceof Error ? error.message : 'Не удалось отправить запрос';
    }
  });
  app.querySelector('[data-request-demo-extension]')?.addEventListener('click', async (event) => {
    const control = event.currentTarget;
    control.disabled = true;
    if (status) status.textContent = 'Отправляем запрос…';
    try {
      await requestDemoExtension();
      if (status) status.textContent = 'Запрос на продление DEMO отправлен компании.';
      control.textContent = 'Запрос отправлен';
    } catch (error) {
      control.disabled = false;
      if (status) status.textContent = error instanceof Error ? error.message : 'Не удалось отправить запрос';
    }
  });
  syncViewport();
}

function showGuidedWorkspace(section) {
  workspaceReady = true;
  state.activeSection = sectionAllowed(section) ? section : defaultSection();
  history.replaceState({}, '', `#${state.activeSection}`);
  renderWorkspace();
  startRegularPlatformNotices();
}

function startRegularPlatformNotices() {
  disposePlatformNotices();
  disposePlatformNotices = startPlatformNotices({
    onAccessChanged: async () => {
      await loadBookAccess();
      if (getBookAccess().status === 'SUSPENDED') {
        renderSuspended();
        return;
      }
      if (workspaceReady) renderWorkspace();
    },
  });
}

async function renderAuthenticated(account = authenticatedAccount) {
  authenticatedAccount = account || authenticatedAccount;
  const migration = await initializeProfileWorkplaces(authenticatedAccount);
  if (!migration.verified) {
    renderMigrationPending();
    return;
  }
  const businessMigration = await initializeBusinessState(authenticatedAccount);
  if (!businessMigration.verified) {
    renderMigrationPending();
    return;
  }
  const operationalMigration = await initializeOperationalState(authenticatedAccount);
  if (!operationalMigration.verified) {
    renderMigrationPending();
    return;
  }
  const documentMigration = await initializeTenantDocumentArchive(authenticatedAccount);
  if (!documentMigration.verified) {
    renderMigrationPending();
    return;
  }
  const auxiliaryMigration = await initializeAuxiliaryState(authenticatedAccount);
  if (!auxiliaryMigration.verified) {
    renderMigrationPending();
    return;
  }
  clearLegacyBusinessStorage();
  await loadBookAccess();
  if (getBookAccess().status === 'SUSPENDED') {
    renderSuspended();
    return;
  }
  ensureServerBookingSync();

  firstRunRuntime?.dispose();
  firstRunRuntime = null;
  disposePlatformNotices();
  disposePlatformNotices = () => {};
  disposePlatformSession();
  disposePlatformSession = () => {};

  const candidateRuntime = new FirstRunRuntime({
    app,
    accountEmail: authenticatedAccount?.account?.email || '',
    getActiveSection: () => state.activeSection,
    showWorkspace: showGuidedWorkspace,
    onStateChange: (nextState) => { firstRunState = nextState; },
    onFinished: (nextState) => {
      firstRunState = nextState || firstRunState;
      state.activeSection = defaultSection();
      history.replaceState({}, '', `#${state.activeSection}`);
      renderWorkspace();
      startRegularPlatformNotices();
    },
  });

  try {
    firstRunState = await candidateRuntime.load();
  } catch {
    firstRunState = null;
  }

  if (firstRunState?.assigned) {
    if (firstRunState.commercialMode === 'DEMO' && firstRunState.demo?.expired) {
      candidateRuntime.dispose();
      disposePlatformSession = await startPlatformSessionTracking();
      renderDemoExpired(firstRunState);
      return;
    }

    if (firstRunState.progress?.status === 'IN_PROGRESS') {
      firstRunRuntime = candidateRuntime;
      workspaceReady = false;
      history.replaceState({}, '', location.pathname);
      await firstRunRuntime.start();
      syncViewport();
      return;
    }

    candidateRuntime.dispose();
    disposePlatformSession = await startPlatformSessionTracking();
    const requested = location.hash.slice(1);
    state.activeSection = sectionAllowed(requested) ? requested : defaultSection();
    history.replaceState({}, '', `#${state.activeSection}`);
    renderWorkspace();
    startRegularPlatformNotices();
    return;
  }

  candidateRuntime.dispose();
  disposePlatformSession = await startPlatformSessionTracking();

  const requested = location.hash.slice(1);
  state.activeSection = sectionAllowed(requested) ? requested : defaultSection();
  history.replaceState({}, '', `#${state.activeSection}`);
  renderWorkspace();
  startRegularPlatformNotices();
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
          <h1>Рабочее пространство</h1>
          <p>Вход в систему</p>
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
          <p class="auth-error" id="auth-error" role="alert">${message}</p>
          <button class="ui-button" type="submit">Войти</button>
        </form>
      </section>
    </main>`;

  const form = app.querySelector('#auth-form');
  const error = app.querySelector('#auth-error');
  const button = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    error.textContent = '';
    button.disabled = true;
    button.textContent = 'Входим…';
    const data = new FormData(form);

    try {
      const account = await login(data.get('email'), data.get('password'));
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
  await renderPublicBooking(publicBooking);
} else {
  try {
    const currentAccount = await getCurrentAccount();
    if (currentAccount) {
      authenticatedAccount = currentAccount;
      await renderAuthenticated(currentAccount);
    } else {
      renderLogin();
    }
  } catch {
    renderLogin('Сервер временно недоступен');
  }
}
