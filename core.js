import { renderMain } from './main/main.js';
import { renderJournal } from './journal/journal.js';
import { renderTimetable } from './timetable/timetable.js';
import { renderSettings } from './settings/settings.js';
import { renderChat } from './chat/chat.js';
import { getWorkplaces as getWorkplaceEntities } from './settings/profile/workplaces/data.js';
import { getProfile } from './settings/profile/data.js';
import { getProcedures } from './settings/service/procedures/data.js';
import { getDays } from './core/day/index.js';
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
import { canUseBookCapability, getBookAccess, loadBookAccess } from './core/access.js';
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
let tenantRuntime = { state: { operationMode: 'LIVE' } };
let pendingSettingsFolder = '';
let documentSyncRunning = false;
let documentSyncPending = false;

const RKN_NOTIFICATION_URL = 'https://pd.rkn.gov.ru/operators-registry/notification/form/';

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

function isDemoMode() {
  return getBookAccess().isOwnerBook !== true && tenantRuntime?.state?.operationMode !== 'LIVE';
}

function renderWorkspace() {
  app.classList.remove('app-shell--booking');
  workspaceReady = true;
  disposeView();
  disposeView = () => {};
  if (!sectionAllowed(state.activeSection)) state.activeSection = defaultSection();
  const view = routes[state.activeSection];
  const demoBanner = isDemoMode()
    ? '<button class="demo-mode-banner" type="button" data-demo-banner><strong>DEMO</strong><span>Помощник настройки · переход к LIVE</span><b>›</b></button>'
    : '';
  app.innerHTML = `${demoBanner}<main class="app-content ${isDemoMode() ? 'app-content--with-demo-banner' : ''}" id="app-content"></main>${bottomNavigation(state.activeSection, allowedSections())}`;
  const requestedFolder = state.activeSection === 'settings' ? pendingSettingsFolder : '';
  pendingSettingsFolder = '';
  const nextDispose = view(document.querySelector('#app-content'), { navigate, openFolder: requestedFolder, demo: isDemoMode() });
  if (typeof nextDispose === 'function') disposeView = nextDispose;
  app.querySelector('[data-demo-banner]')?.addEventListener('click', openDemoHub);
  app.querySelectorAll('[data-nav]').forEach((navButton) => {
    navButton.addEventListener('click', () => navigate(navButton.dataset.nav));
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


function profileIdentityReady() {
  const profile = getProfile();
  const phones = Array.isArray(profile.phones) ? profile.phones : [];
  const emails = Array.isArray(profile.emails) ? profile.emails : [];
  return Boolean(String(profile.name || '').trim()
    && String(profile.profession || '').trim()
    && (phones.length || emails.length));
}

function profileSetupReady() {
  return profileIdentityReady() && getWorkplaceEntities().length > 0;
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

function setupRow(label, ready, target, note = '') {
  return `<button class="demo-setup-row" type="button" data-demo-target="${escapeHtml(target)}">
    <span>${ready ? '✓' : '○'}</span>
    <span class="demo-setup-row__copy"><strong>${escapeHtml(label)}</strong>${note ? `<small>${escapeHtml(note)}</small>` : ''}</span>
    <b>›</b>
  </button>`;
}

function demoStage(title, subtitle, rows) {
  const content = rows.filter(Boolean).join('');
  if (!content) return '';
  return `<section class="demo-stage">
    <div class="demo-stage__head">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(subtitle)}</span>
    </div>
    <div class="demo-setup-list">${content}</div>
  </section>`;
}

function openDemoTarget(target) {
  if (target === 'timetable' || target === 'journal' || target === 'chat') {
    navigate(target);
    return;
  }
  openSettingsTarget(target);
}

function openDemoHub() {
  const profileStage = demoStage(
    'Этап 1 — Профиль',
    'Проверьте данные из регистрации и дозаполните профиль.',
    [
      setupRow('Профиль', profileIdentityReady(), 'profile', 'Имя и контакты уже подставлены из регистрации'),
    ],
  );

  const workStage = demoStage(
    'Этап 2 — Работа',
    'Подготовьте ежедневную работу. Можно заполнять в удобном порядке.',
    [
      setupRow('Рабочее место', getWorkplaceEntities().length > 0, 'profile'),
      canUseBookCapability('services.access') ? setupRow('Услуги и цены', getProcedures().length > 0, 'service') : '',
      canUseBookCapability('timetable.access') ? setupRow('График работы', getDays().length > 0, 'timetable') : '',
      canUseBookCapability('journal.access') ? setupRow('Журнал', false, 'journal') : '',
    ],
  );

  const capabilityStage = demoStage(
    'Этап 3 — Возможности Book',
    'Здесь только те разделы, которые открыты вашему Book.',
    [
      canUseBookCapability('online_booking.access') ? setupRow('Онлайн-запись', tenantRuntime?.state?.operationMode === 'LIVE', 'online-booking') : '',
      canUseBookCapability('notifications.access') ? setupRow('Уведомления', false, 'communications') : '',
      canUseBookCapability('chat.access') ? setupRow('Чат', false, 'chat') : '',
      canUseBookCapability('integrations.access') ? setupRow('Интеграции', false, 'integrations') : '',
      canUseBookCapability('documents.access') ? setupRow('Документы для клиентов', profileSetupReady(), 'documents', 'Формируются автоматически после готового профиля') : '',
      canUseBookCapability('tags.access') ? setupRow('Ярлыки', false, 'tags') : '',
    ],
  );

  const m = mountModal(document.body, modal(`
    <div class="modal-title">
      <h2>Book работает в DEMO</h2>
      <p>Помощник ведёт по этапам, но ничего не блокирует. Можно закрыть его и пользоваться любыми открытыми разделами DEMO в своём порядке.</p>
    </div>
    <div class="demo-stages">${profileStage}${workStage}${capabilityStage}</div>
    ${actionBlock(button('Перейти к LIVE', { data: 'data-demo-go-live' }))}
  `, { variant: 'medium', surface: 'app' }));
  if (!m) return;

  m.querySelectorAll('[data-demo-target]').forEach((row) => {
    row.addEventListener('click', () => {
      const target = row.dataset.demoTarget;
      m.remove();
      openDemoTarget(target);
    });
  });
  m.querySelector('[data-demo-go-live]')?.addEventListener('click', () => {
    m.remove();
    openLiveChoice();
  });
}

function openLiveChoice() {
  const m = mountModal(document.body, modal(`
    <div class="modal-title">
      <h2>Переход в LIVE</h2>
      <p>В LIVE Book позволяет работать с реальными клиентами и их персональными данными. Book помогает подготовиться, но не определяет за вас ваши правовые основания и не заменяет юридическую консультацию.</p>
    </div>
    <div class="demo-choice-list">
      <button class="demo-choice" type="button" data-live-ready>
        <strong>Я уже могу работать с персональными данными</strong>
        <span>Я сам проверил свои основания и принимаю ответственность за свою работу с данными клиентов.</span>
      </button>
      <button class="demo-choice" type="button" data-live-help>
        <strong>Мне нужна помощь</strong>
        <span>Book покажет, как подготовиться и где подать уведомление в Роскомнадзор.</span>
      </button>
    </div>
  `, { variant: 'medium', surface: 'app' }));
  if (!m) return;
  m.querySelector('[data-live-ready]')?.addEventListener('click', () => {
    m.remove();
    openReadyConfirmation();
  });
  m.querySelector('[data-live-help]')?.addEventListener('click', () => {
    m.remove();
    openRknHelp();
  });
}

function responsibilityCheck(label) {
  return `<label class="demo-responsibility"><input type="checkbox" data-responsibility><span>${escapeHtml(label)}</span></label>`;
}

function openReadyConfirmation() {
  const m = mountModal(document.body, modal(`
    <div class="modal-title">
      <h2>Подтвердите решение</h2>
      <p>Book не просит загружать ИНН, ОГРНИП, паспорт или документы Роскомнадзора. Мы фиксируем только ваше решение перейти к работе.</p>
    </div>
    ${responsibilityCheck('Я понимаю, что сам отвечаю за наличие правовых оснований, уведомления и соблюдение требований при работе с персональными данными клиентов.')}
    <p class="form-error" data-live-error></p>
    ${actionBlock(button('Включить LIVE', { data: 'data-confirm-live' }))}
  `, { variant: 'medium', surface: 'app' }));
  if (!m) return;
  m.querySelector('[data-confirm-live]')?.addEventListener('click', async () => {
    if (!m.querySelector('[data-responsibility]')?.checked) {
      m.querySelector('[data-live-error]').textContent = 'Подтвердите, что решение принимаете вы.';
      return;
    }
    await activateLive(m, {
      decision: 'READY',
      rknStatus: 'UNKNOWN',
      responsibilityAcknowledged: true,
    });
  });
}

function printableRknGuide() {
  const profile = getProfile();
  const workplaces = getWorkplaceEntities();
  const fullName = [profile.name, profile.surname].filter(Boolean).join(' ') || 'Пользователь Book';
  const contact = (profile.emails || [])[0] || (profile.phones || [])[0] || '';
  const work = workplaces[0] || {};
  const win = window.open('', '_blank');
  if (!win) return;
  const safe = (value) => escapeHtml(String(value || '—'));
  win.document.write(`<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Помощник РКН · Book</title>
    <style>body{font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;max-width:760px;margin:40px auto;padding:0 24px;color:#292522}h1{font-size:30px}h2{margin-top:30px;font-size:21px}.card{padding:16px;border:1px solid #ddd;border-radius:14px;margin:12px 0}a{color:#292522;font-weight:700}button{padding:12px 18px;border:0;border-radius:12px;background:#292522;color:white;font-weight:700}@media print{button{display:none}}</style>
    </head><body>
    <h1>Помощник по уведомлению Роскомнадзора</h1>
    <p>Эта памятка помогает пройти подачу самостоятельно. Она не является подтверждением обязанности или освобождения от неё.</p>
    <h2>Данные, которые уже есть в вашем Book</h2>
    <div class="card"><b>Имя:</b> ${safe(fullName)}<br><b>Контакт:</b> ${safe(contact)}<br><b>Рабочее место:</b> ${safe([work.city, work.address].filter(Boolean).join(', '))}</div>
    <h2>Шаг 1. Откройте форму Роскомнадзора</h2>
    <p><a href="${RKN_NOTIFICATION_URL}" target="_blank" rel="noopener">Открыть официальную форму уведомления</a></p>
    <h2>Шаг 2. Заполняйте сведения о своей работе</h2>
    <p>Указывайте только сведения, относящиеся к вашей деятельности. Не передавайте Book паспорт, ИНН, ОГРНИП, сканы заявления или иные лишние документы.</p>
    <h2>Шаг 3. После подачи</h2>
    <p>Сохраните подтверждение подачи у себя. В Book достаточно отметить, что вы подали уведомление; номер можно указать добровольно.</p>
    <h2>Ответственность</h2>
    <p>За полноту, правильность и своевременность сведений, которые вы подаёте в Роскомнадзор, отвечаете вы как оператор своих клиентских данных.</p>
    <button onclick="window.print()">Печать / сохранить как PDF</button>
    </body></html>`);
  win.document.close();
}

function openRknHelp() {
  const m = mountModal(document.body, modal(`
    <div class="modal-title">
      <h2>Помощник по персональным данным</h2>
      <p>Если вы ещё не подготовились к работе с персональными данными, Book поможет пройти путь без лишней юридической терминологии.</p>
    </div>
    <div class="demo-help-note">
      <strong>Что сделать</strong>
      <p>Проверьте, требуется ли вам уведомление Роскомнадзора, и при необходимости подайте его до начала обработки. Book не просит присылать нам заявление или ваши дополнительные реквизиты.</p>
    </div>
    <div class="modal-actions">
      <button class="ui-button ui-button--secondary" type="button" data-rkn-open>Открыть Роскомнадзор</button>
      <button class="ui-button ui-button--secondary" type="button" data-rkn-guide>Инструкция · сохранить PDF</button>
    </div>
    <label class="field" style="margin-top:14px"><span>Номер подачи / регистрации — необязательно</span><input data-rkn-reference></label>
    ${responsibilityCheck('Я понимаю, что Book помогает с процессом, но я сам отвечаю за правильность и своевременность своих действий.')}
    <p class="form-error" data-live-error></p>
    <div class="modal-actions">
      <button class="ui-button" type="button" data-rkn-submitted>Я подал уведомление · включить LIVE</button>
      <button class="ui-button ui-button--secondary" type="button" data-rkn-skip>Продолжить без подтверждения</button>
    </div>
  `, { variant: 'medium', surface: 'app' }));
  if (!m) return;

  m.querySelector('[data-rkn-open]')?.addEventListener('click', () => window.open(RKN_NOTIFICATION_URL, '_blank', 'noopener'));
  m.querySelector('[data-rkn-guide]')?.addEventListener('click', printableRknGuide);
  m.querySelector('[data-rkn-submitted]')?.addEventListener('click', async () => {
    if (!m.querySelector('[data-responsibility]')?.checked) {
      m.querySelector('[data-live-error]').textContent = 'Подтвердите, что решение принимаете вы.';
      return;
    }
    await activateLive(m, {
      decision: 'GUIDED_SUBMITTED',
      rknStatus: 'SUBMITTED',
      submissionReference: String(m.querySelector('[data-rkn-reference]')?.value || '').trim(),
      responsibilityAcknowledged: true,
    });
  });
  m.querySelector('[data-rkn-skip]')?.addEventListener('click', () => {
    m.remove();
    openSkipWarning();
  });
}

function openSkipWarning() {
  const m = mountModal(document.body, modal(`
    <div class="modal-title">
      <h2>Продолжить без подтверждения?</h2>
      <p>Book не будет блокировать вашу работу. При этом Book не подтверждает, что ваши обязанности по персональным данным выполнены. До начала работы с реальными данными вы самостоятельно оцениваете и выполняете требования закона.</p>
    </div>
    ${responsibilityCheck('Я прочитал предупреждение и самостоятельно принимаю решение перейти в LIVE.')}
    <p class="form-error" data-live-error></p>
    ${actionBlock(button('Всё равно включить LIVE', { data: 'data-skip-confirm' }))}
  `, { variant: 'medium', surface: 'app' }));
  if (!m) return;
  m.querySelector('[data-skip-confirm]')?.addEventListener('click', async () => {
    if (!m.querySelector('[data-responsibility]')?.checked) {
      m.querySelector('[data-live-error]').textContent = 'Подтвердите своё решение.';
      return;
    }
    await activateLive(m, {
      decision: 'CONTINUE_WITHOUT_CONFIRMATION',
      rknStatus: 'NOT_SUBMITTED',
      responsibilityAcknowledged: true,
    });
  });
}

async function activateLive(modalNode, payload) {
  const error = modalNode.querySelector('[data-live-error]');
  try {
    const next = await tenantLegalRequest('/live', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    tenantRuntime = next;
    if (canUseBookCapability('online_booking.access')) {
      await apiRequest('/online-booking/owner/publication', {
        method: 'PUT',
        body: JSON.stringify({ data: { source: 'live-activation' } }),
      }).catch(() => null);
    }
    modalNode.remove();
    renderWorkspace();
    const done = mountModal(document.body, modal(`
      <div class="modal-title"><h2>LIVE включён</h2><p>Теперь Book работает с реальными данными в рамках доступных вам функций.</p></div>
      ${actionBlock(button('Продолжить', { data: 'data-live-done' }))}
    `, { variant: 'compact', surface: 'app' }));
    done?.querySelector('[data-live-done]')?.addEventListener('click', () => done.remove());
  } catch (activateError) {
    if (error) error.textContent = activateError instanceof Error ? activateError.message : 'Не удалось включить LIVE';
  }
}

function maybeShowDemoWelcome() {
  if (!isDemoMode() || !authenticatedAccount?.tenant?.id) return;
  if (Number(authenticatedAccount?.user?.onboardingStep || 0) >= 1) return;
  const m = mountModal(document.body, modal(`
    <div class="modal-title">
      <h2>Вы в DEMO</h2>
      <p>Это настоящий Book в режиме настройки. Можно свободно изучать доступные разделы. Начать удобнее с профиля — после его заполнения Book автоматически подготовит документы для клиентов.</p>
    </div>
    <div class="modal-actions">
      <button class="ui-button" type="button" data-demo-profile>Заполнить профиль</button>
      <button class="ui-button ui-button--secondary" type="button" data-demo-later>Позже</button>
    </div>
  `, { variant: 'medium', surface: 'app' }));
  const acknowledge = async () => {
    try {
      const response = await apiRequest('/auth/onboarding-step', {
        method: 'POST',
        body: JSON.stringify({ step: 1 }),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload?.user && authenticatedAccount?.user) {
        authenticatedAccount.user.onboardingStep = Number(payload.user.onboardingStep || 1);
      }
    } catch {
      // The guide may be shown again next time if the acknowledgement could not be saved.
    }
  };
  m?.querySelector('[data-demo-profile]')?.addEventListener('click', async () => {
    await acknowledge();
    m.remove();
    openSettingsTarget('profile');
  });
  m?.querySelector('[data-demo-later]')?.addEventListener('click', async () => {
    await acknowledge();
    m.remove();
  });
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
      if (tenantRuntime?.state?.operationMode === 'LIVE' && canUseBookCapability('online_booking.access')) {
        await apiRequest('/online-booking/owner/publication', {
          method: 'PUT',
          body: JSON.stringify({ data: { source: 'document-auto-refresh' } }),
        }).catch(() => null);
      }
      const notice = mountModal(document.body, modal(`
        <div class="modal-title"><h2>Документы обновлены</h2><p>Book автоматически сформировал актуальную версию документов из данных вашего профиля.</p></div>
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

async function renderAuthenticated(account = authenticatedAccount) {
  authenticatedAccount = account || authenticatedAccount;

  let access;
  try {
    access = await loadBookAccess();
  } catch (error) {
    console.error('[Book startup] access failed', error);
    renderServerStatePending();
    return;
  }

  if (access.status === 'SUSPENDED') {
    renderSuspended();
    return;
  }

  if (access.isOwnerBook !== true) {
    try {
      tenantRuntime = await tenantLegalRequest('/readiness');
    } catch (error) {
      console.error('[Book startup] legal readiness failed', error);
      renderServerStatePending();
      return;
    }
  } else {
    tenantRuntime = { state: { operationMode: 'LIVE' } };
  }

  try {
    const migration = await initializeProfileWorkplaces(authenticatedAccount);
    if (!migration.verified) throw new Error('Profile + Workplaces not verified');
    const businessMigration = await initializeBusinessState(authenticatedAccount);
    if (!businessMigration.verified) throw new Error('Business state not verified');
    const operationalMigration = await initializeOperationalState(authenticatedAccount);
    if (!operationalMigration.verified) throw new Error('Operational state not verified');
    const documentMigration = await initializeDocumentState(authenticatedAccount);
    if (!documentMigration.verified) throw new Error('Document state not verified');
    const auxiliaryMigration = await initializeAuxiliaryState(authenticatedAccount);
    if (!auxiliaryMigration.verified) throw new Error('Auxiliary state not verified');
  } catch (error) {
    console.error('[Book startup] server state initialization failed', error);
    renderServerStatePending();
    return;
  }
  clearLegacyBusinessStorage();
  ensureServerBookingSync();

  const requested = location.hash.slice(1);
  state.activeSection = sectionAllowed(requested) ? requested : defaultSection();
  history.replaceState({}, '', `#${state.activeSection}`);
  renderWorkspace();
  if (isDemoMode()) queueMicrotask(maybeShowDemoWelcome);
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
