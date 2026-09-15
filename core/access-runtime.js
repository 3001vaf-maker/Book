import { refreshBookAccess } from './access.js';
import { getCapabilityDescription, getCapabilityTitle } from './capability-registry.js';
import { openNotice } from '../ui/modals/index.js';

const REFRESH_INTERVAL_MS = 60_000;
let monitorStarted = false;
let refreshInFlight = false;
let reloadPending = false;

function announcementMessage(keys) {
  return keys
    .map((key) => {
      const title = getCapabilityTitle(key);
      const description = getCapabilityDescription(key);
      return description ? `${title} — ${description}` : title;
    })
    .join(' ');
}

function reloadBook() {
  if (reloadPending) return;
  reloadPending = true;
  window.location.reload();
}

function handleAccessUpdate(event) {
  const detail = event?.detail || {};
  const newlyEnabled = Array.isArray(detail.newlyEnabled) ? detail.newlyEnabled : [];

  if (newlyEnabled.length) {
    const modal = openNotice({
      title: 'В Book появились новые возможности',
      message: announcementMessage(newlyEnabled),
      action: 'Продолжить',
      variant: 'compact',
      surface: 'app',
    });
    if (detail.changed) {
      modal?.querySelector('[data-notice-close]')?.addEventListener('click', reloadBook, { once: true });
    }
    return;
  }

  if (detail.changed) reloadBook();
}

async function refreshAccess() {
  if (refreshInFlight || reloadPending) return;
  refreshInFlight = true;
  try {
    await refreshBookAccess();
  } catch {
    // A temporary network error must not interrupt the current Book session.
  } finally {
    refreshInFlight = false;
  }
}

function startMonitor() {
  if (monitorStarted) return;
  monitorStarted = true;
  window.setInterval(refreshAccess, REFRESH_INTERVAL_MS);
  window.addEventListener('focus', refreshAccess, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void refreshAccess();
  });
}

window.addEventListener('book:access-updated', (event) => {
  startMonitor();
  handleAccessUpdate(event);
});
