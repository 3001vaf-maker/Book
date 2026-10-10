import {
  bindAccountTelegramEntry,
  clearAccount,
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
  let telegramReadyForBind = false;
  let telegramResolving = false;
  let disposed = false;

  async function resolveTelegramEntry() {
    if (disposed || telegramAttempted || telegramReadyForBind || telegramResolving || !entry) return;
    telegramResolving = true;
    try {
      const resolved = await resolveAccountTelegramEntry(tenant, entry);
      if (resolved?.exists && resolved?.accessToken) {
        telegramAttempted = true;
        removeTelegramEntryFromUrl();
        return;
      }

      // An unknown Telegram must never inherit whichever Account happened to
      // be left authenticated in this browser. Force explicit identity first.
      clearAccount(tenant);
      telegramReadyForBind = true;
    } catch {
      // Do not bind an unresolved Telegram ticket to an arbitrary existing
      // browser session. Resolution will retry while the ticket remains valid.
    } finally {
      telegramResolving = false;
    }
  }

  async function bindTelegramWhenAuthenticated() {
    if (disposed || telegramAttempted || !telegramReadyForBind || !getAccountToken(tenant)) return;
    try {
      await bindAccountTelegramEntry(tenant, entry);
      telegramAttempted = true;
      removeTelegramEntryFromUrl();
    } catch {
      // Keep retry available while the one-time entry token is still valid.
    }
  }

  await resolveTelegramEntry();
  const interval = window.setInterval(() => {
    void resolveTelegramEntry();
    void bindTelegramWhenAuthenticated();
  }, 1500);
  void bindTelegramWhenAuthenticated();

  return () => {
    disposed = true;
    window.clearInterval(interval);
  };
}
