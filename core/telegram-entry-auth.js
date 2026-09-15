import {
  clearBookingAccount,
  exchangeBookingTelegramEntry,
  getBookingContext,
  registerBookingTelegramAccount,
} from './booking-account/index.js';
import { API_BASE } from './environment.js';
import { normalizePhone } from './phone/index.js';
import { requiredBookingDocuments } from '../online-booking/model.js';

function escapeHtml(value = '') {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

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

function consentMarkup(documents) {
  return documents.map((document) => {
    const id = String(document.id || '');
    const title = String(document.title || 'Документ');
    const body = String(document.body || document.text || '').trim();
    return `
      <section class="auth-consent-item">
        <label style="display:flex;align-items:flex-start;gap:10px;font-size:14px;font-weight:600">
          <input type="checkbox" name="consent:${escapeHtml(id)}" ${document.required ? 'required' : ''} style="width:18px;height:18px;margin-top:2px">
          <span>${escapeHtml(title)}${document.required ? ' *' : ''}</span>
        </label>
        ${body ? `<details style="margin:6px 0 0 28px"><summary>Прочитать</summary><div class="muted" style="white-space:pre-wrap;margin-top:8px">${escapeHtml(body)}</div></details>` : ''}
      </section>`;
  }).join('');
}

function telegramRegistration(app, tenantId, entryToken, context) {
  const documents = requiredBookingDocuments(context);
  const prefill = telegramUserPrefill();

  return new Promise((resolve) => {
    app.classList.remove('app-shell--booking');
    app.innerHTML = `
      <main class="auth-view">
        <section class="auth-card" aria-labelledby="telegram-register-title">
          <div class="auth-card__heading">
            <h1 id="telegram-register-title">Регистрация через Telegram</h1>
            <p>Telegram уже подтверждён. Пароль не нужен.</p>
          </div>
          <form class="auth-form" data-telegram-register-form>
            <label class="field">
              <span>Имя</span>
              <input name="name" autocomplete="given-name" value="${escapeHtml(prefill.name)}" required>
            </label>
            <label class="field">
              <span>Фамилия</span>
              <input name="surname" autocomplete="family-name" value="${escapeHtml(prefill.surname)}">
            </label>
            <label class="field">
              <span>Телефон</span>
              <input name="phone" type="tel" autocomplete="tel" placeholder="+7 999 123-45-67" required>
            </label>
            <label class="field">
              <span>Email</span>
              <input name="email" type="email" autocomplete="email" required>
            </label>
            ${consentMarkup(documents)}
            <p class="auth-error" data-telegram-register-error role="alert"></p>
            <button class="ui-button" type="submit">Продолжить</button>
            <button class="ui-button ui-button--secondary" type="button" data-telegram-normal-login>Войти другим способом</button>
          </form>
        </section>
      </main>`;

    const form = app.querySelector('[data-telegram-register-form]');
    const error = app.querySelector('[data-telegram-register-error]');
    const submit = form?.querySelector('button[type="submit"]');

    app.querySelector('[data-telegram-normal-login]')?.addEventListener('click', () => {
      removeTelegramEntryFromUrl();
      resolve({ continue: true });
    });

    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (submit) submit.disabled = true;
      if (error) error.textContent = '';
      const data = new FormData(form);
      const phone = normalizePhone(data.get('phone'));
      if (!phone) {
        if (error) error.textContent = 'Введите телефон полностью.';
        if (submit) submit.disabled = false;
        return;
      }
      const consents = documents.map((document) => ({
        documentId: String(document.id || ''),
        documentVersion: Math.max(1, Number(document.version || 1)),
        accepted: data.get(`consent:${String(document.id || '')}`) === 'on',
        acceptedAt: new Date().toISOString(),
      }));

      try {
        await registerBookingTelegramAccount(tenantId, entryToken, {
          name: String(data.get('name') || '').trim(),
          surname: String(data.get('surname') || '').trim(),
          phone,
          email: String(data.get('email') || '').trim().toLowerCase(),
          consents,
        });
        removeTelegramEntryFromUrl();
        resolve({ continue: true });
      } catch (registrationError) {
        if (error) error.textContent = registrationError instanceof Error
          ? registrationError.message
          : 'Не удалось зарегистрироваться через Telegram';
        if (submit) submit.disabled = false;
      }
    });
  });
}

async function runTelegramEntryAuth(app, tenantId, entryToken) {
  renderStatus(app, 'Вход через Telegram', 'Проверяем Telegram…');

  try {
    const result = await exchangeBookingTelegramEntry(tenantId, entryToken);
    if (result?.state === 'authenticated') {
      removeTelegramEntryFromUrl();
      return;
    }

    // Do not let a browser session for another client silently win over the Telegram identity.
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
    renderStatus(app, 'Вход через Telegram', 'Проверяем Telegram…');
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
