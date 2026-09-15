import { registerBookingTelegramAccount } from './core/booking-account/index.js';
import { normalizeBookingSettings } from './core/booking-settings/index.js';
import { normalizePhone } from './core/phone/index.js';
import { requiredBookingDocuments } from './online-booking/model.js';
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
} from './ui/ui.js';

function telegramUserPrefill() {
  const user = window.Telegram?.WebApp?.initDataUnsafe?.user || {};
  return {
    name: String(user.first_name || '').trim(),
    surname: String(user.last_name || '').trim(),
  };
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

export function runTelegramRegistrationFlow({ app, tenantId, entryToken, context, onRegistered }) {
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
          if (typeof onRegistered === 'function') onRegistered();
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
