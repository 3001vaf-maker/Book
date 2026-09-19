import {
  bindAccountTelegramEntry,
  getAccountToken,
} from '../core/account/index.js';

function removeTelegramEntryFromUrl() {
  const url = new URL(location.href);
  if (!url.searchParams.has('tg_entry')) return;
  url.searchParams.delete('tg_entry');
  history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

export function startBookingClientRuntime({ tenantId = '', telegramEntry = '' } = {}) {
  const tenant = String(tenantId || '').trim();
  const entry = String(telegramEntry || '').trim();
  if (!tenant) return () => {};

  let telegramAttempted = !entry;
  let disposed = false;

  async function bindTelegramWhenAuthenticated() {
    if (disposed || telegramAttempted || !getAccountToken(tenant)) return;
    telegramAttempted = true;
    try {
      await bindAccountTelegramEntry(tenant, entry);
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
