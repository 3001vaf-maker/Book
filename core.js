import { renderPeople } from './main/people/people.js';
import { financeNavigationItems, renderFinanceSection } from './main/finance/finance.js';
import { journalNavigationItems, renderJournalView } from './journal/journal.js';
import { renderTimetable } from './timetable/timetable.js';
import { settingsNavigationItems, renderSettingsSection } from './settings/settings.js';
import { render as renderProfile } from './settings/profile/profile.js';
import { renderChat } from './chat/chat.js';
import { getWorkplaces as getWorkplaceEntities } from './settings/profile/workplaces/data.js';
import { initializeProfileWorkplaces } from './settings/profile/migration.js';
import { initializeBusinessState } from './business-migration.js';
import { initializeOperationalState } from './operational-migration.js';
import { ensureRknGuide, initializeTenantDocumentArchive, refreshTenantDocumentArchive } from './tenant-document-archive.js';
import { initializeAuxiliaryState } from './auxiliary-migration.js';
import { getJournalTimeUsages, releaseJournalSoftTimeUsages } from './journal/time-usage-source.js';
import { configureWorkplaceSource } from './core/workplace-time.js';
import { configureTimeUsageSource, configureSoftTimeUsageReleaseSource } from './core/time/index.js';
import { getCurrentAccount, login } from './core/auth.js';
import { canUseBookCapability, getBookAccess, loadBookAccess } from './core/access.js';
import { startServerBookingSync } from './online-booking/server-sync.js';
import { renderOnlineBooking } from './online-booking/booking.js';
import { startAccountRuntime } from './online-booking/account-runtime.js';
import { initV2DeckSwipe, initV2Swipe, v2FDeck, v2Header, v2Shell } from './ui/ui.js';
import { clearLegacyBusinessStorage } from './core/legacy-browser-business.js';
import { FirstRunRuntime, bindDemoBadgeAction, demoBadgeMarkup, startPlatformSessionTracking } from './first-run/runtime.js';
import { startPlatformNotices } from './core/platform-notices.js';
import { requestDemoExtension, requestLiveMode } from './first-run/api.js';

configureWorkplaceSource(getWorkplaceEntities);
configureTimeUsageSource(getJournalTimeUsages);
configureSoftTimeUsageReleaseSource(releaseJournalSoftTimeUsages);

const ROOT_SECTIONS = [
  { id: 'people', label: 'Клиенты', capability: 'people.access' },
  { id: 'finance', label: 'Финансы', capability: 'finance.access' },
  { id: 'timetable', label: 'График', capability: 'timetable.access' },
  { id: 'journal', label: 'Журнал', capability: 'journal.access' },
  { id: 'profile', label: 'Профиль', capability: 'profile.access' },
  { id: 'settings', label: 'Настройки', capability: '' },
];

const state = {
  activeSection: 'people',
  lastRootSection: 'people',
  navigationOpen: false,
  secondary: {
    finance: 'cash',
    journal: 'day',
    settings: 'service',
  },
};
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
let rknGuideSyncTimer = null;
let workspaceRenderVersion = 0;

async function syncRknGuideIfReady() {
  if (!authenticatedAccount) return false;
  const result = await ensureRknGuide();
  if (!result?.ready) return false;
  await refreshTenantDocumentArchive();
  return true;
}

function scheduleRknGuideSync() {
  if (!authenticatedAccount) return;
  if (rknGuideSyncTimer) window.clearTimeout(rknGuideSyncTimer);
  rknGuideSyncTimer = window.setTimeout(() => {
    rknGuideSyncTimer = null;
    void syncRknGuideIfReady().catch((error) => {
      console.error('RKN guide sync failed', error);
    });
  }, 700);
}

window.addEventListener('book:profile-changed', scheduleRknGuideSync);
window.addEventListener('book:server-mutation-completed', (event) => {
  const scopes = Array.isArray(event?.detail?.scopes) ? event.detail.scopes : [];
  if (scopes.includes('operational')) scheduleRknGuideSync();
});

function syncViewport() {
  const vv = window.visualViewport;
  const height = vv?.height || window.innerHeight;
  const width = vv?.width || window.innerWidth;
  document.documentElement.style.setProperty('--visual-vh', `${height}px`);
  document.documentElement.style.setProperty('--visual-vw', `${width}px`);
  document.documentElement.classList.toggle('keyboard-open', vv ? height < window.innerHeight * 0.78 : false);
}

function setThemeColor(value) {
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', value);
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
  setThemeColor('#2F3338');
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

function rootDefinition(section) {
  return ROOT_SECTIONS.find((item) => item.id === section) || null;
}

function sectionAllowed(section) {
  if (section === 'chat') return canUseBookCapability('chat.access');
  const item = rootDefinition(section);
  return Boolean(item && (!item.capability || canUseBookCapability(item.capability)));
}

function allowedSections() {
  return ROOT_SECTIONS.filter((item) => sectionAllowed(item.id)).map((item) => item.id);
}

function allowedRootItems() {
  return ROOT_SECTIONS.filter((item) => sectionAllowed(item.id)).map(({ id, label }) => ({ id, label }));
}

function defaultSection() {
  return allowedSections()[0] || 'settings';
}

function normalizeRequestedSection(section) {
  const value = String(section || '').trim();
  if (value === 'main') {
    if (sectionAllowed('people')) return 'people';
    if (sectionAllowed('finance')) return 'finance';
    return defaultSection();
  }
  return value;
}

function activeRootSection() {
  return state.activeSection === 'chat' ? state.lastRootSection : state.activeSection;
}

function secondaryItems(section = activeRootSection()) {
  if (section === 'finance') return financeNavigationItems();
  if (section === 'journal') return journalNavigationItems();
  if (section === 'settings') return settingsNavigationItems();
  return [];
}

function ensureSecondary(section) {
  const items = secondaryItems(section);
  if (!items.length) return '';
  const selected = String(state.secondary[section] || '');
  if (items.some((item) => item.id === selected)) return selected;
  state.secondary[section] = items[0].id;
  return items[0].id;
}

function setNavigationOpen(open) {
  state.navigationOpen = Boolean(open);
  app.querySelector('[data-v2-app]')?.classList.toggle('is-deck-open', state.navigationOpen);
}

function navigate(section, { navigationOpen = state.navigationOpen, updateHash = true } = {}) {
  if (!workspaceReady) return;
  const next = normalizeRequestedSection(section);
  if (!sectionAllowed(next)) return;
  if (next === 'chat') {
    if (state.activeSection !== 'chat') state.lastRootSection = activeRootSection();
    state.activeSection = 'chat';
    state.navigationOpen = false;
  } else {
    state.activeSection = next;
    state.lastRootSection = next;
    state.navigationOpen = Boolean(navigationOpen);
    ensureSecondary(next);
  }
  renderWorkspace();
  if (updateHash) history.replaceState({}, '', `#${state.activeSection}`);
}

function selectSecondary(id) {
  const section = activeRootSection();
  const items = secondaryItems(section);
  if (!items.some((item) => item.id === id)) return;
  state.secondary[section] = id;
  state.navigationOpen = true;
  renderWorkspace();
  history.replaceState({}, '', `#${section}`);
}

function sourceText(node, fallback = '') {
  const value = String(node?.textContent || '').replace(/\s+/g, ' ').trim();
  return value || fallback;
}

function primarySource(surface) {
  const explicit = surface.querySelector('[data-v2-primary-action]');
  if (explicit) return explicit;

  const shellAction = surface.querySelector('.app-header__slot--action button');
  if (shellAction) return shellAction;

  const pageAction = surface.querySelector('.page-header-action button');
  if (pageAction) return pageAction;

  if (state.activeSection === 'people') return surface.querySelector('[data-add]');
  if (state.activeSection === 'timetable') return surface.querySelector('[data-timetable-apply]');
  if (state.activeSection === 'profile') return surface.querySelector('[data-save-profile]');

  const submitButtons = [...surface.querySelectorAll('form button[type="submit"]')]
    .filter((button) => !button.closest('[data-v2-layer], .modal-layer, .modal-backdrop'));
  return submitButtons.length === 1 ? submitButtons[0] : null;
}

function primaryLabel(source) {
  if (!source) return '';
  if (source.dataset.v2PrimaryLabel) return source.dataset.v2PrimaryLabel;
  if (source.matches('[data-add], [data-add-workplace]')) return 'Добавить';
  if (source.matches('[data-timetable-apply]')) return 'Применить';
  if (source.matches('[data-save-profile]')) return 'Сохранить';
  return sourceText(source);
}

function primaryVisible(source) {
  if (!source || source.hidden) return false;
  if (source.matches('.accordion-save') && !source.classList.contains('is-visible')) return false;
  return true;
}

function syncWorkspaceBack(surface, backSource) {
  let control = surface.querySelector(':scope > [data-v2-workspace-back]');
  if (!backSource) {
    control?.remove();
    return;
  }
  if (!control) {
    surface.insertAdjacentHTML('afterbegin', '<button type="button" class="v2-workspace-back" data-v2-workspace-back aria-label="Назад">‹</button>');
    control = surface.querySelector(':scope > [data-v2-workspace-back]');
  }
  control.setAttribute('aria-label', backSource.getAttribute('aria-label') || 'Назад');
  control.onclick = () => backSource.click();
}

function syncWorkspacePrimarySource(surface, source) {
  surface.querySelectorAll('.v2-workspace-source-hidden').forEach((node) => {
    if (node !== source) node.classList.remove('v2-workspace-source-hidden');
  });
  if (source && !source.classList.contains('v2-workspace-source-hidden')) {
    source.classList.add('v2-workspace-source-hidden');
  }
}

function activeWorkspaceSurface(surface) {
  const layers = [...app.querySelectorAll('[data-v2-z-layer]')];
  return layers.at(-1) || surface;
}

function syncWorkspaceHeader(surface) {
  if (!surface?.isConnected) return;
  const contextRoot = activeWorkspaceSurface(surface);
  const context = contextRoot.querySelector('[data-v2-workspace-context]');
  const root = activeRootSection();
  const fallbackTitle = state.activeSection === 'chat'
    ? 'Чат'
    : rootDefinition(root)?.label || '';
  const title = context?.dataset.v2Title || sourceText(
    contextRoot.querySelector('.page-header h1, .app-header__title'),
    fallbackTitle,
  );
  const backSource = contextRoot.querySelector('.app-header__slot--back button');
  const contextSource = contextRoot.querySelector('[data-v2-context-action], .page-header__meta button, .app-header__slot--settings button');
  const aSource = contextSource;
  const cSource = primarySource(contextRoot);
  const cVisible = primaryVisible(cSource);
  const hideD = context?.dataset.v2HideD === 'true';
  syncWorkspaceBack(contextRoot, backSource);
  syncWorkspacePrimarySource(contextRoot, cVisible ? cSource : null);
  const header = app.querySelector('[data-v2-header]');
  if (!header) return;

  header.outerHTML = v2Header({
    a: aSource ? {
      kind: aSource.dataset.v2AKind || 'settings',
      image: aSource.dataset.v2AImage || '',
      initials: aSource.dataset.v2AInitials || '',
      data: 'data-v2-workspace-a',
      aria: aSource.getAttribute('aria-label') || sourceText(aSource, 'Контекст раздела'),
    } : null,
    b: title,
    c: cVisible ? {
      label: primaryLabel(cSource),
      data: 'data-v2-workspace-primary',
      aria: cSource.getAttribute('aria-label') || primaryLabel(cSource),
      disabled: Boolean(cSource.disabled),
    } : null,
    d: !hideD && sectionAllowed('chat') ? {
      kind: 'chat',
      data: 'data-v2-workspace-chat',
      aria: state.activeSection === 'chat' ? 'Вернуться из чата' : 'Чат',
    } : null,
  });

  app.querySelector('[data-v2-workspace-a]')?.addEventListener('click', () => aSource?.click());
  app.querySelector('[data-v2-workspace-primary]')?.addEventListener('click', () => cSource?.click());
  app.querySelector('[data-v2-workspace-chat]')?.addEventListener('click', () => {
    if (state.activeSection === 'chat') navigate(state.lastRootSection, { navigationOpen: false });
    else navigate('chat', { navigationOpen: false });
  });
}

function renderActiveWorkspaceSurface(surface) {
  const section = state.activeSection;
  const openNavigation = () => setNavigationOpen(true);
  if (section === 'people') return renderPeople(surface);
  if (section === 'finance') return renderFinanceSection(surface, ensureSecondary('finance'), { onBack: openNavigation });
  if (section === 'timetable') return renderTimetable(surface);
  if (section === 'journal') {
    return renderJournalView(surface, ensureSecondary('journal'), {
      onViewChange: (view) => {
        if (state.secondary.journal === view) return;
        state.secondary.journal = view;
        renderWorkspace();
      },
    });
  }
  if (section === 'profile') return renderProfile(surface, openNavigation);
  if (section === 'settings') return renderSettingsSection(surface, ensureSecondary('settings'), { onBack: openNavigation });
  if (section === 'chat') return renderChat(surface);
  return renderPeople(surface);
}

function renderWorkspace() {
  setThemeColor('#2F3338');
  app.classList.remove('app-shell--booking');
  workspaceReady = true;
  disposeView();
  disposeView = () => {};
  const requested = normalizeRequestedSection(state.activeSection);
  if (!sectionAllowed(requested)) state.activeSection = defaultSection();
  if (state.activeSection !== 'chat') state.lastRootSection = state.activeSection;

  const root = activeRootSection();
  const rootItems = allowedRootItems();
  const childItems = secondaryItems(root);
  const childActive = ensureSecondary(root);
  const rootDeck = v2FDeck(rootItems, {
    active: root,
    data: 'data-v2-root-item',
    className: 'v2-deck--root',
    role: 'root',
  });
  const secondaryDeck = childItems.length ? v2FDeck(childItems, {
    active: childActive,
    data: 'data-v2-secondary-item',
    className: 'v2-deck--secondary',
    role: 'secondary',
  }) : '';

  app.innerHTML = v2Shell({
    header: v2Header({
      b: state.activeSection === 'chat' ? 'Чат' : rootDefinition(root)?.label || '',
      d: sectionAllowed('chat') ? { kind: 'chat', data: 'data-v2-workspace-chat', aria: 'Чат' } : null,
    }),
    deck: rootDeck,
    secondaryDeck,
    deckOpen: state.navigationOpen,
    className: 'v2-app--workspace',
    body: '<section class="v2-workspace-surface" data-v2-workspace-surface></section>',
  });

  const shell = app.querySelector('[data-v2-app]');
  const surface = app.querySelector('[data-v2-workspace-surface]');
  const z = app.querySelector('[data-v2-z]');
  const disposers = [];
  let moduleDispose = () => {};
  let disposed = false;
  const renderVersion = ++workspaceRenderVersion;

  app.querySelectorAll('[data-v2-root-item]').forEach((control) => {
    control.addEventListener('click', () => navigate(control.dataset.v2RootItem, { navigationOpen: true }));
  });
  app.querySelectorAll('[data-v2-secondary-item]').forEach((control) => {
    control.addEventListener('click', () => selectSecondary(control.dataset.v2SecondaryItem));
  });
  app.querySelector('[data-v2-workspace-chat]')?.addEventListener('click', () => navigate('chat', { navigationOpen: false }));

  const rootDeckNode = shell?.querySelector('[data-v2-deck-role="root"]');
  if (rootDeckNode) disposers.push(initV2DeckSwipe(rootDeckNode, {
    activeId: root,
    onActiveChange: (id) => navigate(id, { navigationOpen: true }),
  }));
  const secondaryDeckNode = shell?.querySelector('[data-v2-deck-role="secondary"]');
  if (secondaryDeckNode) disposers.push(initV2DeckSwipe(secondaryDeckNode, {
    activeId: childActive,
    onActiveChange: (id) => selectSecondary(id),
  }));
  if (z) disposers.push(initV2Swipe(z, {
    onRight: () => setNavigationOpen(true),
    onLeft: () => setNavigationOpen(false),
  }));

  const onV2ContextChanged = () => syncWorkspaceHeader(surface);
  window.addEventListener('book:v2-context-changed', onV2ContextChanged);
  disposers.push(() => window.removeEventListener('book:v2-context-changed', onV2ContextChanged));

  let headerSyncQueued = false;
  const observer = new MutationObserver(() => {
    if (headerSyncQueued || disposed) return;
    headerSyncQueued = true;
    queueMicrotask(() => {
      headerSyncQueued = false;
      if (!disposed) syncWorkspaceHeader(surface);
    });
  });
  if (surface) observer.observe(surface, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['class', 'disabled', 'aria-label'],
  });

  const result = surface ? renderActiveWorkspaceSurface(surface) : null;
  Promise.resolve(result).then((nextDispose) => {
    if (disposed || renderVersion !== workspaceRenderVersion) {
      if (typeof nextDispose === 'function') nextDispose();
      return;
    }
    if (typeof nextDispose === 'function') moduleDispose = nextDispose;
    syncWorkspaceHeader(surface);
  }).catch((error) => {
    console.error('Workspace UI render failed', error);
  });
  syncWorkspaceHeader(surface);

  disposeView = () => {
    disposed = true;
    observer.disconnect();
    disposers.forEach((dispose) => dispose?.());
    moduleDispose?.();
  };

  if (demoBadgeTimer) {
    window.clearInterval(demoBadgeTimer);
    demoBadgeTimer = null;
  }
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

function renderFirstRunUnavailable(error) {
  app.classList.remove('app-shell--booking');
  workspaceReady = false;
  disposeView();
  disposeView = () => {};
  const message = error instanceof Error ? error.message : 'Не удалось продолжить знакомство с Book.';
  app.innerHTML = `
    <main class="auth-view">
      <section class="auth-card">
        <div class="auth-card__heading">
          <h1>Не удалось открыть знакомство с Book</h1>
          <p data-first-run-load-error></p>
        </div>
        <button class="ui-button" type="button" data-first-run-retry>Повторить</button>
      </section>
    </main>`;
  app.querySelector('[data-first-run-load-error]').textContent = message;
  app.querySelector('[data-first-run-retry]')?.addEventListener('click', async (event) => {
    const control = event.currentTarget;
    control.disabled = true;
    control.textContent = 'Открываем…';
    await renderAuthenticated(authenticatedAccount);
  });
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
  const requested = normalizeRequestedSection(section);
  state.activeSection = sectionAllowed(requested) ? requested : defaultSection();
  if (state.activeSection !== 'chat') state.lastRootSection = state.activeSection;
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
  await syncRknGuideIfReady().catch((error) => {
    console.error('RKN guide initial sync failed', error);
  });
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
  } catch (error) {
    candidateRuntime.dispose();
    renderFirstRunUnavailable(error);
    return;
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
    const requested = normalizeRequestedSection(location.hash.slice(1));
    state.activeSection = sectionAllowed(requested) ? requested : defaultSection();
    if (state.activeSection !== 'chat') state.lastRootSection = state.activeSection;
    history.replaceState({}, '', `#${state.activeSection}`);
    renderWorkspace();
    startRegularPlatformNotices();
    return;
  }

  candidateRuntime.dispose();
  disposePlatformSession = await startPlatformSessionTracking();

  const requested = normalizeRequestedSection(location.hash.slice(1));
  state.activeSection = sectionAllowed(requested) ? requested : defaultSection();
  if (state.activeSection !== 'chat') state.lastRootSection = state.activeSection;
  history.replaceState({}, '', `#${state.activeSection}`);
  renderWorkspace();
  startRegularPlatformNotices();
}

function renderLogin(message = '') {
  setThemeColor('#F5F5F3');
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
  const section = normalizeRequestedSection(location.hash.slice(1));
  if (sectionAllowed(section)) {
    navigate(section, { navigationOpen: false, updateHash: false });
  } else {
    history.replaceState({}, '', `#${state.activeSection}`);
  }
});
window.addEventListener('book:v2-navigation-request', (event) => {
  if (!workspaceReady) return;
  setNavigationOpen(event?.detail?.open !== false);
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
