import {
  clearBookingAccount,
  exchangeBookingTelegramEntry,
  getBookingContext,
  registerBookingTelegramAccount,
} from './booking-account/index.js';
import { normalizeBookingSettings } from './booking-settings/index.js';
import { API_BASE } from './environment.js';
import { normalizePhone } from './phone/index.js';
import { requiredBookingDocuments } from '../online-booking/model.js';
import {
  appHeader,
  appShell,
  bookingAgreementCards,
  bookingDocument,
  bookingThemeStyle,
  emptyState,
  escapeHtml,
  field,
  modal,
  mountModal,
  phoneField,
} from '../ui/ui.js';

function replaceTelegramRoute({ tenantId = '', entryToken = '', removeBot = false } = {}) {
  const url = new URL(location.href);
  if (tenantId) url.searchParams.set('booking', tenantId);
  if (entryToken) url.searchParams.set('tg_entry', entryToken);
  else url.searchParams.delete('tg_entry');
  if (removeBot) url.searchParams.delete('tg_bot');
  history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

function removeTelegramEntryFromUrl() {
  replaceTelegramRoute({});
}

function telegramUserPrefill() {
  const user = window.Telegram?.WebApp?.initDataUnsafe?.user || {};
  return {
    name: String(user.first_name || '').trim(),
    surname: String(user.last_name || '').trim(),
  };
}

function renderStatus(app, title, message, action = '') {
  app.classList.remove('app-shell--booking');
  app.innerHTML = `
    <main class="auth-view">
      <section class="auth-card">
        <div class="auth-card__heading">
          <h1>${escapeHtml(title)}</h1>
          <p>${escapeHtml(message)}</p>
        </div>
        ${action}
      </section>
    </main>`;
}

function renderChecking(app) {
  app.classList.add('app-shell--booking');
  app.innerHTML = '<main class="booking-content"></main>';
}

async function createTelegramMainAppEntry(botUsername, initData) {
  const cleanBot = String(botUsername || '').trim().replace(/^@+/, '');
  const response = await fetch(`${API_BASE}/online-booking/telegram-main-app/${encodeURIComponent(cleanBot)}/entry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData: String(initData || '') }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || 'Не удалось подтвердить Telegram Mini App');
  return payload;
}

function flowThemeClasses(settings) {
  const theme = settings?.theme && typeof settings.theme === 'object' ? settings.theme : {};
  const shape = ['soft', 'round', 'straight', 'cut'].includes(theme.shape) ? theme.shape : 'soft';
  const choiceStyle = ['cards', 'compact', 'list'].includes(theme.choiceStyle) ? theme.choiceStyle : 'cards';
  return `booking-client booking-client--account booking-shape--${shape} booking-choice-style--${choiceStyle}`;
}

function subtitleBlock(value = '') {
  const text = String(value || '').trim();
  return text ? `<div class="muted">${escapeHtml(text).replaceAll('\n', '<br>')}</div>` : '';
}

function renderFlowPage(app, settings, {
  title = '',
  subtitle = '',
  body = '',
  back = null,
  action = null,
  center = false,
} = {}) {
  const shell = appShell({
    header: appHeader({ title, back, action }),
    body: `${subtitleBlock(subtitle)}${body}`,
    className: `app-view-shell--booking-flow${center ? ' app-view-shell--booking-flow-center' : ''}`,
  });
  app.classList.add('app-shell--booking');
  app.innerHTML = `<main class="booking-content"><section class="${flowThemeClasses(settings)}" style="${bookingThemeStyle(settings)}">${shell}</section></main>`;
}

function errorBlock(message = '') {
  return message ? `<div class="form-error" role="alert">${escapeHtml(message)}</div>` : '';
}

function telegramRegistration(app, tenantId, entryToken, context) {
  const settings = normalizeBookingSettings(context.settings);
  const documents = requiredBookingDocuments(context);
  const prefill = telegramUserPrefill();
  const consents = {};
  let error = '';

  return new Promise((resolve) => {
    const openDocument = (documentId) => {
      const document = documents.find((item) => String(item.id) === String(documentId));
      if (!document) return;
      mountModal(document.body, modal(bookingDocument({
        title: document.title || 'Документ',
        version: document.version || 1,
        text: document.text || '',
      }), { variant: 'large' }));
    };

    const renderWelcome = () => {
      error = '';
      const profile = context.profile || {};
      const owner = [profile.name, profile.surname].filter(Boolean).join(' ');
      const subtitle = [settings.welcomeText, owner].filter(Boolean).join('\n');
      renderFlowPage(app, settings, {
        title: settings.welcomeTitle,
        subtitle,
        action: { label: 'Далее', data: 'data-booking-welcome-next' },
        center: true,
      });
      app.querySelector('[data-booking-welcome-next]')?.addEventListener('click', renderAgreements);
    };

    const renderAgreements = () => {
      const canContinue = documents
        .filter((document) => document.required)
        .every((document) => consents[String(document.id || '')]);
      const cards = bookingAgreementCards(documents.map((document) => ({
        label: document.title || 'Документ',
        checked: Boolean(consents[String(document.id || '')]),
        openData: `data-booking-document="${escapeHtml(document.id)}"`,
        toggleData: `data-booking-consent="${escapeHtml(document.id)}"`,
        openAria: `Открыть документ ${document.title || ''}`,
        toggleAria: `${consents[String(document.id || '')] ? 'Снять' : 'Дать'} согласие: ${document.title || ''}`,
      })));
      renderFlowPage(app, settings, {
        title: 'Соглашения',
        subtitle: 'Согласия относятся к регистрации и аккаунту клиента',
        back: { data: 'data-booking-agreements-back', aria: 'Назад' },
        action: { label: 'Далее', data: 'data-booking-agreements-next', disabled: !canContinue },
        body: `${documents.length ? cards : emptyState('Документов нет', 'Для регистрации не настроены документы согласия.')}${errorBlock(error)}`,
      });
      app.querySelector('[data-booking-agreements-back]')?.addEventListener('click', renderWelcome);
      app.querySelectorAll('[data-booking-document]').forEach((node) => node.addEventListener('click', () => openDocument(node.dataset.bookingDocument)));
      app.querySelectorAll('[data-booking-consent]').forEach((node) => node.addEventListener('click', () => {
        const id = String(node.dataset.bookingConsent || '');
        consents[id] = !consents[id];
        renderAgreements();
      }));
      app.querySelector('[data-booking-agreements-next]')?.addEventListener('click', () => {
        if (canContinue) renderDetails();
      });
    };

    const renderDetails = () => {
      renderFlowPage(app, settings, {
        title: 'Ваши данные',
        subtitle: 'Они сохранятся в вашем аккаунте',
        back: { data: 'data-booking-account-back', aria: 'Назад' },
        action: { label: 'Далее', data: 'data-booking-account-submit' },
        body: `<form data-booking-account-form>
          ${field({ label: 'Имя', name: 'name', value: prefill.name, required: true, autocomplete: 'given-name' })}
          ${field({ label: 'Фамилия', name: 'surname', value: prefill.surname, autocomplete: 'family-name' })}
          ${phoneField({ label: 'Телефон', name: 'phone', value: '', required: true })}
          ${field({ label: 'Email', name: 'email', value: '', type: 'email', required: true, autocomplete: 'email' })}
          ${errorBlock(error)}
        </form>`,
      });
      const form = app.querySelector('[data-booking-account-form]');
      const submit = app.querySelector('[data-booking-account-submit]');
      app.querySelector('[data-booking-account-back]')?.addEventListener('click', () => {
        error = '';
        renderAgreements();
      });
      submit?.addEventListener('click', () => form?.requestSubmit());
      form?.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (submit) submit.disabled = true;
        error = '';
        const data = new FormData(form);
        const phone = normalizePhone(data.get('phone'));
        if (!phone) {
          error = 'Введите телефон полностью.';
          renderDetails();
          return;
        }
        const consentFacts = documents.map((document) => ({
          documentId: String(document.id || ''),
          documentVersion: Math.max(1, Number(document.version || 1)),
          accepted: Boolean(consents[String(document.id || '')]),
          acceptedAt: new Date().toISOString(),
        }));
        try {
          await registerBookingTelegramAccount(tenantId, entryToken, {
            name: String(data.get('name') || '').trim(),
            surname: String(data.get('surname') || '').trim(),
            phone,
            email: String(data.get('email') || '').trim().toLowerCase(),
            consents: consentFacts,
          });
          removeTelegramEntryFromUrl();
          resolve({ continue: true });
        } catch (registrationError) {
          error = registrationError instanceof Error
            ? registrationError.message
            : 'Не удалось зарегистрироваться через Telegram';
          renderDetails();
        }
      });
    };

    renderWelcome();
  });
}

async function runTelegramEntryAuth(app, tenantId, entryToken) {
  renderChecking(app);

  try {
    const result = await exchangeBookingTelegramEntry(tenantId, entryToken);
    if (result?.state === 'authenticated') {
      removeTelegramEntryFromUrl();
      return;
    }

    // Telegram changes only the authentication method. The client registration screens remain the approved Book flow.
    clearBookingAccount(tenantId);
    const context = await getBookingContext(tenantId);
    await telegramRegistration(app, tenantId, entryToken, context);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не удалось войти через Telegram';
    renderStatus(
      app,
      'Telegram-вход недоступен',
      message,
      '<button class="ui-button" type="button" data-telegram-retry-normal>Войти другим способом</button>',
    );
    await new Promise((resolve) => {
      app.querySelector('[data-telegram-retry-normal]')?.addEventListener('click', () => {
        removeTelegramEntryFromUrl();
        resolve();
      });
    });
  }
}

export async function prepareTelegramEntryAuth() {
  const params = new URLSearchParams(location.search);
  let tenantId = String(params.get('booking') || '').trim();
  let entryToken = String(params.get('tg_entry') || '').trim();
  const mainAppBot = String(params.get('tg_bot') || '').trim();
  const app = document.querySelector('#app');

  if (!entryToken && mainAppBot) {
    if (!app) return { halt: true };
    const initData = String(window.Telegram?.WebApp?.initData || '').trim();
    if (!initData) {
      renderStatus(app, 'Telegram Mini App', 'Откройте приложение из Telegram.');
      return { halt: true };
    }
    renderChecking(app);
    try {
      const entry = await createTelegramMainAppEntry(mainAppBot, initData);
      tenantId = String(entry?.tenantId || '').trim();
      entryToken = String(entry?.token || '').trim();
      if (!tenantId || !entryToken) throw new Error('Telegram Mini App не определил аккаунт мастера');
      replaceTelegramRoute({ tenantId, entryToken, removeBot: true });
    } catch (error) {
      renderStatus(
        app,
        'Telegram-вход недоступен',
        error instanceof Error ? error.message : 'Не удалось подтвердить Telegram Mini App',
      );
      return { halt: true };
    }
  }

  if (!tenantId || !entryToken) return { halt: false };
  if (!app) return { halt: true };
  await runTelegramEntryAuth(app, tenantId, entryToken);
  return { halt: false };
}
