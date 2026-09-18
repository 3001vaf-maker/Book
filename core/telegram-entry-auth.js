import {
  clearBookingAccount,
  exchangeBookingTelegramEntry,
  getBookingContext,
} from './booking-account/index.js';
import { API_BASE } from './environment.js';
import { runTelegramRegistrationFlow } from '../telegram-registration-flow.js';

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

async function runTelegramEntryAuth(app, tenantId, entryToken) {
  renderChecking(app);

  try {
    const result = await exchangeBookingTelegramEntry(tenantId, entryToken);
    if (result?.state === 'authenticated') {
      removeTelegramEntryFromUrl();
      return;
    }

    // Telegram changes only the authentication method. Registration keeps the approved Book screens and order.
    clearBookingAccount(tenantId);
    const context = await getBookingContext(tenantId);
    await runTelegramRegistrationFlow({
      app,
      tenantId,
      entryToken,
      context,
      onRegistered: removeTelegramEntryFromUrl,
    });
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
      if (!tenantId || !entryToken) throw new Error('Telegram Mini App не определил аккаунт пользователя');
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
