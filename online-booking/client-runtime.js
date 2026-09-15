import {
  bindBookingTelegramEntry,
  getBookingAccountToken,
} from '../core/booking-account/index.js';

function removeTelegramEntryFromUrl() {
  const url = new URL(location.href);
  if (!url.searchParams.has('tg_entry')) return;
  url.searchParams.delete('tg_entry');
  history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

function initializeTelegramMiniApp() {
  const webApp = window.Telegram?.WebApp;
  if (!webApp) return;
  try {
    webApp.ready();
    webApp.expand();
    document.documentElement.classList.add('telegram-mini-app');
  } catch {
    // Booking remains the same normal web app when Telegram shell APIs are unavailable.
  }
}

export function startBookingClientRuntime({ tenantId = '', telegramEntry = '' } = {}) {
  const tenant = String(tenantId || '').trim();
  const entry = String(telegramEntry || '').trim();
  if (!tenant) return () => {};

  initializeTelegramMiniApp();

  let telegramAttempted = !entry;
  let disposed = false;

  async function bindTelegramWhenAuthenticated() {
    if (disposed || telegramAttempted || !getBookingAccountToken(tenant)) return;
    telegramAttempted = true;
    try {
      await bindBookingTelegramEntry(tenant, entry);
      removeTelegramEntryFromUrl();
    } catch {
      // Keep the one-time token in the URL so a fresh page load can retry after an interrupted login.
    }
  }

  const interval = window.setInterval(() => void bindTelegramWhenAuthenticated(), 1500);
  void bindTelegramWhenAuthenticated();

  return () => {
    disposed = true;
    window.clearInterval(interval);
  };
}
