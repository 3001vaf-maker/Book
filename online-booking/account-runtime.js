import {
  bindAccountTelegramEntry,
  getAccountToken,
  resolveAccountTelegramEntry,
} from '../core/account/index.js';

function removeTelegramEntryFromUrl() {
  const url = new URL(location.href);
  if (!url.searchParams.has('tg_entry')) return;
  url.searchParams.delete('tg_entry');
  history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

export async function startAccountRuntime({ tenantId = '', telegramEntry = '' } = {}) {
  const tenant = String(tenantId || '').trim();
  const entry = String(telegramEntry || '').trim();
  if (!tenant) return () => {};

  let telegramAttempted = !entry;
  let disposed = false;

  if (entry && !getAccountToken(tenant)) {
    try {
      const resolved = await resolveAccountTelegramEntry(tenant, entry);
      if (resolved?.exists && resolved?.accessToken) {
        telegramAttempted = true;
        removeTelegramEntryFromUrl();
      }
    } catch {
      // Keep the entry token for the normal login/registration path.
    }
  }

  async function bindTelegramWhenAuthenticated() {
    if (disposed || telegramAttempted || !getAccountToken(tenant)) return;
    try {
      await bindAccountTelegramEntry(tenant, entry);
      telegramAttempted = true;
      removeTelegramEntryFromUrl();
    } catch {
      // Keep retry available while the one-time entry token is still valid.
    }
  }

  const interval = window.setInterval(() => void bindTelegramWhenAuthenticated(), 1500);
  void bindTelegramWhenAuthenticated();

  return () => {
    disposed = true;
    window.clearInterval(interval);
  };
}
