import { flushBusinessPersistence } from '../core/business-persistence.js';
import { getDays } from '../core/day/index.js';
import { getLedgerEntries } from '../core/finance/index.js';
import { getRecords } from '../core/record/index.js';
import { getPeopleCount } from '../main/people/data.js';
import { getProcedures } from '../settings/service/procedures/data.js';
import { getProducts } from '../settings/service/products/data.js';
import { button, escapeHtml, modal, mountModal } from '../ui/ui.js';
import {
  completeFirstRunStep,
  endFirstRunSessionKeepalive,
  getFirstRunState,
  heartbeatFirstRunSession,
  markFirstRunStepSeen,
  recordFirstRunActivity,
  requestLiveMode,
  startFirstRunSession,
} from './api.js';

const ONLINE_BOOKING_STEPS = new Set(['online-booking-welcome', 'online-booking-appearance', 'online-booking-time']);
const SETTINGS_STEPS = new Set(['online-booking', ...ONLINE_BOOKING_STEPS, 'notifications', 'integrations', 'tags', 'documents']);
const WORKSPACE_STEPS = new Set([
  'people',
  'timetable',
  'journal-record',
  'payment',
  'journal-month',
  'journal-list',
  'chat',
  'finance-overview',
  'finance-cash',
  'finance-dds',
  'finance-income-expense',
  'finance-articles',
  'finance-special',
  'finance-report',
  'complete',
]);

function currentStep(state) {
  const key = state?.progress?.currentStepKey || '';
  return (Array.isArray(state?.steps) ? state.steps : []).find((step) => step.key === key) || null;
}

function remainingDemoText(demo) {
  const expires = new Date(demo?.expiresAt || 0);
  if (!Number.isFinite(expires.getTime())) return '';
  const diff = Math.max(0, expires.getTime() - Date.now());
  const totalHours = Math.floor(diff / 3_600_000);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days > 0) return `${days} дн. ${hours} ч.`;
  const minutes = Math.max(0, Math.floor(diff / 60_000) % 60);
  return `${hours} ч. ${minutes} мин.`;
}

export function demoBadgeMarkup(state) {
  if (state?.commercialMode !== 'DEMO' || !state?.demo?.expiresAt) return '';
  const completed = state?.progress?.status === 'COMPLETED';
  const requested = Boolean(state?.liveRequestedAt);
  return `<div class="first-run-demo-badge" data-first-run-demo-badge>
    <span>DEMO · осталось ${escapeHtml(remainingDemoText(state.demo))}</span>
    ${completed ? `<button type="button" class="first-run-live-request" data-first-run-live-request ${requested ? 'disabled' : ''}>${requested ? 'Запрос LIVE отправлен' : 'Запросить LIVE'}</button>` : ''}
  </div>`;
}

export function bindDemoBadgeAction(root, state) {
  const control = root?.querySelector?.('[data-first-run-live-request]');
  if (!control || control.dataset.bound === 'true') return;
  control.dataset.bound = 'true';
  control.addEventListener('click', async () => {
    control.disabled = true;
    control.textContent = 'Отправляем…';
    try {
      const result = await requestLiveMode();
      if (result?.alreadyLive) {
        control.textContent = 'LIVE уже включён';
        return;
      }
      state.liveRequestedAt = result?.occurredAt || new Date().toISOString();
      control.textContent = 'Запрос LIVE отправлен';
    } catch (error) {
      control.disabled = false;
      control.textContent = error instanceof Error ? error.message : 'Не удалось отправить запрос';
    }
  });
}

function modalText(value) {
  return escapeHtml(String(value || '')).replaceAll('\n', '<br>');
}

export class FirstRunRuntime {
  constructor({
    app,
    accountEmail = '',
    getActiveSection,
    showWorkspace,
    onFinished,
    onStateChange = () => {},
  }) {
    this.app = app;
    this.accountEmail = accountEmail;
    this.getActiveSection = getActiveSection;
    this.showWorkspace = showWorkspace;
    this.onFinished = onFinished;
    this.onStateChange = onStateChange;
    this.state = null;
    this.sessionId = '';
    this.observer = null;
    this.syncQueued = false;
    this.modalShownKey = '';
    this.modalSeenKey = '';
    this.enteredStepKey = '';
    this.disposed = false;
    this.clickHandler = (event) => this.handleClick(event);
    document.addEventListener('click', this.clickHandler, true);
  }

  async load() {
    this.state = await getFirstRunState();
    this.onStateChange(this.state);
    return this.state;
  }

  async startSession() {
    try {
      const session = await startFirstRunSession();
      this.sessionId = session?.id || '';
      if (this.sessionId) {
        this.heartbeatTimer = window.setInterval(() => {
          void heartbeatFirstRunSession(this.sessionId).catch(() => undefined);
        }, 60_000);
        this.pageHideHandler = () => endFirstRunSessionKeepalive(this.sessionId, 'PAGE_HIDDEN');
        window.addEventListener('pagehide', this.pageHideHandler, { once: true });
      }
    } catch {
      this.sessionId = '';
    }
  }

  async start() {
    if (!this.state) await this.load();
    await this.startSession();
    this.demoTimer = window.setInterval(() => this.decorateDemo(), 60_000);
    if (!this.state?.assigned || this.state?.progress?.status === 'COMPLETED') {
      this.onFinished?.(this.state);
      return;
    }
    await this.renderCurrent();
  }

  dispose() {
    this.disposed = true;
    this.observer?.disconnect();
    this.observer = null;
    document.removeEventListener('click', this.clickHandler, true);
    if (this.heartbeatTimer) window.clearInterval(this.heartbeatTimer);
    if (this.demoTimer) window.clearInterval(this.demoTimer);
    if (this.pageHideHandler) window.removeEventListener('pagehide', this.pageHideHandler);
  }

  mutateAppWithoutObserver(callback) {
    const observer = this.observer;
    observer?.disconnect();
    try {
      return callback();
    } finally {
      if (observer && this.observer === observer && !this.disposed) {
        observer.observe(this.app, { childList: true, subtree: true });
      }
    }
  }

  decorateDemo() {
    this.mutateAppWithoutObserver(() => {
      this.app.querySelector('[data-first-run-demo-badge]')?.remove();
      const html = demoBadgeMarkup(this.state);
      if (html) {
        this.app.insertAdjacentHTML('beforeend', html);
        bindDemoBadgeAction(this.app, this.state);
      }
    });
  }

  installObserver() {
    this.observer?.disconnect();
    this.observer = new MutationObserver(() => this.queueSync());
    this.observer.observe(this.app, { childList: true, subtree: true });
  }

  queueSync() {
    if (this.syncQueued || this.disposed) return;
    this.syncQueued = true;
    queueMicrotask(() => {
      this.syncQueued = false;
      if (!this.disposed) this.syncCurrent();
    });
  }

  async renderCurrent() {
    this.observer?.disconnect();
    this.modalShownKey = '';
    this.modalSeenKey = '';
    this.enteredStepKey = '';
    const step = currentStep(this.state);
    if (!step) {
      this.onFinished?.(this.state);
      return;
    }

    if (step.key === 'profile') {
      await this.renderProfileStep(step);
      return;
    }
    if (step.key === 'procedures' || step.key === 'products') {
      await this.renderServiceStep(step);
      return;
    }
    if (SETTINGS_STEPS.has(step.key)) {
      await this.renderWorkspaceStep(step);
      return;
    }
    if (WORKSPACE_STEPS.has(step.key)) {
      await this.renderWorkspaceStep(step);
      return;
    }

    await this.renderWorkspaceStep(step);
  }

  focusedShell() {
    this.app.innerHTML = `<main class="app-content first-run-focused"><section data-first-run-content></section></main>`;
    this.decorateDemo();
    return this.app.querySelector('[data-first-run-content]');
  }

  async renderProfileStep(step) {
    const host = this.focusedShell();
    const profile = await import('../settings/profile/profile.js');
    profile.render(host, () => {}, { onboarding: true, accountEmail: this.accountEmail });
    await this.showStepModal(step);
    this.installObserver();

    const sync = () => {
      const ready = Boolean(profile.isOnboardingProfileReady?.(host));
      this.renderActionDock(step, {
        primaryVisible: ready,
        onPrimary: async () => {
          const saved = await profile.saveOnboardingProfile(host);
          if (!saved) return;
          await flushBusinessPersistence();
          await this.complete(step, 'complete');
        },
      });
    };
    host.addEventListener('input', sync);
    host.addEventListener('change', sync);
    const localObserver = new MutationObserver(sync);
    localObserver.observe(host, { childList: true, subtree: true });
    this.localObserver = localObserver;
    sync();
  }

  async renderServiceStep(step) {
    const host = this.focusedShell();
    const service = await import('../settings/service/service.js');
    service.render(host, () => {});
    this.installObserver();
    this.syncCurrent();
  }

  workspaceSection(step) {
    if (step.key === 'people' || step.key === 'complete') return 'people';
    if (step.key.startsWith('finance-')) return 'finance';
    if (step.key === 'timetable') return 'timetable';
    if (step.key.startsWith('journal') || step.key === 'payment') return 'journal';
    if (SETTINGS_STEPS.has(step.key)) return 'settings';
    if (step.key === 'chat') return 'chat';
    return 'people';
  }

  async renderWorkspaceStep(step) {
    const current = this.getActiveSection();

    if (step.key === 'people') {
      this.showWorkspace('people');
      this.installObserver();
      await this.showStepModal(step);
      this.queueSync();
      return;
    }

    if (step.key === 'timetable') {
      this.showWorkspace('timetable');
      this.installObserver();
      await this.showStepModal(step);
      this.queueSync();
      return;
    }

    if (step.key.startsWith('finance-')) {
      if (current !== 'finance') this.showWorkspace('finance');
      window.dispatchEvent(new CustomEvent('book:v2-navigation-request', { detail: { open: true } }));
      this.installObserver();
      this.queueSync();
      return;
    }

    if (step.key === 'journal-month' || step.key === 'journal-list') {
      if (current !== 'journal') this.showWorkspace('journal');
      window.dispatchEvent(new CustomEvent('book:v2-navigation-request', { detail: { open: true } }));
      this.installObserver();
      this.queueSync();
      return;
    }

    if (SETTINGS_STEPS.has(step.key)) {
      if (current !== 'settings') this.showWorkspace('settings');
      window.dispatchEvent(new CustomEvent('book:v2-navigation-request', { detail: { open: true } }));
      this.installObserver();
      this.queueSync();
      return;
    }

    // Остальные шаги сохраняют текущий экран и ведут через реальную V2-навигацию.
    this.installObserver();
    this.queueSync();
  }

  afterWorkspaceRender() {
    if (!this.state?.assigned || this.state?.progress?.status === 'COMPLETED') return;
    this.decorateDemo();
    this.queueSync();
  }

  pulse(element) {
    this.app.querySelectorAll('.first-run-pulse').forEach((node) => node.classList.remove('first-run-pulse'));
    const visible = element?.matches?.('[data-online-booking-sections]')
      ? this.app.querySelector('[data-v2-workspace-a]') || element
      : element;
    visible?.classList.add('first-run-pulse');
  }

  routeTarget(step) {
    if (step.key === 'procedures') return this.app.querySelector('[data-service-open="procedures"]');
    if (step.key === 'products') return this.app.querySelector('[data-service-open="products"]');
    if (step.key === 'online-booking') return this.app.querySelector('[data-v2-secondary-item="online-booking"]');
    if (step.key === 'online-booking-welcome') return document.querySelector('[data-online-booking-open="welcome"]') || this.app.querySelector('[data-online-booking-sections]') || this.app.querySelector('[data-v2-secondary-item="online-booking"]');
    if (step.key === 'online-booking-appearance') return document.querySelector('[data-online-booking-open="appearance"]') || this.app.querySelector('[data-online-booking-sections]') || this.app.querySelector('[data-v2-secondary-item="online-booking"]');
    if (step.key === 'online-booking-time') return document.querySelector('[data-online-booking-open="time"]') || this.app.querySelector('[data-online-booking-sections]') || this.app.querySelector('[data-v2-secondary-item="online-booking"]');
    if (step.key === 'notifications') return this.app.querySelector('[data-v2-secondary-item="communications"]');
    if (step.key === 'integrations') return this.app.querySelector('[data-v2-secondary-item="integrations"]');
    if (step.key === 'tags') return this.app.querySelector('[data-v2-secondary-item="tags"]');
    if (step.key === 'documents') return this.app.querySelector('[data-v2-secondary-item="documents"]');
    if (step.key === 'people' || step.key === 'finance-overview') return null;
    if (step.key === 'journal-month') return this.app.querySelector('[data-v2-secondary-item="month"]');
    if (step.key === 'journal-list') return this.app.querySelector('[data-v2-secondary-item="list"]');
    if (step.key === 'finance-cash') return this.app.querySelector('[data-v2-secondary-item="cash"]');
    if (step.key === 'finance-dds') return this.app.querySelector('[data-v2-secondary-item="dds"]');
    if (step.key === 'finance-income-expense') return this.app.querySelector('[data-v2-secondary-item="income-expense"]');
    if (step.key === 'finance-articles') return this.app.querySelector('[data-v2-secondary-item="articles"]');
    if (step.key === 'finance-special') return this.app.querySelector('[data-v2-secondary-item="special"]');
    if (step.key === 'finance-report') return this.app.querySelector('[data-v2-secondary-item="z-report"]');
    return null;
  }

  navTarget(step) {
    const section = this.workspaceSection(step);
    if (section === 'chat') return this.app.querySelector('[data-v2-workspace-chat]');
    return this.app.querySelector(`[data-v2-root-item="${CSS.escape(section)}"]`);
  }

  localReady(step) {
    if (step.key === 'procedures') return getProcedures().length > 0;
    if (step.key === 'products') return getProducts().length > 0;
    if (step.key === 'people') return getPeopleCount() > 0;
    if (step.key === 'timetable') return getDays().length > 0;
    if (step.key === 'journal-record') return getRecords().length > 0;
    if (step.key === 'payment') return getLedgerEntries().some((entry) => String(entry?.direction || '') === 'IN');
    return true;
  }

  syncCurrent() {
    const step = currentStep(this.state);
    if (!step || this.disposed) return;
    this.decorateDemo();

    if (step.key === 'procedures' || step.key === 'products') {
      const target = this.routeTarget(step);
      if (target && this.enteredStepKey !== step.key) this.pulse(target);

      if (step.kind === 'OPTIONAL_INFO') {
        this.renderActionDock(step, {
          primaryVisible: step.key === 'products' ? this.localReady(step) : this.enteredStepKey === step.key,
          skipVisible: true,
          onPrimary: () => this.complete(step, 'complete'),
          onSkip: () => this.complete(step, 'skip'),
        });
      } else if (step.kind === 'REQUIRED_INFO') {
        this.renderActionDock(step, {
          primaryVisible: this.modalSeenKey === step.key,
          onPrimary: () => this.complete(step, 'complete'),
        });
      } else {
        this.renderActionDock(step, {
          primaryVisible: this.localReady(step),
          onPrimary: async () => {
            await flushBusinessPersistence();
            await this.complete(step, 'complete');
          },
        });
      }
      return;
    }

    const activeSection = this.getActiveSection();
    const requiredSection = this.workspaceSection(step);
    if (activeSection !== requiredSection) {
      if (requiredSection !== 'chat') {
        window.dispatchEvent(new CustomEvent('book:v2-navigation-request', { detail: { open: true } }));
      }
      this.pulse(this.navTarget(step));
      if (step.kind === 'OPTIONAL_INFO') {
        this.renderActionDock(step, { skipVisible: true, onSkip: () => this.complete(step, 'skip') });
      }
      return;
    }

    const target = this.routeTarget(step);
    if (target && this.enteredStepKey !== step.key) {
      this.pulse(target);
      if (step.kind === 'OPTIONAL_INFO') {
        this.renderActionDock(step, { skipVisible: true, onSkip: () => this.complete(step, 'skip') });
      }
      return;
    }

    if (!target && !this.modalShownKey && ['timetable', 'journal-record', 'payment', 'chat', 'finance-overview', 'finance-sections', 'complete'].includes(step.key)) {
      void this.showStepModal(step);
    }

    if (step.kind === 'REQUIRED_ACTION') {
      this.renderActionDock(step, {
        primaryVisible: this.localReady(step),
        onPrimary: async () => {
          await flushBusinessPersistence();
          await this.complete(step, 'complete');
        },
      });
      return;
    }

    if (step.kind === 'REQUIRED_INFO') {
      this.renderActionDock(step, {
        primaryVisible: this.modalSeenKey === step.key,
        onPrimary: () => this.complete(step, 'complete'),
      });
      return;
    }

    if (step.kind === 'OPTIONAL_INFO') {
      this.renderActionDock(step, {
        primaryVisible: this.modalSeenKey === step.key,
        skipVisible: true,
        onPrimary: () => this.complete(step, 'complete'),
        onSkip: () => this.complete(step, 'skip'),
      });
      return;
    }

    this.renderActionDock(step, {
      primaryVisible: this.modalSeenKey === step.key,
      onPrimary: () => this.complete(step, 'complete'),
    });
  }

  async handleClick(event) {
    const step = currentStep(this.state);
    if (!step) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const rootNav = target.closest('[data-v2-root-item]');
    const chatNav = target.closest('[data-v2-workspace-chat]');
    const requestedSection = rootNav?.dataset.v2RootItem || (chatNav ? 'chat' : '');
    if (requestedSection && requestedSection === this.workspaceSection(step)) {
      window.setTimeout(() => {
        if (['timetable', 'journal-record', 'chat'].includes(step.key)) void this.showStepModal(step);
        this.queueSync();
      }, 80);
      return;
    }

    const routeTarget = this.routeTarget(step);
    if (routeTarget && (target === routeTarget || routeTarget.contains(target))) {
      const onlineBookingFolder = target.closest('[data-v2-secondary-item="online-booking"]');
      if (ONLINE_BOOKING_STEPS.has(step.key) && onlineBookingFolder) {
        window.setTimeout(() => this.queueSync(), 80);
        return;
      }
      const onlineSectionButton = target.closest('[data-online-booking-sections]');
      if (ONLINE_BOOKING_STEPS.has(step.key) && onlineSectionButton) {
        window.setTimeout(() => this.queueSync(), 80);
        return;
      }
      this.enteredStepKey = step.key;
      if (step.key === 'documents') {
        void this.showStepModal(step);
        this.queueSync();
        return;
      }
      window.setTimeout(() => {
        void this.showStepModal(step);
        this.queueSync();
      }, 120);
      return;
    }

    if (step.key === 'finance-sections') {
      const finance = target.closest('[data-finance-cash],[data-finance-dds],[data-finance-income-expense],[data-finance-articles],[data-finance-special],[data-finance-z-report]');
      if (finance) {
        void recordFirstRunActivity('FINANCE_SECTION_OPENED', {
          stepKey: step.key,
          scenarioVersionId: this.state?.scenario?.id || '',
          sessionId: this.sessionId,
          metadata: { target: [...finance.attributes].find((attr) => attr.name.startsWith('data-finance-'))?.name || '' },
        }).catch(() => undefined);
      }
    }
  }

  async showStepModal(step) {
    if (!step || this.modalShownKey === step.key || document.querySelector('[data-first-run-step-modal]')) return;
    this.modalShownKey = step.key;

    const content = `
      <div class="modal-title">
        <h2>${escapeHtml(step.modalTitle || step.title)}</h2>
        <p>${modalText(step.modalBody)}</p>
      </div>
      <div class="modal-actions">
        ${button('Понятно', { data: 'data-first-run-modal-close' })}
      </div>`;
    const layer = mountModal(document.body, modal(content, {
      title: step.modalTitle || step.title,
      variant: 'medium',
      surface: 'app',
      className: 'first-run-step-modal',
    }));
    if (!layer) {
      this.modalShownKey = '';
      return;
    }
    layer.dataset.firstRunStepModal = step.key;
    void markFirstRunStepSeen(step.key, this.sessionId)
      .then((state) => {
        this.state = state;
        this.modalSeenKey = step.key;
        this.onStateChange(this.state);
        this.queueSync();
      })
      .catch((error) => {
        this.modalShownKey = '';
        this.showError(error);
      });
    layer.querySelector('[data-first-run-modal-close]')?.addEventListener('click', async () => {
      if (this.modalSeenKey !== step.key) {
        try {
          const state = await markFirstRunStepSeen(step.key, this.sessionId);
          this.state = state;
          this.modalSeenKey = step.key;
          this.onStateChange(this.state);
        } catch (error) {
          this.showError(error);
          return;
        }
      }
      layer.remove();
      this.queueSync();
    });
    this.queueSync();
  }

  renderActionDock(step, {
    primaryVisible = false,
    skipVisible = false,
    onPrimary = null,
    onSkip = null,
  } = {}) {
    this.mutateAppWithoutObserver(() => {
      this.app.querySelector('[data-first-run-actions]')?.remove();
      if (!primaryVisible && !skipVisible) return;

      const primary = primaryVisible && onPrimary
        ? button(step.primaryLabel || 'Далее', { data: 'data-first-run-primary' })
        : '';
      const skip = skipVisible && onSkip
        ? button(step.skipLabel || 'Пропустить', { variant: 'secondary', data: 'data-first-run-skip' })
        : '';
      this.app.insertAdjacentHTML('beforeend', `<div class="first-run-action-dock" data-first-run-actions>${primary}${skip}</div>`);
      this.app.querySelector('[data-first-run-primary]')?.addEventListener('click', async (event) => {
        event.currentTarget.disabled = true;
        try { await onPrimary(); } catch (error) { this.showError(error); event.currentTarget.disabled = false; }
      });
      this.app.querySelector('[data-first-run-skip]')?.addEventListener('click', async (event) => {
        event.currentTarget.disabled = true;
        try { await onSkip(); } catch (error) { this.showError(error); event.currentTarget.disabled = false; }
      });
    });
  }

  showError(error) {
    const message = error instanceof Error ? error.message : 'Не удалось продолжить';
    const layer = mountModal(document.body, modal(
      `<div class="modal-title"><h2>Не удалось продолжить</h2><p>${escapeHtml(message)}</p></div>
       <div class="modal-actions">${button('Понятно', { data: 'data-first-run-error-close' })}</div>`,
      { title: 'Не удалось продолжить', variant: 'compact', surface: 'app' },
    ));
    layer?.querySelector('[data-first-run-error-close]')?.addEventListener('click', () => layer.remove());
  }

  async complete(step, action) {
    await flushBusinessPersistence();
    this.state = await completeFirstRunStep(step.key, action, this.sessionId);
    this.onStateChange(this.state);
    this.localObserver?.disconnect();
    this.localObserver = null;

    if (this.state?.progress?.status === 'COMPLETED') {
      this.onFinished?.(this.state);
      return;
    }
    await this.renderCurrent();
  }
}

export async function startPlatformSessionTracking() {
  try {
    const session = await startFirstRunSession();
    const sessionId = session?.id || '';
    if (!sessionId) return () => {};
    const timer = window.setInterval(() => void heartbeatFirstRunSession(sessionId).catch(() => undefined), 60_000);
    const onPageHide = () => endFirstRunSessionKeepalive(sessionId, 'PAGE_HIDDEN');
    window.addEventListener('pagehide', onPageHide, { once: true });
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('pagehide', onPageHide);
    };
  } catch {
    return () => {};
  }
}
